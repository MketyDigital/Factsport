export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';
import { authorizeAdminAction } from '@/app/lib/admin/authorization';
import NewsroomClient from './NewsroomClient';

export default async function AdminNewsPage() {
  const authorization = await authorizeAdminAction();
  if (!authorization.ok) {
    return (
      <main className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-xl font-black text-amber-950">Newsroom access unavailable</h1>
        <p className="mt-2 text-sm text-amber-900">{authorization.error}</p>
      </main>
    );
  }

  try {
    const articles = await withFactsportEditorialPostgres(async sql => sql`
      SELECT a.id,
        COALESCE(r.snapshot->>'title', a.title) AS title,
        COALESCE(r.snapshot->>'slug', a.slug) AS slug,
        COALESCE(r.snapshot->>'excerpt', a.excerpt) AS excerpt,
        COALESCE(r.snapshot->>'body_markdown', a.body_markdown) AS body_markdown,
        COALESCE(r.snapshot->>'category', a.category) AS category,
        COALESCE(r.snapshot->>'team_1_name', a.team_1_name) AS team_1_name,
        COALESCE(r.snapshot->>'team_2_name', a.team_2_name) AS team_2_name,
        CASE WHEN r.snapshot IS NULL THEN a.tags ELSE ARRAY(SELECT jsonb_array_elements_text(r.snapshot->'tags')) END AS tags,
        a.status,
        COALESCE(r.workflow_status, a.review_status) AS review_status,
        r.workflow_status AS revision_status,
        COALESCE((r.snapshot->>'is_headline')::boolean, a.is_headline) AS is_headline,
        COALESCE((r.snapshot->>'is_breaking')::boolean, a.is_breaking) AS is_breaking,
        COALESCE(r.snapshot->>'seo_title', a.seo_title) AS seo_title,
        COALESCE(r.snapshot->>'seo_description', a.seo_description) AS seo_description,
        COALESCE(r.snapshot->>'canonical_url', a.canonical_url) AS canonical_url,
        COALESCE(r.snapshot->>'author_display_name', a.author_display_name) AS author_display_name,
        a.updated_at
      FROM public.editorial_articles a
      LEFT JOIN LATERAL (
        SELECT snapshot, workflow_status
        FROM public.editorial_article_revisions
        WHERE article_id=a.id AND workflow_status IN ('draft','in_review')
        ORDER BY revision_number DESC LIMIT 1
      ) r ON true
      ORDER BY a.updated_at DESC
      LIMIT 200
    `);
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
