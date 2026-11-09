import { NextResponse } from 'next/server';
import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';

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
  try {
    const articles = await withFactsportEditorialPostgres(sql => sql`
      SELECT DISTINCT a.id, a.slug, a.title, a.status,
             r.workflow_status AS revision_status,
             rv.position, 'revision'::text AS reference_type
      FROM public.editorial_article_revision_videos rv
      JOIN public.editorial_article_revisions r ON r.id=rv.revision_id
      JOIN public.editorial_articles a ON a.id=r.article_id
      WHERE rv.video_id=${videoId}::uuid AND rv.remove_video=false
      UNION
      SELECT DISTINCT a.id, a.slug, a.title, a.status,
             'published'::text AS revision_status,
             av.position, 'published'::text AS reference_type
      FROM public.editorial_article_videos av
      JOIN public.editorial_articles a ON a.id=av.article_id
      WHERE av.video_id=${videoId}::uuid
      ORDER BY title
    `);
    return NextResponse.json({ success: true, articles, socialDeliverySupported: false }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('Media video usage lookup failed', error);
    return NextResponse.json({ error: 'Video usage information is unavailable.' }, {
      status: 503, headers: { 'Cache-Control': 'private, no-store' },
    });
  }
}
