import { NextResponse } from 'next/server';
import { authorizeAdminAction, isSameOriginRequest } from '@/app/lib/admin/authorization';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';
import { factsportMediaBucket } from '@/lib/adapters/factsport-cloudflare-bindings';

export const runtime = 'edge';

const MAX_BYTES = 8 * 1024 * 1024;
const MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

async function getActorId(sql: any, authId: string): Promise<string> {
  const rows = await sql`
    SELECT user_id FROM public.external_identities
    WHERE subject=${authId} ORDER BY created_at DESC LIMIT 2
  `;
  if (rows.length !== 1) throw new Error('This administrator has no unique Factsport domain identity mapping.');
  return rows[0].user_id as string;
}

function validImageSignature(type: string, bytes: Uint8Array) {
  if (type === 'image/png') return bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  if (type === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/webp') return bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  return false;
}

export async function POST(request: Request) {
  const authorization = await authorizeAdminAction();
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
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const sha256 = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
    objectKey = `editorial/${crypto.randomUUID().replace(/-/g, '')}`;

    const actorId = await withFactsportEditorialPostgres(sql => getActorId(sql, authorization.user.id));
    const bucket = factsportMediaBucket();
    await bucket.put(objectKey, bytes.buffer as ArrayBuffer, {
      httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000, immutable' },
      customMetadata: { sha256, uploadedBy: actorId },
    });

    const asset = await withFactsportEditorialPostgres(async sql => {
      const rows = await sql`
        INSERT INTO public.media_assets (
          object_key, media_kind, content_type, byte_size, sha256, alt_text,
          rights_status, is_public, uploaded_by
        ) VALUES (
          ${objectKey}, 'image', ${file.type}, ${file.size}, ${sha256},
          ${altText || null}, 'pending', false, ${actorId}::uuid
        ) RETURNING id, object_key, rights_status
      `;
      return rows[0];
    });
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
