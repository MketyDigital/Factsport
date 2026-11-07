export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';
import MediaSettingsClient from './MediaSettingsClient';

export default async function MediaSettingsPage() {
  const authorization = await authorizeMediaEditorialAction('publish');
  if (!authorization.ok) return <main className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h1 className="text-xl font-black text-amber-950">Media settings unavailable</h1><p className="mt-2 text-sm text-amber-900">{authorization.error}</p></main>;
  try {
    const rows = await withFactsportEditorialPostgres(sql => sql`SELECT announcement_text, announcement_link, announcement_enabled FROM public.homepage_settings WHERE singleton = true LIMIT 1`);
    return <MediaSettingsClient initial={rows[0] ?? null} />;
  } catch {
    return <main className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h1 className="text-xl font-black text-amber-950">Media settings database not connected</h1><p className="mt-2 text-sm text-amber-900">The dedicated editorial database binding and migration 0025 are required. No legacy settings fallback is allowed.</p></main>;
  }
}
