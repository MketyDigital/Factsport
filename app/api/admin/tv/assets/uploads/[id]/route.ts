import { NextResponse } from 'next/server';
import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';
import { isSameOriginRequest } from '@/app/lib/admin/authorization';
import { factsportMediaBucket } from '@/lib/adapters/factsport-cloudflare-bindings';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };

export async function GET(_request: Request, context: { params: { id: string } }) {
  const authorization = await authorizeMediaEditorialAction('tv');
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status, headers: PRIVATE_HEADERS });
  const id = context.params?.id || '';
  if (!UUID.test(id)) return NextResponse.json({ error: 'Upload session not found.' }, { status: 404, headers: PRIVATE_HEADERS });
  try {
    const rows = await withFactsportEditorialPostgres(sql => sql`
      SELECT session.id, session.expected_size, session.part_size, session.expected_part_count,
             session.original_filename, session.status, session.asset_id, session.expires_at,
             COALESCE(jsonb_agg(jsonb_build_object('partNumber', part.part_number, 'byteSize', part.byte_size)
               ORDER BY part.part_number) FILTER (WHERE part.part_number IS NOT NULL), '[]'::jsonb) AS uploaded_parts
      FROM public.factsport_tv_model_upload_sessions session
      LEFT JOIN public.factsport_tv_model_upload_parts part ON part.session_id = session.id
      WHERE session.id = ${id}::uuid AND session.created_by = ${authorization.user.domainUserId}::uuid
      GROUP BY session.id
      LIMIT 1
    `);
    if (!rows[0]) return NextResponse.json({ error: 'Upload session not found.' }, { status: 404, headers: PRIVATE_HEADERS });
    const session = rows[0] as { status?: string; asset_id?: string | null };
    const completedAssetId = typeof session.asset_id === 'string' ? session.asset_id : null;
    const asset = session.status === 'completed' && completedAssetId
      ? (await withFactsportEditorialPostgres(sql => sql`
          SELECT id, asset_kind, content_type, byte_size, sha256, rights_status, provenance, created_at
          FROM public.factsport_tv_asset_library WHERE id = ${completedAssetId}::uuid LIMIT 1
        `))[0]
      : null;
    return NextResponse.json({ success: true, session, asset: asset || undefined }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error('Factsport TV multipart model session lookup failed', error);
    return NextResponse.json({ error: 'Upload session status is unavailable.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}

export async function DELETE(request: Request, context: { params: { id: string } }) {
  const authorization = await authorizeMediaEditorialAction('tv');
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status, headers: PRIVATE_HEADERS });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Same-origin request required.' }, { status: 403, headers: PRIVATE_HEADERS });
  const id = context.params?.id || '';
  if (!UUID.test(id)) return NextResponse.json({ error: 'Upload session not found.' }, { status: 404, headers: PRIVATE_HEADERS });
  try {
    const rows = await withFactsportEditorialPostgres(sql => sql`
      SELECT object_key, r2_upload_id, status
      FROM public.factsport_tv_model_upload_sessions
      WHERE id = ${id}::uuid AND created_by = ${authorization.user.domainUserId}::uuid
      LIMIT 1
    `);
    const session = rows[0] as { object_key: string; r2_upload_id: string; status: string } | undefined;
    if (!session) return NextResponse.json({ error: 'Upload session not found.' }, { status: 404, headers: PRIVATE_HEADERS });
    if (session.status === 'completed') return NextResponse.json({ error: 'A completed model cannot be deleted from the upload session.' }, { status: 409, headers: PRIVATE_HEADERS });
    if (session.status === 'aborted' || session.status === 'failed') return NextResponse.json({ success: true }, { headers: PRIVATE_HEADERS });
    const bucket = factsportMediaBucket();
    try { await bucket.resumeMultipartUpload(session.object_key, session.r2_upload_id).abort(); } catch { /* R2 expires incomplete uploads automatically. */ }
    await withFactsportEditorialPostgres(sql => sql`
      UPDATE public.factsport_tv_model_upload_sessions
      SET status = 'aborted', updated_at = now()
      WHERE id = ${id}::uuid AND created_by = ${authorization.user.domainUserId}::uuid
        AND status <> 'completed'
    `);
    return NextResponse.json({ success: true }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error('Factsport TV multipart model upload cancellation failed', error);
    return NextResponse.json({ error: 'The model upload could not be cancelled.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
