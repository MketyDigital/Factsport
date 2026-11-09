import { NextResponse } from 'next/server';
import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';
import { isSameOriginRequest } from '@/app/lib/admin/authorization';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';
import { factsportMediaBucket } from '@/lib/adapters/factsport-cloudflare-bindings';
import { isFactsportMediaDerivativesReady } from '@/lib/media/readiness';
import {
  EDITORIAL_IMAGE_EDITORIAL_IMAGE_MIME_TYPES,
  imageDimensions,
  MAX_EDITORIAL_IMAGE_BYTES,
  validImageSignature,
} from '@/lib/media/image-inspection';

export const runtime = 'edge';

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
    const assets = await withFactsportEditorialPostgres(async sql => {
      if (isFactsportMediaDerivativesReady()) {
        return sql`
          SELECT id, object_key, media_kind, content_type, byte_size, sha256,
                 width, height, alt_text, rights_status, rights_reference,
                 attribution_text, usage_expires_at, is_public, uploaded_by,
                 created_at, updated_at,
                 derivative.source_asset_id AS derived_from,
                 derivative.variant_key
          FROM public.media_assets
          LEFT JOIN LATERAL (
            SELECT source_asset_id, variant_key
            FROM public.media_asset_derivatives
            WHERE derivative_asset_id=media_assets.id
            LIMIT 1
          ) derivative ON true
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
        `;
      }
      return sql`
        SELECT id, object_key, media_kind, content_type, byte_size, sha256,
               width, height, alt_text, rights_status, rights_reference,
               attribution_text, usage_expires_at, is_public, uploaded_by,
               created_at, updated_at, NULL::uuid AS derived_from,
               NULL::text AS variant_key
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
      `;
    });
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
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_EDITORIAL_IMAGE_BYTES + 64 * 1024) {
    return NextResponse.json({ error: 'Upload request exceeds the 8 MB image limit.' }, { status: 413 });
  }

  let objectKey: string | null = null;
  try {
    const form = await request.formData();
    const file = form.get('file');
    const altText = typeof form.get('altText') === 'string' ? String(form.get('altText')).trim().slice(0, 500) : '';
    if (!(file instanceof File)) return NextResponse.json({ error: 'An image file is required.' }, { status: 400 });
    if (!EDITORIAL_IMAGE_MIME_TYPES.has(file.type) || file.size < 1 || file.size > MAX_EDITORIAL_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Upload a JPEG, PNG or WebP image up to 8 MB.' }, { status: 400 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!validImageSignature(file.type, bytes)) return NextResponse.json({ error: 'The file contents do not match the declared image type.' }, { status: 400 });
    const dimensions = imageDimensions(file.type, bytes);
    if (!dimensions) return NextResponse.json({ error: 'The image header is invalid or its dimensions exceed the 8-megapixel safety limit.' }, { status: 400 });
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
