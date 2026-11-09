import { NextResponse } from 'next/server';
import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';
import { isSameOriginRequest } from '@/app/lib/admin/authorization';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';
import { factsportMediaBucket } from '@/lib/adapters/factsport-cloudflare-bindings';

export const runtime = 'edge';

const MAX_BYTES = 8 * 1024 * 1024;
const MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function validImageSignature(type: string, bytes: Uint8Array) {
  if (type === 'image/png') return bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  if (type === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/webp') return bytes.length >= 12 &&
    String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === 'RIFF' &&
    String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === 'WEBP';
  return false;
}

function imageDimensions(type: string, bytes: Uint8Array): { width: number; height: number } | null {
  let width = 0;
  let height = 0;
  if (type === 'image/png' && bytes.length >= 24 &&
      String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]) === 'IHDR') {
    width = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(16, false);
    height = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(20, false);
  } else if (type === 'image/jpeg') {
    let offset = 2;
    const frameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
    while (offset + 4 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      while (bytes[offset] === 0xff) offset += 1;
      const marker = bytes[offset++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
      if (offset + 2 > bytes.length) break;
      const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
      if (segmentLength < 2 || offset + segmentLength > bytes.length) break;
      if (frameMarkers.has(marker) && segmentLength >= 7) {
        height = (bytes[offset + 3] << 8) | bytes[offset + 4];
        width = (bytes[offset + 5] << 8) | bytes[offset + 6];
        break;
      }
      offset += segmentLength;
    }
  } else if (type === 'image/webp' && bytes.length >= 25) {
    const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
    if (chunk === 'VP8X' && bytes.length >= 30) {
      width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
      height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
    } else if (chunk === 'VP8 ' && bytes.length >= 30 &&
      bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
      width = ((bytes[26] | (bytes[27] << 8)) & 0x3fff);
      height = ((bytes[28] | (bytes[29] << 8)) & 0x3fff);
    } else if (chunk === 'VP8L' && bytes.length >= 25 && bytes[20] === 0x2f) {
      width = 1 + bytes[21] + ((bytes[22] & 0x3f) << 8);
      height = 1 + ((bytes[22] >> 6) | (bytes[23] << 2) | ((bytes[24] & 0x0f) << 10));
    }
  }
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
      width < 1 || height < 1 || width > 16000 || height > 16000 || width * height > 40000000) {
    return null;
  }
  return { width, height };
}

export async function GET(request: Request) {
  const authorization = await authorizeMediaEditorialAction('media');
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, {
      status: authorization.status,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get('q') || '').trim().replace(/[%_\\]/g, '').slice(0, 100);
  const requestedStatus = url.searchParams.get('status') || 'all';
  const allowedStatuses = new Set(['all', 'pending', 'owned', 'licensed', 'editorial_exception', 'rejected', 'expired']);
  const status = allowedStatuses.has(requestedStatus) ? requestedStatus : 'all';
  const rawOffset = Number(url.searchParams.get('offset') || '0');
  const offset = Number.isInteger(rawOffset) ? Math.max(0, Math.min(rawOffset, 5000)) : 0;
  const limit = 50;

  try {
    const assets = await withFactsportEditorialPostgres(async sql => sql`
      SELECT id, object_key, media_kind, content_type, byte_size, sha256,
             width, height, alt_text, rights_status, rights_reference,
             attribution_text, usage_expires_at, is_public, uploaded_by,
             created_at, updated_at
      FROM public.media_assets
      WHERE media_kind = 'image'
        AND (${status} = 'all' OR rights_status = ${status})
        AND (
          ${query} = ''
          OR object_key ILIKE ${'%' + query + '%'}
          OR COALESCE(alt_text, '') ILIKE ${'%' + query + '%'}
          OR COALESCE(attribution_text, '') ILIKE ${'%' + query + '%'}
        )
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit + 1} OFFSET ${offset}
    `);
    const hasMore = assets.length > limit;
    return NextResponse.json({
      success: true,
      assets: assets.slice(0, limit),
      page: { offset, limit, hasMore, nextOffset: hasMore ? offset + limit : null },
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Editorial media library unavailable', error);
    return NextResponse.json({ error: 'Editorial media library is not connected.' }, {
      status: 503,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeMediaEditorialAction('media');
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Same-origin request required.' }, { status: 403 });

  let objectKey: string | null = null;
  try {
    const form = await request.formData();
    const file = form.get('file');
    const altText = typeof form.get('altText') === 'string' ? String(form.get('altText')).trim().slice(0, 500) : '';
    if (!(file instanceof File)) return NextResponse.json({ error: 'An image file is required.' }, { status: 400 });
    if (!MIME_TYPES.has(file.type) || file.size < 1 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Upload a JPEG, PNG or WebP image up to 8 MB.' }, { status: 400 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!validImageSignature(file.type, bytes)) return NextResponse.json({ error: 'The file contents do not match the declared image type.' }, { status: 400 });
    const dimensions = imageDimensions(file.type, bytes);
    if (!dimensions) return NextResponse.json({ error: 'The image header is invalid or its dimensions exceed the 40-megapixel safety limit.' }, { status: 400 });
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const sha256 = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
    objectKey = `editorial/${crypto.randomUUID().replace(/-/g, '')}`;

    const actorId = authorization.user.domainUserId;
    const bucket = factsportMediaBucket();
    await bucket.put(objectKey, bytes.buffer as ArrayBuffer, {
      httpMetadata: { contentType: file.type, cacheControl: 'private, no-store' },
      customMetadata: { sha256, uploadedBy: actorId, width: String(dimensions.width), height: String(dimensions.height) },
    });

    const asset = await withFactsportEditorialPostgres(async sql => sql.begin(async tx => {
      const rows = await tx`
        INSERT INTO public.media_assets (
          object_key, media_kind, content_type, byte_size, sha256, width, height, alt_text,
          rights_status, is_public, uploaded_by
        ) VALUES (
          ${objectKey}, 'image', ${file.type}, ${file.size}, ${sha256}, ${dimensions.width}, ${dimensions.height},
          ${altText || null}, 'pending', false, ${actorId}::uuid
        ) RETURNING id, object_key, rights_status
      `;
      await tx`
        INSERT INTO public.media_editorial_audit_events (actor_user_id, action, details)
        VALUES (
          ${actorId}::uuid, 'media_uploaded',
          ${JSON.stringify({ assetId: rows[0].id, objectKey, contentType: file.type, byteSize: file.size, sha256 })}::jsonb
        )
      `;
      return rows[0];
    }));
    return NextResponse.json({ success: true, asset });
  } catch (error) {
    if (objectKey) {
      try { await factsportMediaBucket().delete(objectKey); } catch (cleanupError) {
        console.error('Orphaned editorial R2 upload requires cleanup', cleanupError);
      }
    }
    console.error('Editorial media upload failed', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unable to upload editorial media.',
    }, { status: 400 });
  }
}
