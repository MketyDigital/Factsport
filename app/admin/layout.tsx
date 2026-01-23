export const runtime = 'edge';

import { createClient } from '@/app/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Users, Newspaper, LogOut, Ticket, Trophy } from 'lucide-react';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Check Admin Role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return (
        <div className="h-screen flex flex-col items-center justify-center bg-red-50 text-red-800 p-4 text-center">
            <h1 className="text-2xl font-black">Access Denied</h1>
            <p>You do not have permission to view this area.</p>
            <Link href="/dashboard" className="mt-4 bg-red-800 text-white px-6 py-2 rounded-lg font-bold">Go Back</Link>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0a1428] text-white hidden md:flex flex-col fixed h-full z-50">
        <div className="p-6 border-b border-white/10">
            <span className="text-xl font-black italic tracking-tighter">FactSport <span className="text-red-600">Admin</span></span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
            <Link href="/admin" className="flex items-center gap-3 px-4 py-3 hover:bg-white/10 rounded-xl text-sm font-bold transition">
                <LayoutDashboard size={18} /> Overview & Approvals
            </Link>
            <Link href="/admin/news" className="flex items-center gap-3 px-4 py-3 hover:bg-white/10 rounded-xl text-sm font-bold transition">
                <Newspaper size={18} /> News Editor
            </Link>
            <Link href="/admin/matches" className="flex items-center gap-3 px-4 py-3 hover:bg-white/10 rounded-xl text-sm font-bold transition">
                <Ticket size={18} /> Match Manager
            </Link>
        </nav>

        <div className="p-4 border-t border-white/10">
            <Link href="/" className="flex items-center gap-2 text-slate-400 text-xs font-bold hover:text-white">
                <LogOut size={14} /> Exit Admin
            </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}