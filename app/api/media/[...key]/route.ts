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

const MEDIA_CACHE = 'public, max-age=60, s-maxage=60, must-revalidate';

export async function GET(
  request: Request,
  context: { params: { key: string[] } }
) {
  const key = Array.isArray(context.params?.key) ? context.params.key.join('/') : '';
  const asset = await getPublicMediaAsset(key);
  if (!asset || !SAFE_IMAGE_TYPES.has(asset.content_type)) {
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  const knownEtag = asset.sha256 ? '"' + asset.sha256 + '"' : null;
  if (knownEtag && request.headers.get('if-none-match') === knownEtag) {
    return new Response(null, { status: 304, headers: { ETag: knownEtag, 'Cache-Control': MEDIA_CACHE } });
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
    'Cache-Control': MEDIA_CACHE,
  });
  if (asset.byte_size > 0) headers.set('Content-Length', String(asset.byte_size));
  if (knownEtag) headers.set('ETag', knownEtag);
  else if (object.httpEtag) headers.set('ETag', object.httpEtag);

  const responseEtag = headers.get('ETag');
  if (responseEtag && request.headers.get('if-none-match') === responseEtag) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(object.body, { status: 200, headers });
}
