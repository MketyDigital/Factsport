import { NextResponse } from 'next/server';
import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';
import { isSameOriginRequest } from '@/app/lib/admin/authorization';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
const DECISIONS = new Set(['cleared', 'restricted', 'revoked']);

function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max) : '';
}

function httpsUrl(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** Independent rights-admin decision. URLs are recorded as evidence; this endpoint never fetches them. */
export async function POST(request: Request, context: { params: { id: string } }) {
  const authorization = await authorizeMediaEditorialAction('rights_admin');
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status, headers: PRIVATE_HEADERS });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Same-origin request required.' }, { status: 403, headers: PRIVATE_HEADERS });
  if (Number(request.headers.get('content-length') || 0) > 8192) return NextResponse.json({ error: 'Rights review details are too large.' }, { status: 413, headers: PRIVATE_HEADERS });

  const id = context.params?.id || '';
  if (!UUID.test(id)) return NextResponse.json({ error: 'Model asset not found.' }, { status: 404, headers: PRIVATE_HEADERS });

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid body');
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'A rights decision is required.' }, { status: 400, headers: PRIVATE_HEADERS });
  }

  const decision = clean(body.decision, 20);
  const sourceUrl = clean(body.sourceUrl, 1000);
  const licenseName = clean(body.licenseName, 240);
  const licenseUrl = clean(body.licenseUrl, 1000);
  const notes = clean(body.notes, 2000);
  if (!DECISIONS.has(decision)) return NextResponse.json({ error: 'Choose cleared, restricted or revoked.' }, { status: 400, headers: PRIVATE_HEADERS });
  if (!httpsUrl(sourceUrl) || !httpsUrl(licenseUrl)) return NextResponse.json({ error: 'Rights evidence links must use HTTPS.' }, { status: 400, headers: PRIVATE_HEADERS });
  if (decision === 'cleared' && (!licenseName || (!sourceUrl && !licenseUrl) || notes.length < 12)) {
    return NextResponse.json({ error: 'To clear this asset, record the license name, a source or license evidence URL, and a review note of at least 12 characters.' }, { status: 400, headers: PRIVATE_HEADERS });
  }
  if (decision !== 'cleared' && notes.length < 8) {
    return NextResponse.json({ error: 'Add a short note explaining why this asset is restricted or revoked.' }, { status: 400, headers: PRIVATE_HEADERS });
  }

  try {
    const result = await withFactsportEditorialPostgres(sql => sql.begin(async tx => {
      const current = await tx`
        SELECT id, asset_kind, rights_status, provenance, created_by
        FROM public.factsport_tv_asset_library
        WHERE id = ${id}::uuid
        FOR UPDATE
      `;
      const asset = current[0] as {
        id: string; asset_kind: string; rights_status: string;
        provenance: Record<string, unknown>; created_by: string;
      } | undefined;
      if (!asset) return { kind: 'not_found' as const };
      if (asset.created_by === authorization.user.domainUserId) return { kind: 'same_reviewer' as const };
      if (asset.rights_status === 'revoked' && decision !== 'revoked') return { kind: 'revoked' as const };

      const rightsReview = {
        decision,
        reviewerUserId: authorization.user.domainUserId,
        reviewedAt: new Date().toISOString(),
        sourceUrl: sourceUrl || null,
        licenseName: licenseName || null,
        licenseUrl: licenseUrl || null,
        notes,
        evidenceWasFetched: false,
      };
      const updated = await tx`
        UPDATE public.factsport_tv_asset_library
        SET rights_status = ${decision},
            provenance = provenance || jsonb_build_object('rightsReview', ${JSON.stringify(rightsReview)}::jsonb),
            updated_at = now()
        WHERE id = ${id}::uuid
        RETURNING id, asset_kind, byte_size, sha256, rights_status, provenance, updated_at
      `;
      await tx`
        INSERT INTO public.factsport_tv_audit_events (episode_id, actor_user_id, action, details)
        VALUES (
          NULL,
          ${authorization.user.domainUserId}::uuid,
          'rights_changed',
          ${JSON.stringify({ assetId: id, assetKind: asset.asset_kind, priorStatus: asset.rights_status, decision, sourceUrl: sourceUrl || null, licenseUrl: licenseUrl || null })}::jsonb
        )
      `;
      return { kind: 'ok' as const, asset: updated[0] };
    }));

    if (result.kind === 'not_found') return NextResponse.json({ error: 'Model asset not found.' }, { status: 404, headers: PRIVATE_HEADERS });
    if (result.kind === 'same_reviewer') return NextResponse.json({ error: 'A different media admin must review the uploader’s asset.' }, { status: 409, headers: PRIVATE_HEADERS });
    if (result.kind === 'revoked') return NextResponse.json({ error: 'A revoked asset cannot be re-cleared. Upload a new version with fresh evidence.' }, { status: 409, headers: PRIVATE_HEADERS });
    return NextResponse.json({ success: true, asset: result.asset }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error('Factsport TV model rights review failed', error);
    return NextResponse.json({ error: 'The model rights decision could not be recorded.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
