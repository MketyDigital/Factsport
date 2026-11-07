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
      SELECT id, title, slug, excerpt, body_markdown, category, tags, status, review_status,
             is_headline, is_breaking, seo_title, seo_description, canonical_url,
             author_display_name, updated_at
      FROM public.editorial_articles
      ORDER BY updated_at DESC
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
