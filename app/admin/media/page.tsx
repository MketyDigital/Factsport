export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';
import MediaLibraryClient from './MediaLibraryClient';

export default async function MediaLibraryPage() {
  const authorization = await authorizeMediaEditorialAction('media');
  if (!authorization.ok) {
    return <main className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
      <h1 className="text-xl font-black text-amber-950">Media library unavailable</h1>
      <p className="mt-2 text-sm text-amber-900">{authorization.error}</p>
    </main>;
  }
  return <MediaLibraryClient />;
}
