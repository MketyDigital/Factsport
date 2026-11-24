import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';
import { factsportMediaBucket } from '@/lib/adapters/factsport-cloudflare-bindings';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Content-Type': 'model/gltf-binary',
  'Content-Security-Policy': "default-src 'none'; sandbox",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

type PrivateModelObject = { body?: ReadableStream; size?: number };

export async function GET(_request: Request, context: { params: { id: string } }) {
  const authorization = await authorizeMediaEditorialAction('tv');
  if (!authorization.ok) return new Response('Not authorized', { status: authorization.status, headers: HEADERS });
  const id = context.params?.id || '';
  if (!UUID.test(id)) return new Response('Not found', { status: 404, headers: HEADERS });

  try {
    const rows = await withFactsportEditorialPostgres(sql => sql`
      SELECT object_key, byte_size
      FROM public.factsport_tv_asset_library
      WHERE id = ${id}::uuid AND content_type = 'model/gltf-binary'
      LIMIT 1
    `);
    const asset = rows[0];
    if (!asset) return new Response('Not found', { status: 404, headers: HEADERS });
    const object = await (factsportMediaBucket() as unknown as {
      get(key: string): Promise<PrivateModelObject | null>;
    }).get(asset.object_key);
    if (!object?.body) return new Response('Not found', { status: 404, headers: HEADERS });
    const headers = new Headers({ ...HEADERS, 'Content-Length': String(asset.byte_size), 'Content-Disposition': 'attachment; filename="factsport-tv-model.glb"' });
    return new Response(object.body, { status: 200, headers });
  } catch (error) {
    console.error('Private Factsport TV model fetch failed', error);
    return new Response('Model unavailable', { status: 503, headers: HEADERS });
  }
}
