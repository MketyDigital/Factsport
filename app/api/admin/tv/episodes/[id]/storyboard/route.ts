import { NextResponse } from 'next/server';
import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';
import { isSameOriginRequest } from '@/app/lib/admin/authorization';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
type Fact = { id: string; text: string; source: string; observedAt: string; verified: boolean };
type Block = { id: string; text: string; factIds: string[] };

function iso(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(date.getTime())) throw new Error('tv_episode_timestamp_invalid');
  return date.toISOString();
}

/** Convert approved narration into a deterministic storyboard of text-only fact cards.
 * This creates no image/audio/video and does not change rights or episode status.
 */
export async function POST(request: Request, context: { params: { id: string } }) {
  const authorization = await authorizeMediaEditorialAction('tv');
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status, headers: PRIVATE_HEADERS });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Same-origin request required.' }, { status: 403, headers: PRIVATE_HEADERS });
  if (!UUID.test(context.params.id)) return NextResponse.json({ error: 'Episode not found.' }, { status: 404, headers: PRIVATE_HEADERS });
  if (Number(request.headers.get('content-length') || 0) > 2048) return NextResponse.json({ error: 'Storyboard request is too large.' }, { status: 413, headers: PRIVATE_HEADERS });

  let expectedUpdatedAt: unknown;
  try {
    const body = await request.json() as { expectedUpdatedAt?: unknown };
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid_body');
    expectedUpdatedAt = body.expectedUpdatedAt;
  } catch {
    return NextResponse.json({ error: 'Reload the episode before building its storyboard.' }, { status: 400, headers: PRIVATE_HEADERS });
  }
  if (typeof expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(expectedUpdatedAt))) {
    return NextResponse.json({ error: 'Reload the episode before building its storyboard.' }, { status: 400, headers: PRIVATE_HEADERS });
  }

  try {
    const result = await withFactsportEditorialPostgres(sql => sql.begin(async tx => {
      const rows = await tx`
        SELECT id, status, revision, updated_at, snapshot, editorial_content
        FROM public.factsport_tv_episodes WHERE id = ${context.params.id}::uuid FOR UPDATE
      `;
      const row = rows[0];
      if (!row) return { kind: 'not_found' as const };
      if (!['blocked_rights', 'needs_data', 'script_draft', 'revision_requested'].includes(String(row.status))) {
        return { kind: 'locked' as const };
      }
      if (iso(row.updated_at) !== new Date(expectedUpdatedAt as string).toISOString()) return { kind: 'stale' as const };

      const snapshot = row.snapshot && typeof row.snapshot === 'object' ? row.snapshot as Record<string, unknown> : {};
      const storyPlan = snapshot.storyPlan && typeof snapshot.storyPlan === 'object' ? snapshot.storyPlan as Record<string, unknown> : {};
      const facts = Array.isArray(storyPlan.facts) ? storyPlan.facts.filter((fact): fact is Fact => Boolean(
        fact && typeof fact === 'object' &&
        typeof (fact as Fact).id === 'string' &&
        typeof (fact as Fact).text === 'string' &&
        typeof (fact as Fact).source === 'string' &&
        typeof (fact as Fact).observedAt === 'string' &&
        (fact as Fact).verified === true
      )) : [];
      const content = row.editorial_content && typeof row.editorial_content === 'object'
        ? row.editorial_content as Record<string, unknown>
        : {};
      const draft = content.scriptDraft && typeof content.scriptDraft === 'object'
        ? content.scriptDraft as { blocks?: unknown; digest?: unknown }
        : null;
      const review = content.scriptReview && typeof content.scriptReview === 'object'
        ? content.scriptReview as { decision?: unknown; scriptDigest?: unknown }
        : null;
      if (!draft || !Array.isArray(draft.blocks) || draft.blocks.length < 1 || typeof draft.digest !== 'string') {
        return { kind: 'script_missing' as const };
      }
      const blocks = draft.blocks as Block[];
      if (blocks.some(block => !block || typeof block.id !== 'string' || typeof block.text !== 'string' ||
          !Array.isArray(block.factIds) || block.factIds.length < 1 ||
          block.factIds.some(id => typeof id !== 'string' || !facts.some(fact => fact.id === id)))) {
        return { kind: 'script_invalid' as const };
      }
      const computedBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(blocks)));
      const computedDigest = Array.from(new Uint8Array(computedBytes), byte => byte.toString(16).padStart(2, '0')).join('');
      if (computedDigest !== draft.digest || review?.decision !== 'approved' || review.scriptDigest !== draft.digest) {
        return { kind: 'review_required' as const };
      }

      let startAt = 0;
      const scenes = blocks.map((block, index) => {
        const referencedFacts = facts.filter(fact => block.factIds.includes(fact.id));
        const words = block.text.trim().split(/\\s+/).filter(Boolean).length;
        const durationSeconds = Math.max(4, Math.min(45, Math.ceil(words / 2.5)));
        const scene = {
          schemaVersion: 1,
          kind: 'narration_fact_card',
          label: `Narration ${index + 1}`,
          startSeconds: startAt,
          durationSeconds,
          narrationText: block.text,
          factIds: block.factIds,
          factCards: referencedFacts.map(fact => ({
            id: fact.id,
            text: fact.text,
            source: fact.source,
            observedAt: fact.observedAt,
          })),
          visualTreatment: '2d_fact_card',
          assetReferences: [],
          syntheticVisuals: false,
          renderable: false,
        };
        startAt += durationSeconds;
        return { key: `scene-${index + 1}`, position: index, scene };
      });
      if (startAt > 1200) return { kind: 'too_long' as const };

      await tx`DELETE FROM public.factsport_tv_scenes WHERE episode_id = ${context.params.id}::uuid`;
      for (const item of scenes) {
        await tx`
          INSERT INTO public.factsport_tv_scenes (episode_id, scene_key, position, scene)
          VALUES (${context.params.id}::uuid, ${item.key}, ${item.position}, ${JSON.stringify(item.scene)}::jsonb)
        `;
      }
      const updated = await tx`
        UPDATE public.factsport_tv_episodes
        SET updated_by = ${authorization.user.domainUserId}::uuid, updated_at = now()
        WHERE id = ${context.params.id}::uuid
        RETURNING id, status, revision, updated_at
      `;
      await tx`
        INSERT INTO public.factsport_tv_audit_events (episode_id, actor_user_id, action, details)
        VALUES (
          ${context.params.id}::uuid, ${authorization.user.domainUserId}::uuid,
          'scene_saved',
          ${JSON.stringify({ sceneCount: scenes.length, scriptDigest: draft.digest, durationSeconds: startAt, renderable: false })}::jsonb
        )
      `;
      return { kind: 'ok' as const, episode: updated[0], scenes: scenes.map(item => ({ id: item.key, position: item.position, ...item.scene })) };
    }));

    if (result.kind === 'not_found') return NextResponse.json({ error: 'Episode not found.' }, { status: 404, headers: PRIVATE_HEADERS });
    if (result.kind === 'locked') return NextResponse.json({ error: 'This episode is not open for storyboard changes.' }, { status: 409, headers: PRIVATE_HEADERS });
    if (result.kind === 'stale') return NextResponse.json({ error: 'Episode changed while you were editing. Reload and try again.' }, { status: 409, headers: PRIVATE_HEADERS });
    if (result.kind === 'script_missing') return NextResponse.json({ error: 'Save an evidence-linked script draft before building a storyboard.' }, { status: 409, headers: PRIVATE_HEADERS });
    if (result.kind === 'script_invalid') return NextResponse.json({ error: 'The saved script evidence is no longer valid. Save the script again.' }, { status: 409, headers: PRIVATE_HEADERS });
    if (result.kind === 'review_required') return NextResponse.json({ error: 'A different editor must approve the current script before building its storyboard.' }, { status: 409, headers: PRIVATE_HEADERS });
    if (result.kind === 'too_long') return NextResponse.json({ error: 'Reduce the script duration before building a storyboard.' }, { status: 400, headers: PRIVATE_HEADERS });
    return NextResponse.json({
      success: true,
      episode: { id: result.episode.id, status: result.episode.status, revision: result.episode.revision, updatedAt: iso(result.episode.updated_at) },
      scenes: result.scenes,
      rightsCleared: false,
      renderQueued: false,
      publicationAllowed: false,
    }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error('Factsport TV storyboard build failed', error);
    return NextResponse.json({ error: 'TV storyboard could not be saved.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
