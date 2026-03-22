'use client';
import { useEffect, useState } from 'react';
import Link from "next/link";
import { createClient } from "@/app/lib/supabase/client"; 
import { Trophy, Radio, UserCircle, LayoutDashboard, Newspaper, Calendar, PlayCircle } from "lucide-react";

export default function SiteHeader() {
  const [user, setUser] = useState<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    let isMounted = true;

    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (isMounted) {
          setUser(session?.user || null);
          setIsLoaded(true);
      }
    };
    checkUser();

    // Real-time listener in case they log in/out in another tab
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (isMounted) {
          setUser(session?.user || null);
      }
    });

    return () => { 
        isMounted = false;
        authListener.subscription.unsubscribe(); 
    };
  }, []); // 🟢 FIXED: Empty array stops the infinite loop!

  return (
    <header className="sticky top-0 z-50 bg-[#0a1428] text-white border-b border-white/10 shadow-lg font-sans">
      <div className="max-w-7xl mx-auto flex flex-col">
        
        {/* TOP ROW: Logo & Live Button */}
        <div className="flex items-center justify-between px-3 py-2 md:py-3 border-b border-white/5">
            {/* LOGO AREA */}
            <Link href="/" className="flex items-center shrink-0">
                <img 
                  src="/logo.png" 
                  alt="FactSport" 
                  className="h-8 md:h-10 w-auto object-contain" 
                />
            </Link>

            {/* LIVE BUTTON (Only item on the right) */}
            <Link href="/live" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white transition border border-red-500/30 group shrink-0 shadow-inner">
                <Radio size={14} className="animate-pulse" />
                <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">Live</span>
            </Link>
        </div>

        {/* BOTTOM ROW: Scrollable App Menu */}
        <div className="flex items-center overflow-x-auto px-3 py-2 gap-4 sm:gap-8 md:justify-center hide-scrollbar">
            
            <Link href="/news" className="shrink-0 flex flex-col items-center gap-1 min-w-[56px] text-slate-400 hover:text-white transition-colors group">
                <Newspaper size={18} className="group-hover:scale-110 transition-transform" />
                <span className="text-[9px] font-bold uppercase tracking-wider">News</span>
            </Link>

            <Link href="/matches" className="shrink-0 flex flex-col items-center gap-1 min-w-[56px] text-slate-400 hover:text-white transition-colors group">
                <Calendar size={18} className="group-hover:scale-110 transition-transform" />
                <span className="text-[9px] font-bold uppercase tracking-wider">Matches</span>
            </Link>

            <Link href="/highlights" className="shrink-0 flex flex-col items-center gap-1 min-w-[56px] text-slate-400 hover:text-white transition-colors group">
                <PlayCircle size={18} className="group-hover:scale-110 transition-transform" />
                <span className="text-[9px] font-bold uppercase tracking-wider">Videos</span>
            </Link>

            <Link href="/vip/upgrade" className="shrink-0 flex flex-col items-center gap-1 min-w-[56px] text-slate-400 hover:text-white transition-colors group">
                <Trophy size={18} className="text-yellow-500 group-hover:scale-110 transition-transform" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-yellow-500">Predict & Win</span>
            </Link>

            {/* DYNAMIC ACCOUNT ITEM */}
            <div className="shrink-0 flex flex-col items-center min-w-[56px]">
                {!isLoaded ? (
                    // Skeleton loader for icon and text
                    <div className="flex flex-col items-center gap-1 opacity-50">
                        <div className="w-[18px] h-[18px] bg-white/20 rounded-full animate-pulse"></div>
                        <div className="w-8 h-2 bg-white/20 rounded animate-pulse mt-0.5"></div>
                    </div>
                ) : user ? (
                    <Link href="/dashboard" className="flex flex-col items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors group">
                        <LayoutDashboard size={18} className="group-hover:scale-110 transition-transform" />
                        <span className="text-[9px] font-bold uppercase tracking-wider">Account</span>
                    </Link>
                ) : (
                    <Link href="/login" className="flex flex-col items-center gap-1 text-slate-400 hover:text-white transition-colors group">
                        <UserCircle size={18} className="group-hover:scale-110 transition-transform" />
                        <span className="text-[9px] font-bold uppercase tracking-wider">Login</span>
                    </Link>
                )}
            </div>

        </div>

      </div>

      {/* CSS to hide the scrollbar but keep functionality */}
      <style jsx>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </header>
  );
}