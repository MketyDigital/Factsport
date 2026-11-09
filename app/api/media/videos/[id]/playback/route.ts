import { NextResponse } from 'next/server';
import { withFactsportPostgres } from '@/lib/adapters/postgres-client';
import {
  createFactsportStreamSignedToken, isFactsportStreamVideoReady,
} from '@/lib/media/cloudflare-stream';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: { id: string } }) {
  const videoId = context.params?.id || '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(videoId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!isFactsportStreamVideoReady()) {
    return NextResponse.json({ error: 'Video playback is temporarily unavailable.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }
  try {
    const rows = await withFactsportPostgres(sql => sql`
      SELECT provider_video_id, playback_host
      FROM public.public_editorial_article_video_tokens
      WHERE video_id=${videoId}::uuid
      LIMIT 1
    `);
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    const host = String(rows[0].playback_host || '');
    if (!/^[a-z0-9-]+\.cloudflarestream\.com$/i.test(host)) {
      return NextResponse.json({ error: 'Video playback is unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
    const token = await createFactsportStreamSignedToken(String(rows[0].provider_video_id));
    const base = 'https://' + host + '/' + token;
    return NextResponse.json({
      success: true,
      iframeUrl: base + '/iframe',
      thumbnailUrl: base + '/thumbnails/thumbnail.jpg',
      expiresInSeconds: 3600,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Public Stream playback token creation failed', error);
    return NextResponse.json({ error: 'Video playback is temporarily unavailable.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
