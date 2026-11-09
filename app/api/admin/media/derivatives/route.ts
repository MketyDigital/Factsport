import { NextResponse } from 'next/server';
import { PhotonImage, SamplingFilter, crop, resize } from '@cf-wasm/photon/edge-light';
import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';
import { isSameOriginRequest } from '@/app/lib/admin/authorization';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';
import { factsportMediaBucket } from '@/lib/adapters/factsport-cloudflare-bindings';
import { isFactsportMediaDerivativesReady } from '@/lib/media/readiness';
import {
  EDITORIAL_IMAGE_MIME_TYPES,
  imageDimensions,
  MAX_EDITORIAL_IMAGE_BYTES,
  validImageSignature,
} from '@/lib/media/image-inspection';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const PRESETS = {
  hero_16_9: { width: 1600, height: 900 },
  social_square: { width: 1200, height: 1200 },
  thumbnail_4_3: { width: 800, height: 600 },
  team_square: { width: 512, height: 512 },
} as const;

const MAX_JSON_BYTES = 16 * 1024;

function cropRectangle(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  focusX: number,
  focusY: number,
) {
  const targetAspect = targetWidth / targetHeight;
  const sourceAspect = sourceWidth / sourceHeight;
  let width = sourceWidth;
  let height = sourceHeight;
  if (sourceAspect > targetAspect) {
    width = Math.max(1, Math.floor(sourceHeight * targetAspect));
  } else {
    height = Math.max(1, Math.floor(sourceWidth / targetAspect));
  }
  const x = Math.min(sourceWidth - width, Math.max(0, Math.round((sourceWidth - width) * focusX / 100)));
  const y = Math.min(sourceHeight - height, Math.max(0, Math.round((sourceHeight - height) * focusY / 100)));
  return { x, y, width, height };
}

async function sha256Hex(bytes: Uint8Array) {
  const digestInput = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  digestInput.set(bytes);
  const digest = await crypto.subtle.digest('SHA-256', digestInput);
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}

export async function POST(request: Request) {
  const authorization = await authorizeMediaEditorialAction('media');
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, {
    status: authorization.status, headers: { 'Cache-Control': 'private, no-store' },
  });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Same-origin request required.' }, {
    status: 403, headers: { 'Cache-Control': 'private, no-store' },
  });
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_JSON_BYTES) {
    return NextResponse.json({ error: 'Derivative request is too large.' }, {
      status: 413, headers: { 'Cache-Control': 'private, no-store' },
    });
  }
  if (!isFactsportMediaDerivativesReady()) {
    return NextResponse.json({ error: 'Media derivative schema is not enabled.' }, {
      status: 503, headers: { 'Cache-Control': 'private, no-store' },
    });
  }

  let objectKey: string | null = null;
  let sourceImage: PhotonImage | null = null;
  let croppedImage: PhotonImage | null = null;
  let outputImage: PhotonImage | null = null;

  try {
    const body = await request.json() as {
      sourceAssetId?: unknown; variantKey?: unknown; focusX?: unknown; focusY?: unknown;
    };
    const sourceAssetId = String(body.sourceAssetId || '');
    const variantKey = String(body.variantKey || '') as keyof typeof PRESETS;
    const focusX = Number(body.focusX);
    const focusY = Number(body.focusY);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sourceAssetId) ||
        !Object.prototype.hasOwnProperty.call(PRESETS, variantKey) ||
        !Number.isInteger(focusX) || focusX < 0 || focusX > 100 ||
        !Number.isInteger(focusY) || focusY < 0 || focusY > 100) {
      return NextResponse.json({ error: 'Invalid source asset or crop settings.' }, {
        status: 400, headers: { 'Cache-Control': 'private, no-store' },
      });
    }

    const sourceRows = await withFactsportEditorialPostgres(sql => sql`
      SELECT id, object_key, content_type, byte_size, sha256, width, height, alt_text,
             rights_status, rights_reference, attribution_text, usage_expires_at,
             rights_reviewed_by, rights_reviewed_at
      FROM public.media_assets
      WHERE id=${sourceAssetId}::uuid AND media_kind='image'
        AND NOT EXISTS (
          SELECT 1 FROM public.media_asset_derivatives
          WHERE derivative_asset_id=media_assets.id
        )
      LIMIT 1
    `);
    const source = sourceRows[0];
    if (!source ||
        !['owned', 'licensed', 'editorial_exception'].includes(source.rights_status) ||
        !source.rights_reviewed_by || !source.rights_reviewed_at ||
        (source.usage_expires_at && new Date(source.usage_expires_at).valueOf() <= Date.now())) {
      return NextResponse.json({ error: 'Only currently rights-approved original images can be transformed.' }, {
        status: 409, headers: { 'Cache-Control': 'private, no-store' },
      });
    }
    if (!EDITORIAL_IMAGE_MIME_TYPES.has(source.content_type) ||
        !Number.isSafeInteger(Number(source.byte_size)) ||
        Number(source.byte_size) < 1 || Number(source.byte_size) > MAX_EDITORIAL_IMAGE_BYTES) {
      return NextResponse.json({ error: 'The source image exceeds the safe server-side processing limit.' }, {
        status: 413, headers: { 'Cache-Control': 'private, no-store' },
      });
    }

    const sourceObject = await factsportMediaBucket().get(source.object_key);
    if (!sourceObject || sourceObject.size !== Number(source.byte_size)) {
      return NextResponse.json({ error: 'The original R2 image is missing or its size does not match the media record.' }, {
        status: 409, headers: { 'Cache-Control': 'private, no-store' },
      });
    }
    const sourceBytes = new Uint8Array(await sourceObject.arrayBuffer());
    if (sourceBytes.byteLength !== Number(source.byte_size) ||
        !validImageSignature(source.content_type, sourceBytes)) {
      return NextResponse.json({ error: 'The original image bytes failed source-integrity validation.' }, {
        status: 409, headers: { 'Cache-Control': 'private, no-store' },
      });
    }
    const sourceHash = await sha256Hex(sourceBytes);
    if (sourceHash !== source.sha256) {
      return NextResponse.json({ error: 'The original image hash does not match its immutable media record.' }, {
        status: 409, headers: { 'Cache-Control': 'private, no-store' },
      });
    }
    const parsedDimensions = imageDimensions(source.content_type, sourceBytes);
    if (!parsedDimensions ||
        parsedDimensions.width !== Number(source.width) ||
        parsedDimensions.height !== Number(source.height)) {
      return NextResponse.json({ error: 'The original image dimensions do not match its verified media record.' }, {
        status: 409, headers: { 'Cache-Control': 'private, no-store' },
      });
    }

    sourceImage = PhotonImage.new_from_byteslice(sourceBytes);
    if (sourceImage.get_width() !== parsedDimensions.width ||
        sourceImage.get_height() !== parsedDimensions.height) {
      return NextResponse.json({ error: 'The image processor could not verify the original dimensions.' }, {
        status: 422, headers: { 'Cache-Control': 'private, no-store' },
      });
    }

    const expected = PRESETS[variantKey];
    const rectangle = cropRectangle(
      parsedDimensions.width, parsedDimensions.height,
      expected.width, expected.height, focusX, focusY,
    );
    croppedImage = crop(
      sourceImage,
      rectangle.x,
      rectangle.y,
      rectangle.x + rectangle.width,
      rectangle.y + rectangle.height,
    );
    outputImage = resize(croppedImage, expected.width, expected.height, SamplingFilter.Lanczos3);
    const outputBytes = new Uint8Array(outputImage.get_bytes_webp());
    if (outputBytes.byteLength < 1 || outputBytes.byteLength > MAX_EDITORIAL_IMAGE_BYTES) {
      return NextResponse.json({ error: 'The server-generated WebP derivative exceeds the 8 MB output limit.' }, {
        status: 413, headers: { 'Cache-Control': 'private, no-store' },
      });
    }
    const outputDimensions = imageDimensions('image/webp', outputBytes);
    if (!outputDimensions ||
        outputDimensions.width !== expected.width ||
        outputDimensions.height !== expected.height) {
      return NextResponse.json({ error: 'The server-generated WebP failed output dimension verification.' }, {
        status: 422, headers: { 'Cache-Control': 'private, no-store' },
      });
    }

    const sha256 = await sha256Hex(outputBytes);
    objectKey = 'editorial/derived/' + crypto.randomUUID().replace(/-/g, '');
    const actorId = authorization.user.domainUserId;
    const outputBuffer = outputBytes.buffer.slice(
      outputBytes.byteOffset,
      outputBytes.byteOffset + outputBytes.byteLength,
    );
    await factsportMediaBucket().put(objectKey, outputBuffer, {
      httpMetadata: { contentType: 'image/webp', cacheControl: 'private, no-store' },
      customMetadata: {
        sha256,
        uploadedBy: actorId,
        sourceAssetId,
        sourceSha256: sourceHash,
        variantKey,
        processor: '@cf-wasm/photon@0.4.0',
        width: String(expected.width),
        height: String(expected.height),
      },
    });

    const asset = await withFactsportEditorialPostgres(async sql => sql.begin(async tx => {
      const lockedSources = await tx`
        SELECT id, content_type, byte_size, sha256, width, height, rights_status,
               rights_reference, attribution_text, alt_text, usage_expires_at,
               rights_reviewed_by, rights_reviewed_at
        FROM public.media_assets
        WHERE id=${sourceAssetId}::uuid AND media_kind='image'
          AND NOT EXISTS (
            SELECT 1 FROM public.media_asset_derivatives
            WHERE derivative_asset_id=media_assets.id
          )
        FOR SHARE
      `;
      const lockedSource = lockedSources[0];
      if (!lockedSource ||
          lockedSource.sha256 !== sourceHash ||
          Number(lockedSource.byte_size) !== sourceBytes.byteLength ||
          !['owned', 'licensed', 'editorial_exception'].includes(lockedSource.rights_status) ||
          !lockedSource.rights_reviewed_by || !lockedSource.rights_reviewed_at ||
          (lockedSource.usage_expires_at && new Date(lockedSource.usage_expires_at).valueOf() <= Date.now())) {
        throw new Error('Source bytes or rights changed before the server derivative could be committed.');
      }
      const inserted = await tx`
        INSERT INTO public.media_assets (
          object_key, media_kind, content_type, byte_size, sha256, width, height, alt_text,
          rights_status, rights_reference, attribution_text, usage_expires_at,
          rights_reviewed_by, rights_reviewed_at, is_public, uploaded_by
        ) VALUES (
          ${objectKey}, 'image', 'image/webp', ${outputBytes.byteLength}, ${sha256},
          ${expected.width}, ${expected.height}, ${lockedSource.alt_text},
          ${lockedSource.rights_status}, ${lockedSource.rights_reference}, ${lockedSource.attribution_text},
          ${lockedSource.usage_expires_at}, ${lockedSource.rights_reviewed_by}::uuid,
          ${lockedSource.rights_reviewed_at}, false, ${actorId}::uuid
        ) RETURNING id, object_key, rights_status
      `;
      const transformSpec = {
        version: 2,
        processor: '@cf-wasm/photon@0.4.0',
        fit: 'cover',
        focusX,
        focusY,
        crop: rectangle,
        output: {
          ...expected,
          format: 'image/webp',
          encoderQuality: 'photon-default',
        },
        source: {
          sha256: sourceHash,
          width: parsedDimensions.width,
          height: parsedDimensions.height,
        },
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
          ${JSON.stringify({
            sourceAssetId,
            derivativeAssetId: inserted[0].id,
            variantKey,
            dimensions: expected,
            focusX,
            focusY,
            sourceSha256: sourceHash,
            sha256,
            processor: '@cf-wasm/photon@0.4.0',
          })}::jsonb
        )
      `;
      return inserted[0];
    }));

    return NextResponse.json({ success: true, asset }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    if (objectKey) {
      try { await factsportMediaBucket().delete(objectKey); } catch (cleanupError) {
        console.error('Orphaned server-generated editorial derivative requires cleanup', cleanupError);
      }
    }
    console.error('Server-side editorial media derivative failed', error);
    return NextResponse.json({ error: 'Unable to generate the image derivative from the verified R2 source.' }, {
      status: 500, headers: { 'Cache-Control': 'private, no-store' },
    });
  } finally {
    try { outputImage?.free(); } catch { /* release WASM allocation */ }
    try { croppedImage?.free(); } catch { /* release WASM allocation */ }
    try { sourceImage?.free(); } catch { /* release WASM allocation */ }
  }
}
