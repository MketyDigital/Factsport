import { NextResponse } from 'next/server';
import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';
import { isSameOriginRequest } from '@/app/lib/admin/authorization';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const BLOCK_ID = /^[A-Za-z0-9_-]{1,80}$/;
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
const EDITABLE_STATUSES = new Set(['blocked_rights', 'needs_data', 'script_draft', 'revision_requested']);

type EvidenceFact = { id: string; text: string; source: string; observedAt: string; verified: boolean };
type ScriptBlock = { id: string; text: string; factIds: string[] };

function iso(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(date.getTime())) throw new Error('tv_episode_timestamp_invalid');
  return date.toISOString();
}

function factsFromSnapshot(snapshot: unknown): EvidenceFact[] {
  if (!snapshot || typeof snapshot !== 'object') return [];
  const plan = (snapshot as { storyPlan?: { facts?: unknown } }).storyPlan;
  if (!plan || !Array.isArray(plan.facts)) return [];
  return plan.facts.filter((fact): fact is EvidenceFact => Boolean(
    fact && typeof fact === 'object' &&
    typeof (fact as EvidenceFact).id === 'string' &&
    typeof (fact as EvidenceFact).text === 'string' &&
    typeof (fact as EvidenceFact).source === 'string' &&
    typeof (fact as EvidenceFact).observedAt === 'string' &&
    (fact as EvidenceFact).verified === true
  ));
}

function cleanBlocks(value: unknown, facts: EvidenceFact[]): ScriptBlock[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 40) throw new Error('tv_script_blocks_invalid');
  const factIds = new Set(facts.map(fact => fact.id));
  const seen = new Set<string>();
  let totalCharacters = 0;
  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object') throw new Error('tv_script_block_invalid');
    const text = typeof (entry as { text?: unknown }).text === 'string'
      ? (entry as { text: string }).text.trim().replace(/\s+/g, ' ')
      : '';
    const rawId = (entry as { id?: unknown }).id;
    const id = typeof rawId === 'string' && BLOCK_ID.test(rawId) ? rawId : `block-${index + 1}`;
    const refs = (entry as { factIds?: unknown }).factIds;
    if (!text || text.length > 1200 || /[<>\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text) || /-->/.test(text)) {
      throw new Error('tv_script_text_invalid');
    }
    if (seen.has(id)) throw new Error('tv_script_block_id_duplicate');
    seen.add(id);
    if (!Array.isArray(refs) || refs.length < 1 || refs.length > 8 ||
        refs.some(ref => typeof ref !== 'string' || !factIds.has(ref))) {
      throw new Error('tv_script_evidence_required');
    }
    totalCharacters += text.length;
    if (totalCharacters > 10000) throw new Error('tv_script_too_long');
    return { id, text, factIds: Array.from(new Set(refs as string[])) };
  });
}

function publicEpisode(row: Record<string, unknown>) {
  const facts = factsFromSnapshot(row.snapshot);
  const content = row.editorial_content && typeof row.editorial_content === 'object'
    ? row.editorial_content as Record<string, unknown>
    : {};
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    revision: row.revision,
    sourceDigest: row.source_digest,
    updatedAt: iso(row.updated_at),
    rights: (row.snapshot as { storyPlan?: { rights?: unknown } } | null)?.storyPlan?.rights ?? null,
    facts,
    scriptDraft: content.scriptDraft ?? null,
    scriptReview: content.scriptReview ?? null,
  };
}

export async function GET(_request: Request, context: { params: { id: string } }) {
  const authorization = await authorizeMediaEditorialAction('tv');
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status, headers: PRIVATE_HEADERS });
  if (!UUID.test(context.params.id)) return NextResponse.json({ error: 'Episode not found.' }, { status: 404, headers: PRIVATE_HEADERS });

  try {
    const rows = await withFactsportEditorialPostgres(sql => sql`
      SELECT id, title, status, revision, source_digest, updated_at, snapshot, editorial_content
      FROM public.factsport_tv_episodes WHERE id = ${context.params.id}::uuid LIMIT 1
    `);
    if (!rows[0]) return NextResponse.json({ error: 'Episode not found.' }, { status: 404, headers: PRIVATE_HEADERS });
    return NextResponse.json({ success: true, episode: publicEpisode(rows[0]) }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error('Factsport TV episode detail unavailable', error);
    return NextResponse.json({ error: 'TV episode details are not available.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}

/** Save original, evidence-linked narration notes. This does not clear rights or advance status. */
export async function PATCH(request: Request, context: { params: { id: string } }) {
  const authorization = await authorizeMediaEditorialAction('tv');
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status, headers: PRIVATE_HEADERS });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Same-origin request required.' }, { status: 403, headers: PRIVATE_HEADERS });
  if (!UUID.test(context.params.id)) return NextResponse.json({ error: 'Episode not found.' }, { status: 404, headers: PRIVATE_HEADERS });
  if (Number(request.headers.get('content-length') || 0) > 24 * 1024) {
    return NextResponse.json({ error: 'Script request is too large.' }, { status: 413, headers: PRIVATE_HEADERS });
  }

  let body: { expectedUpdatedAt?: unknown; blocks?: unknown };
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid_body');
    body = parsed as { expectedUpdatedAt?: unknown; blocks?: unknown };
  } catch {
    return NextResponse.json({ error: 'Valid script data is required.' }, { status: 400, headers: PRIVATE_HEADERS });
  }
  if (typeof body.expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(body.expectedUpdatedAt))) {
    return NextResponse.json({ error: 'Refresh the episode before saving this script.' }, { status: 400, headers: PRIVATE_HEADERS });
  }

  try {
    const saved = await withFactsportEditorialPostgres(sql => sql.begin(async tx => {
      const rows = await tx`
        SELECT id, status, updated_at, snapshot, editorial_content
        FROM public.factsport_tv_episodes WHERE id = ${context.params.id}::uuid FOR UPDATE
      `;
      const row = rows[0];
      if (!row) return { kind: 'not_found' as const };
      if (!EDITABLE_STATUSES.has(String(row.status))) return { kind: 'locked' as const };
      const currentUpdatedAt = iso(row.updated_at);
      if (currentUpdatedAt !== new Date(body.expectedUpdatedAt as string).toISOString()) return { kind: 'stale' as const };

      const facts = factsFromSnapshot(row.snapshot);
      const blocks = cleanBlocks(body.blocks, facts);
      const digestBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(blocks)));
      const scriptDigest = Array.from(new Uint8Array(digestBytes), byte => byte.toString(16).padStart(2, '0')).join('');
      const content = row.editorial_content && typeof row.editorial_content === 'object'
        ? row.editorial_content as Record<string, unknown>
        : {};
      const scriptDraft = {
        blocks,
        digest: scriptDigest,
        savedAt: new Date().toISOString(),
        savedBy: authorization.user.domainUserId,
      };
      const updated = await tx`
        UPDATE public.factsport_tv_episodes
        SET editorial_content = ${JSON.stringify({ ...content, scriptDraft, scriptReview: null })}::jsonb,
            updated_by = ${authorization.user.domainUserId}::uuid,
            updated_at = now()
        WHERE id = ${context.params.id}::uuid
        RETURNING id, title, status, revision, source_digest, updated_at, snapshot, editorial_content
      `;
      await tx`
        INSERT INTO public.factsport_tv_audit_events (episode_id, actor_user_id, action, details)
        VALUES (
          ${context.params.id}::uuid, ${authorization.user.domainUserId}::uuid,
          'script_saved', ${JSON.stringify({ scriptDigest, blockCount: blocks.length })}::jsonb
        )
      `;
      return { kind: 'ok' as const, episode: publicEpisode(updated[0]) };
    }));

    if (saved.kind === 'not_found') return NextResponse.json({ error: 'Episode not found.' }, { status: 404, headers: PRIVATE_HEADERS });
    if (saved.kind === 'locked') return NextResponse.json({ error: 'This episode status does not allow script changes.' }, { status: 409, headers: PRIVATE_HEADERS });
    if (saved.kind === 'stale') return NextResponse.json({ error: 'Episode changed while you were editing. Reload and try again.' }, { status: 409, headers: PRIVATE_HEADERS });
    return NextResponse.json({ success: true, episode: saved.episode }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const validation = [
      'tv_script_blocks_invalid', 'tv_script_block_invalid', 'tv_script_text_invalid',
      'tv_script_block_id_duplicate', 'tv_script_evidence_required', 'tv_script_too_long',
    ].includes(message);
    return NextResponse.json({ error: validation ? 'Each narration block must be plain text linked to verified source facts.' : 'TV script draft could not be saved.' }, {
      status: validation ? 400 : 503,
      headers: PRIVATE_HEADERS,
    });
  }
}
