export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Newspaper, Send, Radio, LogOut } from 'lucide-react';
import { createClient } from '@/app/lib/supabase/server';
import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const access = await authorizeMediaEditorialAction('read');
  if (!access.ok) {
    return (
      <main className="mx-auto mt-12 max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-xl font-black text-amber-950">Factsport Media workspace</h1>
        <p className="mt-2 text-sm text-amber-900">{access.error}</p>
        <p className="mt-3 text-xs text-amber-800">Access is managed through Factsport Media roles, not email allowlists, profile metadata or the legacy admin PIN.</p>
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
            <Link href="/admin/social" className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-white/10"><Send size={16}/> Social</Link>
            <Link href="/admin/studio" className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-white/10"><Radio size={16}/> Studio</Link>
          </nav>
          <Link href="/" className="flex items-center gap-2 text-xs text-slate-300 hover:text-white"><LogOut size={14}/> Exit</Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6">{children}</main>
    </div>
  );
}
