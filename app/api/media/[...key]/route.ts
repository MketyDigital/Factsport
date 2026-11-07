import { env } from 'cloudflare:workers';
import { getPublicMediaAsset } from '@/lib/adapters/postgres-editorial';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

type PublicR2Object = {
  body: ReadableStream;
  httpEtag?: string;
  size?: number;
};

const SAFE_IMAGE_TYPES = new Set([
  'image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp',
]);

export async function GET(
  _request: Request,
  context: { params: { key: string[] } }
) {
  const key = Array.isArray(context.params?.key) ? context.params.key.join('/') : '';
  const asset = await getPublicMediaAsset(key);
  if (!asset || !SAFE_IMAGE_TYPES.has(asset.content_type)) {
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  const bucket = env.FACTSPORT_MEDIA_BUCKET as {
    get: (objectKey: string) => Promise<unknown | null>;
  };
  const object = await bucket.get(key) as PublicR2Object | null;
  if (!object?.body) {
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  const headers = new Headers({
    'Content-Type': asset.content_type,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
  });
  if (asset.byte_size > 0) headers.set('Content-Length', String(asset.byte_size));
  if (asset.sha256) headers.set('ETag', `"${asset.sha256}"`);
  else if (object.httpEtag) headers.set('ETag', object.httpEtag);

  return new Response(object.body, { status: 200, headers });
}
