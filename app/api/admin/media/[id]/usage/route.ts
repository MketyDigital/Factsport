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
  const assetId = context.params?.id || '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assetId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const usage = await withFactsportEditorialPostgres(async sql => {
      const assets = await sql`
        WITH affected_assets AS (
          SELECT ${assetId}::uuid AS id
          UNION
          SELECT derivative_asset_id FROM public.media_asset_derivatives
          WHERE source_asset_id=${assetId}::uuid
        )
        SELECT
          (SELECT count(*)::integer FROM affected_assets) AS related_asset_count,
          (SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', d.derivative_asset_id, 'variant', d.variant_key,
            'objectKey', m.object_key, 'rightsStatus', m.rights_status,
            'isPublic', m.is_public
          ) ORDER BY d.created_at DESC), '[]'::jsonb)
           FROM public.media_asset_derivatives d
           JOIN public.media_assets m ON m.id=d.derivative_asset_id
           WHERE d.source_asset_id=${assetId}::uuid) AS derivatives
      `;
      const articles = await sql`
        WITH affected_assets AS (
          SELECT ${assetId}::uuid AS id
          UNION
          SELECT derivative_asset_id FROM public.media_asset_derivatives
          WHERE source_asset_id=${assetId}::uuid
        )
        SELECT DISTINCT a.id, a.slug, a.title, a.status, am.placement,
               am.position, 'article'::text AS reference_type
        FROM public.editorial_article_media am
        JOIN public.editorial_articles a ON a.id=am.article_id
        JOIN affected_assets aa ON aa.id=am.media_id
        UNION
        SELECT DISTINCT a.id, a.slug, a.title, a.status,
               tm.team_side AS placement, 0 AS position,
               'team_logo'::text AS reference_type
        FROM public.editorial_article_team_media tm
        JOIN public.editorial_articles a ON a.id=tm.article_id
        JOIN affected_assets aa ON aa.id=tm.media_id
        ORDER BY title
      `;
      const socialPosts = await sql`
        WITH affected_assets AS (
          SELECT ${assetId}::uuid AS id
          UNION
          SELECT derivative_asset_id FROM public.media_asset_derivatives
          WHERE source_asset_id=${assetId}::uuid
        ), ids AS (SELECT array_agg(id) AS values FROM affected_assets)
        SELECT p.id, p.status, p.scheduled_at, p.published_at,
               p.provider_post_url, c.display_name, c.provider
        FROM public.media_social_publications p
        JOIN public.media_social_channels c ON c.id=p.channel_id
        CROSS JOIN ids
        WHERE p.media_asset_ids && ids.values
        ORDER BY p.created_at DESC
        LIMIT 100
      `;
      return {
        relatedAssetCount: assets[0]?.related_asset_count || 1,
        derivatives: assets[0]?.derivatives || [],
        articles,
        socialPosts,
      };
    });
    return NextResponse.json({ success: true, usage }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Media asset usage lookup failed', error);
    return NextResponse.json({ error: 'Media usage information is unavailable.' }, {
      status: 503, headers: { 'Cache-Control': 'private, no-store' },
    });
  }
}
