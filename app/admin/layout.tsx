export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Newspaper, Images, Send, Radio, Settings, LogOut } from 'lucide-react';
import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const access = await authorizeMediaEditorialAction('workspace');
  if (!access.ok) {
    return (
      <main className="mx-auto mt-12 max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-xl font-black text-amber-950">Factsport Media workspace</h1>
        <p className="mt-2 text-sm text-amber-900">{access.error}</p>
        <p className="mt-3 text-xs text-amber-800">Access is managed through verified Entra identity and Factsport Media roles, not email allowlists or profile metadata.</p>
        <Link href="/media-login" className="mt-4 inline-block rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white">Sign in to Media</Link>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-[#0a1428] text-white shadow-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/admin" className="font-black tracking-tight">FactSport <span className="text-red-400">Media</span></Link>
          <nav className="flex items-center gap-2 text-xs font-bold sm:gap-4 sm:text-sm">
            <Link href="/admin/news" className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-white/10"><Newspaper size={16}/> Newsroom</Link>
            <Link href="/admin/media" className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-white/10"><Images size={16}/> Media</Link>
            <Link href="/admin/social" className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-white/10"><Send size={16}/> Social</Link>
            <Link href="/admin/studio" className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-white/10"><Radio size={16}/> Studio</Link>
            <Link href="/admin/settings" className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-white/10"><Settings size={16}/> Settings</Link>
          </nav>
          <Link href="/api/auth/entra/logout" className="flex items-center gap-2 text-xs text-slate-300 hover:text-white"><LogOut size={14}/> Sign out</Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6">{children}</main>
    </div>
  );
}
