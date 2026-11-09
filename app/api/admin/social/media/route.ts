import { NextResponse } from 'next/server';
import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';

export const runtime = 'edge';

export async function GET(request: Request) {
  const authorization = await authorizeMediaEditorialAction('social');
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, {
      status: authorization.status,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }
  const url = new URL(request.url);
  const query = (url.searchParams.get('q') || '').trim().replace(/[%_\\]/g, '').slice(0, 100);
  const rawOffset = Number(url.searchParams.get('offset') || '0');
  const offset = Number.isInteger(rawOffset) ? Math.max(0, Math.min(rawOffset, 5000)) : 0;
  try {
    const assets = await withFactsportEditorialPostgres(async sql => sql`
      SELECT m.id, m.object_key, m.content_type, m.width, m.height, m.alt_text, m.attribution_text
      FROM public.media_assets m
      JOIN public.public_media_assets public_asset ON public_asset.object_key=m.object_key
      WHERE m.media_kind='image' AND m.is_public=true
        AND m.rights_status IN ('owned','licensed','editorial_exception')
        AND (m.usage_expires_at IS NULL OR m.usage_expires_at > now())
        AND (
          ${query} = ''
          OR m.object_key ILIKE ${'%' + query + '%'}
          OR COALESCE(m.alt_text, '') ILIKE ${'%' + query + '%'}
          OR COALESCE(m.attribution_text, '') ILIKE ${'%' + query + '%'}
        )
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT 51 OFFSET ${offset}
    `);
    return NextResponse.json({
      success: true,
      assets: assets.slice(0, 50),
      page: { offset, limit: 50, hasMore: assets.length > 50, nextOffset: assets.length > 50 ? offset + 50 : null },
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Public social media asset lookup failed', error);
    return NextResponse.json({ error: 'Public Media assets are not available.' }, {
      status: 503,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }
}
