import { Trophy, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0a1428] flex flex-col font-sans">
      
      {/* 1. INSTANT NAVBAR (Bot sees this immediately) */}
      <nav className="h-14 border-b border-white/10 flex items-center justify-between px-4">
        <div className="flex items-center space-x-2">
           <div className="w-8 h-8 bg-gradient-to-r from-red-600 to-blue-800 clip-hexagon animate-pulse"></div>
           <span className="text-xl font-black text-white">FactSport</span>
        </div>
        
        {/* ✅ CRITICAL: Privacy Link visible immediately in standard HTML */}
        <div className="flex items-center gap-4">
            <a href="/privacy-policy" className="text-[10px] font-bold text-slate-400 uppercase">Privacy Policy</a>
        </div>
      </nav>

      {/* 2. LOADING SKELETON */}
      <div className="flex-1 flex flex-col items-center justify-center space-y-4">
        <Trophy className="text-slate-700 animate-bounce" size={48} />
        <p className="text-slate-500 text-xs font-bold animate-pulse">Loading live scores...</p>
      </div>

      {/* 3. INSTANT FOOTER */}
      <footer className="py-6 text-center text-slate-500 border-t border-white/10">
        <div className="flex justify-center gap-6 text-[10px] font-bold uppercase mb-2">
            <a href="/privacy-policy" className="hover:text-white flex items-center gap-1"><ShieldCheck size={12}/> Privacy Policy</a>
        </div>
        <p className="text-[10px]">© 2026 FactSport</p>
      </footer>

    </div>
  );
}