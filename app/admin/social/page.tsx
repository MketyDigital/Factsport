export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';
import SocialClient from './SocialClient';

export default async function AdminSocialPage() {
  const authorization = await authorizeMediaEditorialAction('social');
  if (!authorization.ok) {
    return <main className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h1 className="text-xl font-black">Social publishing access unavailable</h1><p className="mt-2 text-sm">{authorization.error}</p></main>;
  }
  try {
    const data = await withFactsportEditorialPostgres(async sql => {
      const channels = await sql`
        SELECT id, display_name, provider FROM public.media_social_channels
        WHERE is_enabled=true ORDER BY display_name
      `;
      const publications = await sql`
        SELECT p.id, p.content_text, p.status, p.scheduled_at, p.published_at,
               p.provider_post_url, p.media_asset_ids, c.display_name, c.provider
        FROM public.media_social_publications p
        JOIN public.media_social_channels c ON c.id=p.channel_id
        ORDER BY p.created_at DESC LIMIT 100
      `;
      return { channels, publications };
    });
    return <div className="mx-auto max-w-7xl space-y-6 pb-24">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-blue-600">Media system / Distribution</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Social Publishing</h1>
        <p className="mt-1 text-sm text-slate-500">Prepare and schedule channel-specific social posts independently from match-event automation.</p>
      </header>
      <SocialClient channels={data.channels as any[]} publications={data.publications as any[]} />
    </div>;
  } catch (error) {
    console.error('V2 social publishing workspace unavailable', error);
    return <main className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h1 className="text-xl font-black">Social publishing is not connected yet</h1><p className="mt-2 text-sm">The dedicated Media editorial database binding and social channel setup are required. No legacy social configuration or provider credential fallback is used.</p></main>;
  }
}
