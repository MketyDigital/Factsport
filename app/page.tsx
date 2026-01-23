// ✅ RUNS ON EDGE (Compatible with Vercel & Cloudflare)
export const runtime = 'edge';

import Link from "next/link";
import { Zap, Trophy, TrendingUp, ChevronRight, Activity, PlayCircle } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 font-sans">
      
      {/* --- 1. NAVBAR (Brand Aligned) --- */}
      <nav className="sticky top-0 z-50 bg-[#0a1428] text-white border-b border-white/10 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* LOGO AREA */}
          <div className="flex items-center space-x-2">
            {/* CSS Hexagon matching your logo */}
            <div className="relative flex items-center justify-center w-10 h-10">
               <div className="absolute w-full h-full bg-gradient-to-r from-red-600 to-blue-800 clip-hexagon"></div>
               <div className="absolute w-[80%] h-[80%] bg-blue-900 clip-hexagon"></div>
               <span className="relative font-bold italic text-white text-xs">FS</span>
            </div>
            <span className="text-2xl font-black tracking-tighter text-white">
              Fact<span className="text-gray-300">Sport</span>
            </span>
          </div>

          {/* MOBILE ACTIONS */}
          <div className="flex items-center space-x-3">
            <Link href="/login" className="px-4 py-1.5 text-xs font-bold text-white/80 hover:text-white border border-white/20 rounded-full transition">
              Login
            </Link>
            <Link href="/vip/upgrade" className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-full shadow-[0_0_15px_rgba(220,38,38,0.5)] transition flex items-center gap-1">
              <Trophy size={12} /> VIP
            </Link>
          </div>
        </div>
      </nav>

      {/* --- 2. BREAKING NEWS TICKER --- */}
      <div className="bg-red-700 text-white text-[10px] font-bold py-2 overflow-hidden relative flex items-center shadow-md z-40">
        <div className="absolute left-0 h-full bg-red-800 px-3 flex items-center z-10 shadow-r-xl">
          <Activity size={12} className="mr-1 animate-pulse" /> BREAKING
        </div>
        <div className="whitespace-nowrap animate-marquee pl-32 flex space-x-8">
          <span>🚨 MAN CITY AGREE DEAL FOR NEW STRIKER</span>
          <span>• OSIMHEN TRANSFER SAGA CONTINUES</span>
          <span>• REAL MADRID INJURY CRISIS: VINICIUS OUT</span>
          <span>• AFCON 2025: SUPER EAGLES LAND IN UYO</span>
        </div>
      </div>

      {/* --- 3. HERO SECTION (Live Match) --- */}
      <header className="relative bg-[#0a1428] pb-12 overflow-hidden">
        {/* Background Gradients to match logo vibes */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full blur-[100px] opacity-20"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-600 rounded-full blur-[100px] opacity-10"></div>

        <div className="relative max-w-7xl mx-auto px-4 pt-6">
          <h1 className="text-white text-lg font-black uppercase italic tracking-tighter mb-4 flex items-center gap-2">
            <span className="w-1 h-6 bg-red-600 block"></span>
            Featured <span className="text-blue-400">Match</span>
          </h1>
          
          {/* LIVE SCOREBOARD CARD */}
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 text-white shadow-2xl relative overflow-hidden">
            
            {/* Live Indicator */}
            <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 mb-6">
              <span className="bg-white/10 px-2 py-1 rounded tracking-wider">PREMIER LEAGUE</span>
              <span className="text-red-500 flex items-center gap-1 animate-pulse">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span> LIVE 34'
              </span>
            </div>

            {/* Teams & Score */}
            <div className="flex justify-between items-center mb-8 px-2">
              <div className="flex flex-col items-center gap-2 w-1/3">
                <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-slate-900 font-black text-xl shadow-lg border-2 border-slate-200">
                  ARS
                </div>
                <div className="font-bold text-sm text-center">Arsenal</div>
              </div>

              <div className="flex flex-col items-center justify-center w-1/3">
                <div className="text-4xl font-black tracking-widest leading-none">
                  2<span className="text-gray-500 text-2xl mx-1">:</span>1
                </div>
                <div className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest">2nd Half</div>
              </div>

              <div className="flex flex-col items-center gap-2 w-1/3">
                <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-slate-900 font-black text-xl shadow-lg border-2 border-slate-200">
                  LIV
                </div>
                <div className="font-bold text-sm text-center">Liverpool</div>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              <button className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white w-full py-3 rounded-xl font-black uppercase text-xs shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95">
                <Zap size={14} /> Predict
              </button>
              <button className="bg-white/10 hover:bg-white/20 w-full py-3 rounded-xl font-black uppercase text-xs flex items-center justify-center gap-2 border border-white/10 transition-all backdrop-blur-sm">
                <TrendingUp size={14} /> Stats
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* --- 4. LEAGUE TABS --- */}
      <div className="sticky top-[105px] z-30 bg-[#F0F2F5] pt-4 pb-2 overflow-x-auto shadow-sm">
        <div className="flex px-4 space-x-3 min-w-max">
          {['All', 'EPL', 'La Liga', 'Bundesliga', 'Serie A', 'Ligue 1', 'UCL'].map((league, i) => (
            <button key={league} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              i === 0 
                ? 'bg-blue-900 text-white shadow-md' 
                : 'bg-white text-slate-500 border border-slate-200 shadow-sm'
            }`}>
              {league}
            </button>
          ))}
        </div>
      </div>

      {/* --- 5. UPCOMING MATCHES LIST --- */}
      <main className="max-w-7xl mx-auto px-4 py-4 space-y-3 pb-20">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Up Next</h3>
        
        {/* Match Item */}
        {[1, 2, 3].map((item) => (
          <div key={item} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex items-center justify-between active:bg-slate-50 transition">
            <div className="flex items-center space-x-4">
              <div className="flex flex-col items-center justify-center w-10 border-r border-slate-100 pr-4">
                <span className="text-xs font-black text-slate-800">14:00</span>
                <span className="text-[10px] text-slate-400 font-bold">Today</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-slate-200"></div>
                  <span className="text-sm font-bold text-slate-700">Man United</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-slate-200"></div>
                  <span className="text-sm font-bold text-slate-700">Chelsea</span>
                </div>
              </div>
            </div>
            <ChevronRight className="text-slate-300" size={18} />
          </div>
        ))}

        {/* --- MONTHLY REWARD BANNER --- */}
        <div className="mt-6 relative overflow-hidden rounded-2xl bg-gradient-to-r from-yellow-500 to-amber-600 p-5 text-white shadow-xl">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Trophy size={100} />
          </div>
          <div className="relative z-10">
            <h3 className="font-black text-lg uppercase italic mb-1">Monthly Jackpot</h3>
            <p className="text-xs text-yellow-100 mb-3 max-w-[70%]">
              Predict 3 games correctly to qualify for the ₦500,000 prize pool.
            </p>
            <div className="w-full bg-black/20 rounded-full h-1.5 mb-2">
              <div className="bg-white h-1.5 rounded-full w-1/3 shadow-[0_0_10px_white]"></div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold">1/3 Correct</span>
              <button className="text-[10px] font-bold bg-white text-amber-600 px-3 py-1 rounded-full">
                View Leaderboard
              </button>
            </div>
          </div>
        </div>
      </main>

    </div>
  );
}