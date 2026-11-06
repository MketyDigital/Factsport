export const runtime = 'edge';

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Newspaper, LogOut, Ticket, Users, Radio } from 'lucide-react';
import VaultLock from './VaultLock';
import { getAuthenticatedAdmin, isAdminVaultUnlocked } from '@/app/lib/admin/authorization';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAuthenticatedAdmin();
  if (!admin) redirect('/login');
  const isVaultUnlocked = await isAdminVaultUnlocked(admin.id);
  if (!isVaultUnlocked) return <VaultLock />;

  // 🟢 5. If everything is clear, render the normal Admin UI!
  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      {/* DESKTOP SIDEBAR */}
      <aside className="w-64 bg-[#0a1428] text-white hidden md:flex flex-col fixed h-full z-50">
        <div className="p-6 border-b border-white/10">
            <span className="text-xl font-black italic tracking-tighter">FactSport <span className="text-red-600">Admin</span></span>
        </div>
        <nav className="flex-1 p-4 space-y-2">
            <Link href="/admin" className="flex items-center gap-3 px-4 py-3 hover:bg-white/10 rounded-xl text-sm font-bold transition"><LayoutDashboard size={18} /> Overview</Link>
            <Link href="/admin/news" className="flex items-center gap-3 px-4 py-3 hover:bg-white/10 rounded-xl text-sm font-bold transition"><Newspaper size={18} /> News Editor</Link>
            <Link href="/admin/matches" className="flex items-center gap-3 px-4 py-3 hover:bg-white/10 rounded-xl text-sm font-bold transition"><Ticket size={18} /> Match Manager</Link>
            <Link href="/admin/users" className="flex items-center gap-3 px-4 py-3 hover:bg-white/10 rounded-xl text-sm font-bold transition"><Users size={18} /> User Directory</Link>
            {/* 🟢 NEW: Live Studio Link */}
            <Link href="/admin/studio" className="flex items-center gap-3 px-4 py-3 hover:bg-white/10 rounded-xl text-sm font-bold transition"><Radio size={18} /> Live Studio</Link>
        </nav>
        <div className="p-4 border-t border-white/10">
            <Link href="/" className="flex items-center gap-2 text-slate-400 text-xs font-bold hover:text-white"><LogOut size={14} /> Exit Admin</Link>
        </div>
      </aside>

      {/* MOBILE HEADER (Improved) */}
      <div className="md:hidden fixed top-0 w-full bg-[#0a1428] text-white z-50 p-4 shadow-xl">
        <div className="flex justify-between items-center mb-3">
            <span className="font-black italic text-lg">FS <span className="text-red-600">Admin</span></span>
            <Link href="/" className="bg-white/10 p-2 rounded-full"><LogOut size={16}/></Link>
        </div>
        {/* Mobile Links Row */}
        <div className="flex justify-between gap-2 overflow-x-auto scrollbar-hide pb-1">
            <Link href="/admin" className="flex-1 bg-white/5 py-2 px-3 rounded-lg text-[10px] font-bold text-center border border-white/10 whitespace-nowrap">Dash</Link>
            <Link href="/admin/news" className="flex-1 bg-white/5 py-2 px-3 rounded-lg text-[10px] font-bold text-center border border-white/10 whitespace-nowrap">News</Link>
            <Link href="/admin/matches" className="flex-1 bg-white/5 py-2 px-3 rounded-lg text-[10px] font-bold text-center border border-white/10 whitespace-nowrap">Matches</Link>
            <Link href="/admin/users" className="flex-1 bg-white/5 py-2 px-3 rounded-lg text-[10px] font-bold text-center border border-white/10 whitespace-nowrap">Users</Link>
            {/* 🟢 NEW: Mobile Studio Link */}
            <Link href="/admin/studio" className="flex-1 bg-white/5 py-2 px-3 rounded-lg text-[10px] font-bold text-center border border-white/10 whitespace-nowrap">Studio</Link>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 mt-28 md:mt-0">
        {children}
      </main>
    </div>
  );
}