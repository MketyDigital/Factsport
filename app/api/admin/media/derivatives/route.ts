import { NextResponse } from 'next/server';
import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';
import { isSameOriginRequest } from '@/app/lib/admin/authorization';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';
import { factsportMediaBucket } from '@/lib/adapters/factsport-cloudflare-bindings';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 8 * 1024 * 1024;
const PRESETS = {
  hero_16_9: { width: 1600, height: 900 },
  social_square: { width: 1200, height: 1200 },
  thumbnail_4_3: { width: 800, height: 600 },
  team_square: { width: 512, height: 512 },
} as const;

function webpDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 25 ||
      String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== 'RIFF' ||
      String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) !== 'WEBP') return null;
  const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  let width = 0;
  let height = 0;
  if (chunk === 'VP8X' && bytes.length >= 30) {
    width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
    height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
  } else if (chunk === 'VP8 ' && bytes.length >= 30 &&
      bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    width = (bytes[26] | (bytes[27] << 8)) & 0x3fff;
    height = (bytes[28] | (bytes[29] << 8)) & 0x3fff;
  } else if (chunk === 'VP8L' && bytes.length >= 25 && bytes[20] === 0x2f) {
    width = 1 + bytes[21] + ((bytes[22] & 0x3f) << 8);
    height = 1 + ((bytes[22] >> 6) | (bytes[23] << 2) | ((bytes[24] & 0x0f) << 10));
  }
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
      width < 1 || height < 1 || width > 8192 || height > 8192 || width * height > 40000000) return null;
  return { width, height };
}

export async function POST(request: Request) {
  const authorization = await authorizeMediaEditorialAction('media');
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Same-origin request required.' }, { status: 403 });
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_BYTES + 32 * 1024) {
    return NextResponse.json({ error: 'Derivative upload exceeds the 8 MB limit.' }, { status: 413 });
  }

  let objectKey: string | null = null;
  try {
    const form = await request.formData();
    const file = form.get('file');
    const sourceAssetId = String(form.get('sourceAssetId') || '');
    const variantKey = String(form.get('variantKey') || '') as keyof typeof PRESETS;
    const focusX = Number(form.get('focusX'));
    const focusY = Number(form.get('focusY'));
    if (!(file instanceof File) || file.type !== 'image/webp' || file.size < 1 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Create a WebP derivative no larger than 8 MB.' }, { status: 400 });
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sourceAssetId) ||
        !Object.prototype.hasOwnProperty.call(PRESETS, variantKey) ||
        !Number.isInteger(focusX) || focusX < 0 || focusX > 100 ||
        !Number.isInteger(focusY) || focusY < 0 || focusY > 100) {
      return NextResponse.json({ error: 'Invalid source asset or crop settings.' }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const dimensions = webpDimensions(bytes);
    const expected = PRESETS[variantKey];
    if (!dimensions || dimensions.width !== expected.width || dimensions.height !== expected.height) {
      return NextResponse.json({ error: 'Derivative dimensions do not match the selected preset.' }, { status: 400 });
    }
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const sha256 = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');

    const source = await withFactsportEditorialPostgres(async sql => {
      const rows = await sql`
        SELECT id, rights_status, rights_reference, attribution_text, alt_text,
               usage_expires_at, rights_reviewed_by, rights_reviewed_at
        FROM public.media_assets
        WHERE id=${sourceAssetId}::uuid AND media_kind='image'
        LIMIT 1
      `;
      return rows[0] || null;
    });
    if (!source ||
        !['owned', 'licensed', 'editorial_exception'].includes(source.rights_status) ||
        !source.rights_reviewed_by || !source.rights_reviewed_at ||
        (source.usage_expires_at && new Date(source.usage_expires_at).valueOf() <= Date.now())) {
      return NextResponse.json({ error: 'Only currently rights-approved source images can be transformed.' }, { status: 409 });
    }

    objectKey = 'editorial/derived/' + crypto.randomUUID().replace(/-/g, '');
    const actorId = authorization.user.domainUserId;
    await factsportMediaBucket().put(objectKey, bytes.buffer as ArrayBuffer, {
      httpMetadata: { contentType: 'image/webp', cacheControl: 'private, no-store' },
      customMetadata: {
        sha256, uploadedBy: actorId, sourceAssetId, variantKey,
        width: String(dimensions.width), height: String(dimensions.height),
      },
    });

    const asset = await withFactsportEditorialPostgres(async sql => sql.begin(async tx => {
      const lockedSources = await tx`
        SELECT id, rights_status, rights_reference, attribution_text, alt_text,
               usage_expires_at, rights_reviewed_by, rights_reviewed_at
        FROM public.media_assets
        WHERE id=${sourceAssetId}::uuid AND media_kind='image'
        FOR SHARE
      `;
      const lockedSource = lockedSources[0];
      if (!lockedSource ||
          !['owned', 'licensed', 'editorial_exception'].includes(lockedSource.rights_status) ||
          !lockedSource.rights_reviewed_by || !lockedSource.rights_reviewed_at ||
          (lockedSource.usage_expires_at && new Date(lockedSource.usage_expires_at).valueOf() <= Date.now())) {
        throw new Error('Source rights changed before the derivative could be committed.');
      }
      const inserted = await tx`
        INSERT INTO public.media_assets (
          object_key, media_kind, content_type, byte_size, sha256, width, height, alt_text,
          rights_status, rights_reference, attribution_text, usage_expires_at,
          rights_reviewed_by, rights_reviewed_at, is_public, uploaded_by
        ) VALUES (
          ${objectKey}, 'image', 'image/webp', ${file.size}, ${sha256},
          ${dimensions.width}, ${dimensions.height}, ${lockedSource.alt_text},
          ${lockedSource.rights_status}, ${lockedSource.rights_reference}, ${lockedSource.attribution_text},
          ${lockedSource.usage_expires_at}, ${lockedSource.rights_reviewed_by}::uuid,
          ${lockedSource.rights_reviewed_at}, false, ${actorId}::uuid
        ) RETURNING id, object_key, rights_status
      `;
      const transformSpec = {
        version: 1, fit: 'cover', focusX, focusY,
        output: { ...expected, format: 'image/webp', quality: 88 },
      };
      await tx`
        INSERT INTO public.media_asset_derivatives
          (source_asset_id, derivative_asset_id, variant_key, transform_spec, created_by)
        VALUES (
          ${sourceAssetId}::uuid, ${inserted[0].id}::uuid, ${variantKey},
          ${JSON.stringify(transformSpec)}::jsonb, ${actorId}::uuid
        )
      `;
      await tx`
        INSERT INTO public.media_editorial_audit_events (actor_user_id, action, details)
        VALUES (
          ${actorId}::uuid, 'media_derivative_created',
          ${JSON.stringify({ sourceAssetId, derivativeAssetId: inserted[0].id, variantKey, dimensions, focusX, focusY, sha256 })}::jsonb
        )
      `;
      return inserted[0];
    }));
    return NextResponse.json({ success: true, asset }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (objectKey) {
      try { await factsportMediaBucket().delete(objectKey); } catch (cleanupError) {
        console.error('Orphaned editorial derivative requires cleanup', cleanupError);
      }
    }
    console.error('Editorial media derivative creation failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create media derivative.' }, {
      status: 400, headers: { 'Cache-Control': 'private, no-store' },
    });
  }
}
