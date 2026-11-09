import { NextResponse } from 'next/server';
import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';
import { isSameOriginRequest } from '@/app/lib/admin/authorization';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';
import { isFactsportMediaVideoSchemaReady } from '@/lib/media/readiness';
import {
  createFactsportStreamTusUpload,
  deleteFactsportStreamVideo,
  FACTSPORT_STREAM_MAX_UPLOAD_BYTES,
  isFactsportStreamVideoReady,
} from '@/lib/media/cloudflare-stream';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const VIDEO_CONTENT_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-matroska',
  'video/mpeg',
  'video/ogg',
  'video/x-msvideo',
  'video/x-flv',
  'video/mp2t',
  'video/3gpp',
  'video/mxf',
  'application/mxf',
]);

function decodeTusMetadataValue(value: string): string {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function readFactsportTusMetadata(request: Request) {
  const header = request.headers.get('upload-metadata') || '';
  if (!header || header.length > 8192) throw new Error('Invalid TUS metadata.');
  const metadata = new Map<string, string>();
  const allowedKeys = new Set([
    'filename', 'filetype', 'factsporttitle', 'factsportdescription',
    'factsportcontenttype', 'factsportmaxdurationseconds',
  ]);
  for (const part of header.split(',')) {
    const separator = part.indexOf(' ');
    if (separator <= 0) throw new Error('Invalid TUS metadata entry.');
    const key = part.slice(0, separator).trim().toLowerCase();
    const encoded = part.slice(separator + 1).trim();
    if (!allowedKeys.has(key) || metadata.has(key) || !encoded) {
      throw new Error('Unsupported TUS metadata entry.');
    }
    metadata.set(key, decodeTusMetadataValue(encoded));
  }
  return {
    title: metadata.get('factsporttitle') || '',
    description: metadata.get('factsportdescription') || '',
    contentType: metadata.get('factsportcontenttype') || metadata.get('filetype') || '',
    maxDurationSeconds: Number(metadata.get('factsportmaxdurationseconds') || 900),
  };
}

export async function POST(request: Request) {
  const authorization = await authorizeMediaEditorialAction('media');
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, {
    status: authorization.status, headers: { 'Cache-Control': 'private, no-store' },
  });
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Same-origin request required.' }, { status: 403 });
  }
  if (request.headers.get('tus-resumable') !== '1.0.0') {
    return NextResponse.json({ error: 'Tus-Resumable 1.0.0 is required.' }, { status: 412 });
  }
  if (!isFactsportMediaVideoSchemaReady()) {
    return NextResponse.json({ error: 'Video schema migration is not enabled.' }, {
      status: 503, headers: { 'Cache-Control': 'private, no-store' },
    });
  }
  if (!isFactsportStreamVideoReady()) {
    return NextResponse.json({ error: 'Cloudflare Stream VOD is not provisioned for this environment.' }, {
      status: 503, headers: { 'Cache-Control': 'private, no-store' },
    });
  }

  if (Number(request.headers.get('content-length') || 0) > 0) {
    return NextResponse.json({ error: 'TUS creation requests must not include a file body.' }, { status: 400 });
  }
  const fileSizeBytes = Number(request.headers.get('upload-length'));
  let metadata: ReturnType<typeof readFactsportTusMetadata>;
  try { metadata = readFactsportTusMetadata(request); } catch {
    return NextResponse.json({ error: 'Invalid resumable upload metadata.' }, { status: 400 });
  }
  const title = metadata.title.trim();
  const description = metadata.description.trim();
  const contentType = metadata.contentType.trim().toLowerCase();
  const maxDurationSeconds = metadata.maxDurationSeconds;

  if (!Number.isSafeInteger(fileSizeBytes) || fileSizeBytes < 1 ||
      fileSizeBytes >= FACTSPORT_STREAM_MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'Resumable video uploads must be between 1 byte and 30 GB.' }, { status: 413 });
  }
  if (title.length < 3 || title.length > 200 || description.length > 3000 ||
      !VIDEO_CONTENT_TYPES.has(contentType) ||
      !Number.isInteger(maxDurationSeconds) || maxDurationSeconds < 1 || maxDurationSeconds > 900) {
    return NextResponse.json({ error: 'A valid title, supported video type and duration up to 900 seconds are required.' }, { status: 400 });
  }

  let streamUid = '';
  try {
    const assetId = crypto.randomUUID();
    const directUpload = await createFactsportStreamTusUpload({
      assetId, title, creatorId: authorization.user.domainUserId,
      fileSizeBytes, maxDurationSeconds,
    });
    streamUid = directUpload.uid;

    await withFactsportEditorialPostgres(sql => sql.begin(async tx => {
      await tx`
        INSERT INTO public.media_video_assets (
          id, provider, provider_video_id, title, description,
          upload_status, upload_protocol, upload_expected_size_bytes,
          upload_expires_at, uploaded_by
        ) VALUES (
          ${assetId}::uuid, 'cloudflare_stream', ${directUpload.uid},
          ${title}, ${description || null}, 'pending_upload', 'tus',
          ${fileSizeBytes}, ${directUpload.expiresAt}::timestamptz,
          ${authorization.user.domainUserId}::uuid
        )
      `;
      await tx`
        INSERT INTO public.media_editorial_audit_events (actor_user_id, action, details)
        VALUES (
          ${authorization.user.domainUserId}::uuid, 'media_video_tus_upload_started',
          ${JSON.stringify({
            assetId, provider: 'cloudflare_stream', uploadProtocol: 'tus',
            fileSizeBytes, maxDurationSeconds,
          })}::jsonb
        )
      `;
    }));

    return new Response(null, {
      status: 201,
      headers: {
        'Tus-Resumable': '1.0.0',
        Location: directUpload.uploadURL,
        'X-Factsport-Video-Asset-Id': assetId,
        'X-Factsport-Upload-Expires-At': directUpload.expiresAt,
        'Cache-Control': 'private, no-store',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch {
    if (streamUid) {
      try { await deleteFactsportStreamVideo(streamUid); } catch { /* cleanup is best effort */ }
    }
    return NextResponse.json({ error: 'Unable to create the resumable video upload.' }, {
      status: 503, headers: { 'Cache-Control': 'private, no-store' },
    });
  }
}
