import { NextResponse } from 'next/server';
import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';
import { factsportMediaBucket } from '@/lib/adapters/factsport-cloudflare-bindings';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

type PrivateR2Object = { body?: ReadableStream; httpEtag?: string; size?: number };
const PREVIEW_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function GET(_request: Request, context: { params: { id: string } }) {
  const authorization = await authorizeMediaEditorialAction('media');
  if (!authorization.ok) {
    return new Response('Not authorized', {
      status: authorization.status,
      headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  }

  const id = context.params?.id || '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
  }

  try {
    const rows = await withFactsportEditorialPostgres(async sql => sql`
      SELECT object_key, content_type, byte_size
      FROM public.media_assets
      WHERE id = ${id}::uuid AND media_kind = 'image'
      LIMIT 1
    `);
    const asset = rows[0];
    if (!asset || !PREVIEW_TYPES.has(asset.content_type)) {
      return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
    }

    const object = await factsportMediaBucket().get(asset.object_key) as PrivateR2Object | null;
    if (!object?.body) {
      return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
    }

    const headers = new Headers({
      'Content-Type': asset.content_type,
      'Content-Length': String(asset.byte_size),
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Content-Disposition': 'inline',
      'Referrer-Policy': 'no-referrer',
    });
    if (object.httpEtag) headers.set('ETag', object.httpEtag);
    return new Response(object.body, { status: 200, headers });
  } catch (error) {
    console.error('Private editorial media preview unavailable', error);
    return new Response('Media preview unavailable', {
      status: 503,
      headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  }
}
