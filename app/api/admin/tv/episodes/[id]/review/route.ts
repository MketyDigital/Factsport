import { NextResponse } from 'next/server';
import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';
import { isSameOriginRequest } from '@/app/lib/admin/authorization';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };

/** Independent editorial review of a saved script; rights and publishing remain separate. */
export async function POST(request: Request, context: { params: { id: string } }) {
  const authorization = await authorizeMediaEditorialAction('review');
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status, headers: PRIVATE_HEADERS });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Same-origin request required.' }, { status: 403, headers: PRIVATE_HEADERS });
  if (!UUID.test(context.params.id)) return NextResponse.json({ error: 'Episode not found.' }, { status: 404, headers: PRIVATE_HEADERS });
  if (Number(request.headers.get('content-length') || 0) > 4096) return NextResponse.json({ error: 'Review request is too large.' }, { status: 413, headers: PRIVATE_HEADERS });

  let body: { expectedUpdatedAt?: unknown; decision?: unknown; notes?: unknown };
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid_body');
    body = parsed as { expectedUpdatedAt?: unknown; decision?: unknown; notes?: unknown };
  } catch {
    return NextResponse.json({ error: 'Valid review data is required.' }, { status: 400, headers: PRIVATE_HEADERS });
  }
  if (typeof body.expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(body.expectedUpdatedAt)) ||
      !['approved', 'changes_requested'].includes(String(body.decision))) {
    return NextResponse.json({ error: 'Choose an editorial review decision and reload the episode before saving.' }, { status: 400, headers: PRIVATE_HEADERS });
  }
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
  if (notes.length > 2000) return NextResponse.json({ error: 'Review notes are too long.' }, { status: 400, headers: PRIVATE_HEADERS });

  try {
    const result = await withFactsportEditorialPostgres(sql => sql.begin(async tx => {
      const rows = await tx`
        SELECT id, status, revision, updated_at, editorial_content
        FROM public.factsport_tv_episodes WHERE id = ${context.params.id}::uuid FOR UPDATE
      `;
      const row = rows[0];
      if (!row) return { kind: 'not_found' as const };
      if (!['blocked_rights', 'needs_data', 'script_draft', 'revision_requested', 'editorial_review'].includes(String(row.status))) {
        return { kind: 'locked' as const };
      }
      if (new Date(body.expectedUpdatedAt as string).toISOString() !==
          (row.updated_at instanceof Date ? row.updated_at.toISOString() : new Date(row.updated_at).toISOString())) {
        return { kind: 'stale' as const };
      }
      const content = row.editorial_content && typeof row.editorial_content === 'object'
        ? row.editorial_content as Record<string, unknown>
        : {};
      const draft = content.scriptDraft as { blocks?: unknown; savedBy?: unknown; digest?: unknown } | undefined;
      if (!draft || !Array.isArray(draft.blocks) || draft.blocks.length < 1 || typeof draft.digest !== 'string') {
        return { kind: 'script_missing' as const };
      }
      if (draft.savedBy === authorization.user.domainUserId) return { kind: 'self_review' as const };

      const decision = body.decision as 'approved' | 'changes_requested';
      const review = {
        decision,
        notes,
        scriptDigest: draft.digest,
        reviewedAt: new Date().toISOString(),
        reviewedBy: authorization.user.domainUserId,
      };
      await tx`
        INSERT INTO public.factsport_tv_approvals
          (episode_id, revision, gate, decision, actor_user_id, notes, evidence)
        VALUES (
          ${context.params.id}::uuid, ${row.revision}, 'editorial', ${decision},
          ${authorization.user.domainUserId}::uuid, ${notes},
          ${JSON.stringify({ scriptDigest: draft.digest })}::jsonb
        )
      `;
      const updated = await tx`
        UPDATE public.factsport_tv_episodes
        SET editorial_content = ${JSON.stringify({ ...content, scriptReview: review })}::jsonb,
            updated_by = ${authorization.user.domainUserId}::uuid,
            updated_at = now()
        WHERE id = ${context.params.id}::uuid
        RETURNING id, status, updated_at
      `;
      await tx`
        INSERT INTO public.factsport_tv_audit_events (episode_id, actor_user_id, action, details)
        VALUES (
          ${context.params.id}::uuid, ${authorization.user.domainUserId}::uuid,
          'approval_recorded', ${JSON.stringify({ gate: 'editorial', decision, scriptDigest: draft.digest })}::jsonb
        )
      `;
      return { kind: 'ok' as const, review, episode: updated[0] };
    }));

    if (result.kind === 'not_found') return NextResponse.json({ error: 'Episode not found.' }, { status: 404, headers: PRIVATE_HEADERS });
    if (result.kind === 'locked') return NextResponse.json({ error: 'This episode is not open for script review.' }, { status: 409, headers: PRIVATE_HEADERS });
    if (result.kind === 'stale') return NextResponse.json({ error: 'Episode changed while you were reviewing. Reload and try again.' }, { status: 409, headers: PRIVATE_HEADERS });
    if (result.kind === 'script_missing') return NextResponse.json({ error: 'Save an evidence-linked script draft before review.' }, { status: 409, headers: PRIVATE_HEADERS });
    if (result.kind === 'self_review') return NextResponse.json({ error: 'A different editor must review this script draft.' }, { status: 403, headers: PRIVATE_HEADERS });
    return NextResponse.json({
      success: true,
      review: result.review,
      episode: { id: result.episode.id, status: result.episode.status, updatedAt: result.episode.updated_at },
      rightsCleared: false,
      publicationAllowed: false,
    }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error('Factsport TV script review failed', error);
    return NextResponse.json({ error: 'TV script review could not be saved.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
