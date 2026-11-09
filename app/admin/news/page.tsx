export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';
import { isFactsportMediaVideoSchemaReady } from '@/lib/media/readiness';
import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';
import NewsroomClient from './NewsroomClient';

export default async function AdminNewsPage() {
  const authorization = await authorizeMediaEditorialAction('read');
  if (!authorization.ok) {
    return (
      <main className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-xl font-black text-amber-950">Newsroom access unavailable</h1>
        <p className="mt-2 text-sm text-amber-900">{authorization.error}</p>
      </main>
    );
  }

  try {
    const articles = await withFactsportEditorialPostgres(async sql => {
      const rows = await sql`
      SELECT a.id,
        COALESCE(r.snapshot->>'title', a.title) AS title,
        COALESCE(r.snapshot->>'slug', a.slug) AS slug,
        CASE WHEN r.snapshot IS NULL THEN a.excerpt ELSE r.snapshot->>'excerpt' END AS excerpt,
        COALESCE(r.snapshot->>'body_markdown', a.body_markdown) AS body_markdown,
        COALESCE(r.snapshot->>'category', a.category) AS category,
        CASE WHEN r.snapshot IS NULL THEN a.team_1_name ELSE r.snapshot->>'team_1_name' END AS team_1_name,
        CASE WHEN r.snapshot IS NULL THEN a.team_2_name ELSE r.snapshot->>'team_2_name' END AS team_2_name,
        CASE WHEN r.snapshot IS NULL THEN a.tags ELSE ARRAY(SELECT jsonb_array_elements_text(r.snapshot->'tags')) END AS tags,
        a.status,
        COALESCE(r.workflow_status, a.review_status) AS review_status,
        r.workflow_status AS revision_status,
        COALESCE(r.id, published_revision.id) AS current_revision_id,
        COALESCE(revision_media.items, '[]'::jsonb) AS revision_media,
        COALESCE(article_sources.items, '[]'::jsonb) AS sources,
        r.review_comment,
        COALESCE((r.snapshot->>'is_headline')::boolean, a.is_headline) AS is_headline,
        COALESCE((r.snapshot->>'is_breaking')::boolean, a.is_breaking) AS is_breaking,
        CASE WHEN r.snapshot IS NULL THEN a.seo_title ELSE r.snapshot->>'seo_title' END AS seo_title,
        CASE WHEN r.snapshot IS NULL THEN a.seo_description ELSE r.snapshot->>'seo_description' END AS seo_description,
        CASE WHEN r.snapshot IS NULL THEN a.canonical_url ELSE r.snapshot->>'canonical_url' END AS canonical_url,
        COALESCE(r.snapshot->>'author_display_name', a.author_display_name) AS author_display_name,
        a.updated_at
      FROM public.editorial_articles a
      LEFT JOIN LATERAL (
        SELECT id, snapshot, workflow_status, review_comment, created_at
        FROM public.editorial_article_revisions
        WHERE article_id=a.id AND workflow_status IN ('draft','in_review','approved','rejected')
        ORDER BY revision_number DESC LIMIT 1
      ) r ON true
      LEFT JOIN LATERAL (
        SELECT id FROM public.editorial_article_revisions
        WHERE article_id=a.id AND workflow_status='published'
        ORDER BY revision_number DESC LIMIT 1
      ) published_revision ON true
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object(
          'placement', rm.placement,
          'position', rm.position,
          'remove_media', rm.remove_media,
          'media_id', m.id,
          'object_key', m.object_key,
          'content_type', m.content_type,
          'width', m.width,
          'height', m.height,
          'rights_status', m.rights_status,
          'alt_text', m.alt_text,
          'attribution_text', m.attribution_text
        ) ORDER BY rm.placement, rm.position) AS items
        FROM public.editorial_article_revision_media rm
        LEFT JOIN public.media_assets m ON m.id = rm.media_id
        WHERE rm.revision_id = COALESCE(r.id, published_revision.id)
      ) revision_media ON true
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object(
          'id', s.id,
          'source_title', s.source_title,
          'publisher', s.publisher,
          'canonical_url', s.canonical_url,
          'attribution_text', s.attribution_text,
          'rights_reference', s.rights_reference,
          'accessed_at', s.accessed_at
        ) ORDER BY s.created_at DESC) AS items
        FROM public.editorial_article_sources s
        WHERE s.article_id=a.id AND s.revision_id=COALESCE(r.id, published_revision.id)
      ) article_sources ON true
      ORDER BY GREATEST(a.updated_at, COALESCE(r.created_at, a.updated_at)) DESC
      LIMIT 200
      `;
      if (!isFactsportMediaVideoSchemaReady() || rows.length === 0) {
        return rows.map(({ current_revision_id, ...article }) => ({ ...article, revision_videos: [] }));
      }
      const revisionIds = rows.map(row => row.current_revision_id).filter(Boolean);
      const videoRows = revisionIds.length ? await sql`
        SELECT rv.revision_id,
          jsonb_agg(jsonb_build_object(
            'position', rv.position,
            'video_id', rv.video_id,
            'remove_video', rv.remove_video,
            'title', v.title,
            'upload_status', v.upload_status,
            'rights_status', v.rights_status,
            'rights_reference', v.rights_reference,
            'attribution_text', v.attribution_text,
            'usage_expires_at', v.usage_expires_at,
            'duration_seconds', v.duration_seconds
          ) ORDER BY rv.position) AS items
        FROM public.editorial_article_revision_videos rv
        LEFT JOIN public.media_video_assets v ON v.id=rv.video_id
        WHERE rv.revision_id = ANY(${revisionIds}::uuid[])
        GROUP BY rv.revision_id
      ` : [];
      const videosByRevision = new Map(videoRows.map(row => [String(row.revision_id), row.items || []]));
      return rows.map(({ current_revision_id, ...article }) => ({
        ...article,
        revision_videos: current_revision_id ? videosByRevision.get(String(current_revision_id)) || [] : [],
      }));
    });
    return <NewsroomClient initialArticles={articles as any[]} />;
  } catch (error) {
    console.error('V2 newsroom unavailable', error);
    return (
      <main className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-xl font-black text-amber-950">Editorial workspace is not connected yet</h1>
        <p className="mt-2 text-sm text-amber-900">
          The V2 newsroom requires its dedicated least-privilege editorial database binding.
          It will not fall back to the legacy Supabase news table or the public read-only database role.
        </p>
      </main>
    );
  }
}
