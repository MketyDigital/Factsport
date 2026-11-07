export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { getSupabaseAdmin } from '@/app/lib/supabase/admin';
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

  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('editorial_articles')
    .select('id,title,slug,excerpt,body_markdown,category,tags,status,review_status,is_headline,is_breaking,seo_title,seo_description,canonical_url,author_display_name,updated_at')
    .order('updated_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('Newsroom list failed', error);
    return (
      <main className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-red-50 p-6">
        <h1 className="text-xl font-black text-red-950">Newsroom could not load</h1>
        <p className="mt-2 text-sm text-red-900">The editorial database is unavailable. No legacy table fallback is performed.</p>
      </main>
    );
  }

  return <NewsroomClient initialArticles={data || []} />;
}
