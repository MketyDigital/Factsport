import { NextResponse } from 'next/server';
import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';
import { isSameOriginRequest } from '@/app/lib/admin/authorization';
import { factsportMediaBucket } from '@/lib/adapters/factsport-cloudflare-bindings';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PART_BYTES = 16 * 1024 * 1024;
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };

export async function PUT(request: Request, context: { params: { id: string; partNumber: string } }) {
  const authorization = await authorizeMediaEditorialAction('tv');
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status, headers: PRIVATE_HEADERS });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Same-origin request required.' }, { status: 403, headers: PRIVATE_HEADERS });

  const id = context.params?.id || '';
  const partNumber = Number(context.params?.partNumber);
  if (!UUID.test(id) || !Number.isSafeInteger(partNumber) || partNumber < 1 || partNumber > 32) {
    return NextResponse.json({ error: 'Upload part not found.' }, { status: 404, headers: PRIVATE_HEADERS });
  }
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (!Number.isSafeInteger(contentLength) || contentLength < 1 || contentLength > MAX_PART_BYTES || !request.body) {
    return NextResponse.json({ error: 'Each upload part must be between 1 byte and 16 MiB.' }, { status: 413, headers: PRIVATE_HEADERS });
  }

  let session: { object_key: string; r2_upload_id: string; expected_size: number; part_size: number; expected_part_count: number; status: string } | undefined;
  try {
    const rows = await withFactsportEditorialPostgres(sql => sql`
      SELECT object_key, r2_upload_id, expected_size, part_size, expected_part_count, status
      FROM public.factsport_tv_model_upload_sessions
      WHERE id = ${id}::uuid AND created_by = ${authorization.user.domainUserId}::uuid
        AND expires_at > now()
      LIMIT 1
    `);
    session = rows[0] as typeof session;
    if (!session) return NextResponse.json({ error: 'Upload session not found or expired.' }, { status: 404, headers: PRIVATE_HEADERS });
    if (session.status !== 'uploading') return NextResponse.json({ error: 'This upload is no longer accepting parts.' }, { status: 409, headers: PRIVATE_HEADERS });
    if (partNumber > session.expected_part_count) return NextResponse.json({ error: 'Part number exceeds this upload session.' }, { status: 400, headers: PRIVATE_HEADERS });
    const offset = (partNumber - 1) * session.part_size;
    const expectedBytes = Math.min(session.part_size, session.expected_size - offset);
    if (contentLength !== expectedBytes) return NextResponse.json({ error: 'The part byte length does not match the expected range.' }, { status: 400, headers: PRIVATE_HEADERS });

    const bytes = await request.arrayBuffer();
    if (bytes.byteLength !== expectedBytes) return NextResponse.json({ error: 'The received part is incomplete.' }, { status: 400, headers: PRIVATE_HEADERS });
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    const upload = factsportMediaBucket().resumeMultipartUpload(session.object_key, session.r2_upload_id);
    const part = await upload.uploadPart(partNumber, bytes);
    await withFactsportEditorialPostgres(sql => sql`
      INSERT INTO public.factsport_tv_model_upload_parts (session_id, part_number, byte_size, etag, sha256)
      VALUES (${id}::uuid, ${partNumber}, ${expectedBytes}, ${part.etag}, ${sha256})
      ON CONFLICT (session_id, part_number) DO UPDATE
      SET byte_size = EXCLUDED.byte_size, etag = EXCLUDED.etag,
          sha256 = EXCLUDED.sha256, uploaded_at = now()
    `);
    return NextResponse.json({ success: true, partNumber, byteSize: expectedBytes }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error('Factsport TV multipart part upload failed', error);
    return NextResponse.json({ error: 'This model part could not be saved. Retry this part; completed parts are retained.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
