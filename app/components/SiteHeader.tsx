import Link from "next/link";
import { createClient } from "@/app/lib/supabase/server";
import { Trophy, Radio, UserCircle, LayoutDashboard } from "lucide-react";

export default async function SiteHeader() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-50 bg-[#0a1428] text-white border-b border-white/10 shadow-lg font-sans">
      <div className="max-w-7xl mx-auto px-3 h-16 flex items-center justify-between gap-1 md:gap-4">
        
        {/* 1. LOGO AREA (Increased Size) */}
        <Link href="/" className="flex items-center shrink-0">
            <img 
              src="/logo.png" 
              alt="FactSport" 
              className="h-10 w-auto object-contain" 
            />
        </Link>

        {/* 2. NAVIGATION LINKS */}
        <div className="flex items-center gap-1.5 md:gap-3">
            
            {/* LIVE BUTTON */}
            <Link href="/live" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 transition border border-white/5 group shrink-0">
                <Radio size={14} className="text-red-500 animate-pulse" />
                <span className="text-[10px] font-bold">Live</span>
            </Link>

            {/* PREDICT & WIN BUTTON */}
            <Link href="/vip/upgrade" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-yellow-500 to-yellow-600 text-black hover:from-yellow-400 transition shadow-lg active:scale-95 shrink-0 whitespace-nowrap">
                <Trophy size={14} />
                <span className="text-[10px] font-black">Predict & Win</span>
            </Link>

            {/* ACCOUNT BUTTON */}
            {user ? (
                <Link href="/dashboard" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 transition shadow-lg border border-blue-400 active:scale-95 shrink-0">
                    <LayoutDashboard size={14} />
                    <span className="text-[10px] font-bold">Account</span>
                </Link>
            ) : (
                <Link href="/login" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-black hover:bg-slate-200 transition font-bold text-[10px] active:scale-95 shrink-0">
                    <UserCircle size={14} />
                    <span>Account</span>
                </Link>
            )}

        </div>
      </div>
    </header>
  );
}