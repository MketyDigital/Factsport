import { NextResponse } from 'next/server';
import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';
import { isSameOriginRequest } from '@/app/lib/admin/authorization';
import { factsportMediaBucket } from '@/lib/adapters/factsport-cloudflare-bindings';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_MODEL_BYTES = 512 * 1024 * 1024;
const PART_BYTES = 16 * 1024 * 1024;
const MAX_PARTS = 32;
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
const MODEL_KINDS = new Set(['stadium_environment', 'generic_player', 'football']);

function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max) : '';
}

function validOptionalUrl(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
}

type UploadSessionRow = {
  id: string; expected_size: number; part_size: number; expected_part_count: number;
  original_filename: string; status: string; asset_id: string | null; expires_at: string;
};

/** Start a private R2 multipart upload. The browser retains only the session ID; the R2 upload ID stays server-side. */
export async function POST(request: Request) {
  const authorization = await authorizeMediaEditorialAction('tv');
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status, headers: PRIVATE_HEADERS });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Same-origin request required.' }, { status: 403, headers: PRIVATE_HEADERS });
  if (Number(request.headers.get('content-length') || 0) > 16 * 1024) return NextResponse.json({ error: 'Model upload metadata is too large.' }, { status: 413, headers: PRIVATE_HEADERS });

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid body');
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Upload metadata is required.' }, { status: 400, headers: PRIVATE_HEADERS });
  }

  const episodeId = clean(body.episodeId, 50);
  const assetKind = clean(body.assetKind, 40);
  const originalFilename = clean(body.originalFilename, 180);
  const expectedSize = Number(body.fileSize);
  if (episodeId && !UUID.test(episodeId)) return NextResponse.json({ error: 'Episode not found.' }, { status: 404, headers: PRIVATE_HEADERS });
  if (!MODEL_KINDS.has(assetKind)) return NextResponse.json({ error: 'Choose a supported 3D model type.' }, { status: 400, headers: PRIVATE_HEADERS });
  if (!originalFilename.toLowerCase().endsWith('.glb') || !Number.isSafeInteger(expectedSize) || expectedSize < 20 || expectedSize > MAX_MODEL_BYTES) {
    return NextResponse.json({ error: 'Choose a .glb file between 20 bytes and 512 MiB.' }, { status: 400, headers: PRIVATE_HEADERS });
  }
  const partCount = Math.ceil(expectedSize / PART_BYTES);
  if (partCount < 1 || partCount > MAX_PARTS) return NextResponse.json({ error: 'The model is larger than the 512 MiB intake limit.' }, { status: 413, headers: PRIVATE_HEADERS });

  const sourceName = clean(body.sourceName, 240);
  const sourceUrl = clean(body.sourceUrl, 1000);
  const licenseName = clean(body.licenseName, 240);
  const licenseUrl = clean(body.licenseUrl, 1000);
  const attribution = clean(body.attribution, 1000);
  const submittedNotes = clean(body.notes, 2000);
  if (!validOptionalUrl(sourceUrl) || !validOptionalUrl(licenseUrl)) return NextResponse.json({ error: 'Source and license links must use HTTPS.' }, { status: 400, headers: PRIVATE_HEADERS });

  const id = crypto.randomUUID();
  const objectKey = `tv/models/${id}.glb`;
  const provenance = {
    sourceName: sourceName || 'Not provided; owner upload',
    sourceUrl: sourceUrl || null,
    licenseName: licenseName || 'Not provided; rights review required',
    licenseUrl: licenseUrl || null,
    attribution: attribution || null,
    submittedNotes: submittedNotes || null,
    submissionClaim: 'owner_submitted_unverified',
    verifiedByFactsport: false,
    originalFilename: originalFilename.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 180),
    gltfVersion: '2.0',
    uploadMode: 'r2_multipart',
  };

  let upload: Awaited<ReturnType<ReturnType<typeof factsportMediaBucket>['createMultipartUpload']>> | null = null;
  try {
    if (episodeId) {
      const episode = await withFactsportEditorialPostgres(sql => sql`SELECT id FROM public.factsport_tv_episodes WHERE id = ${episodeId}::uuid LIMIT 1`);
      if (!episode[0]) return NextResponse.json({ error: 'Episode not found.' }, { status: 404, headers: PRIVATE_HEADERS });
    }
    const bucket = factsportMediaBucket();
    upload = await bucket.createMultipartUpload(objectKey, {
      httpMetadata: { contentType: 'model/gltf-binary', cacheControl: 'private, no-store' },
    });
    await withFactsportEditorialPostgres(sql => sql`
      INSERT INTO public.factsport_tv_model_upload_sessions
        (id, created_by, episode_id, asset_kind, object_key, r2_upload_id,
         expected_size, part_size, expected_part_count, original_filename, provenance)
      VALUES (
        ${id}::uuid, ${authorization.user.domainUserId}::uuid,
        ${episodeId || null}::uuid, ${assetKind}, ${objectKey}, ${upload!.uploadId},
        ${expectedSize}, ${PART_BYTES}, ${partCount}, ${originalFilename.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 180)},
        ${JSON.stringify(provenance)}::jsonb
      )
    `);
    return NextResponse.json({
      success: true,
      sessionId: id,
      partSize: PART_BYTES,
      partCount,
      maxBytes: MAX_MODEL_BYTES,
      expiresInDays: 6,
      message: 'Private upload session created. Each 16 MiB part can retry independently; the asset stays rights-pending after completion.',
    }, { status: 201, headers: PRIVATE_HEADERS });
  } catch (error) {
    if (upload) {
      try { await upload.abort(); } catch { console.error('TV model upload session cleanup deferred to R2 expiry'); }
    }
    console.error('Factsport TV multipart model upload could not start', error);
    return NextResponse.json({ error: 'The resumable model upload could not be started.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}

export type { UploadSessionRow };
