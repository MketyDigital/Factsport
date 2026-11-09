import { NextResponse } from 'next/server';
import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';
import { isFactsportMediaVideoSchemaReady } from '@/lib/media/readiness';
import {
  createFactsportStreamSignedToken, isFactsportStreamPlaybackReady,
} from '@/lib/media/cloudflare-stream';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: { id: string } }) {
  const authorization = await authorizeMediaEditorialAction('media');
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, {
    status: authorization.status, headers: { 'Cache-Control': 'private, no-store' },
  });
  const videoId = context.params?.id || '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(videoId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!isFactsportMediaVideoSchemaReady()) return NextResponse.json({ error: 'Video schema migration is not enabled.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  if (!isFactsportStreamPlaybackReady()) {
    return NextResponse.json({ error: 'Secure video preview is not configured.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  try {
    const rows = await withFactsportEditorialPostgres(sql => sql`
      SELECT provider_video_id, playback_host
      FROM public.media_video_assets
      WHERE id=${videoId}::uuid AND upload_status='ready'
      LIMIT 1
    `);
    if (!rows.length) return NextResponse.json({ error: 'Video is not ready for preview.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    const host = String(rows[0].playback_host || '');
    if (!/^[a-z0-9-]+\.cloudflarestream\.com$/i.test(host)) {
      return NextResponse.json({ error: 'Video preview is unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
    const token = await createFactsportStreamSignedToken(String(rows[0].provider_video_id));
    return NextResponse.json({ success: true, iframeUrl: 'https://' + host + '/' + token + '/iframe' }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('Media video preview token creation failed', error);
    return NextResponse.json({ error: 'Video preview is temporarily unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
