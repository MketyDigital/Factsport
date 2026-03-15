'use client';
import { useEffect, useState } from 'react';
import Link from "next/link";
import { createClient } from "@/app/lib/supabase/client"; // 🟢 SECURE BROWSER CLIENT
import { Trophy, Radio, UserCircle, LayoutDashboard } from "lucide-react";

export default function SiteHeader() {
  const [user, setUser] = useState<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      setIsLoaded(true);
    };
    checkUser();

    // Real-time listener in case they log in/out in another tab
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    return () => { authListener.subscription.unsubscribe(); };
  }, [supabase]);

  return (
    <header className="sticky top-0 z-50 bg-[#0a1428] text-white border-b border-white/10 shadow-lg font-sans">
      <div className="max-w-7xl mx-auto px-3 py-2 flex flex-col gap-1.5">
        
        {/* TOP ROW: Logo & Main Actions */}
        <div className="flex items-center justify-between gap-2">
            {/* 1. LOGO AREA */}
            <Link href="/" className="flex items-center shrink-0">
                <img 
                  src="/logo.png" 
                  alt="FactSport" 
                  className="h-9 md:h-10 w-auto object-contain" 
                />
            </Link>

            {/* 2. NAVIGATION BUTTONS */}
            <div className="flex items-center justify-end gap-1.5 md:gap-3 ml-auto">
                
                {/* LIVE BUTTON */}
                <Link href="/live" className="flex items-center gap-1 md:gap-1.5 px-2 py-1 md:px-2.5 md:py-1.5 rounded-full bg-white/5 hover:bg-white/10 transition border border-white/5 group shrink-0">
                    <Radio size={12} className="text-red-500 animate-pulse md:w-3.5 md:h-3.5" />
                    <span className="text-[9px] md:text-[10px] font-bold">Live</span>
                </Link>

                {/* PREDICT & WIN BUTTON */}
                <Link href="/vip/upgrade" className="flex items-center gap-1 md:gap-1.5 px-2.5 py-1 md:px-3 md:py-1.5 rounded-full bg-gradient-to-r from-yellow-500 to-yellow-600 text-black hover:from-yellow-400 transition shadow-lg active:scale-95 shrink-0 whitespace-nowrap">
                    <Trophy size={12} className="md:w-3.5 md:h-3.5" />
                    <span className="text-[9px] md:text-[10px] font-black">Predict & Win</span>
                </Link>

                {/* ACCOUNT BUTTON - 🟢 Only shows real state after browser checks */}
                <div className="min-w-[70px] flex justify-end">
                    {!isLoaded ? (
                        <div className="h-6 md:h-7 w-[70px] bg-white/10 rounded-full animate-pulse"></div>
                    ) : user ? (
                        <Link href="/dashboard" className="flex items-center gap-1 md:gap-1.5 px-2.5 py-1 md:px-3 md:py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 transition shadow-lg border border-blue-400 active:scale-95 shrink-0">
                            <LayoutDashboard size={12} className="md:w-3.5 md:h-3.5" />
                            <span className="text-[9px] md:text-[10px] font-bold">Account</span>
                        </Link>
                    ) : (
                        <Link href="/login" className="flex items-center gap-1 md:gap-1.5 px-2.5 py-1 md:px-3 md:py-1.5 rounded-full bg-white text-black hover:bg-slate-200 transition font-bold text-[9px] md:text-[10px] active:scale-95 shrink-0">
                            <UserCircle size={12} className="md:w-3.5 md:h-3.5" />
                            <span>Account</span>
                        </Link>
                    )}
                </div>

            </div>
        </div>

        {/* BOTTOM ROW: Quick Links */}
        <div className="flex items-center justify-end gap-4 px-1 text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            <Link href="/news" className="hover:text-white transition-colors">News</Link>
            <Link href="/matches" className="hover:text-white transition-colors">Matches</Link>
            <Link href="/highlights" className="hover:text-white transition-colors">Highlights</Link>
        </div>

      </div>
    </header>
  );
}