// ✅ RUNS ON EDGE
export const runtime = 'edge';

import { createClient } from '@/app/lib/supabase/server';
import { notFound } from "next/navigation";
import Link from 'next/link';
import { ChevronLeft, Clock, MapPin, Shield, Zap, TrendingUp, Users } from 'lucide-react';

// Fetch Live Data from ESPN directly on the Edge
async function getMatchData(id: string) {
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${id}`, {
    next: { revalidate: 30 } // Cache for 30 seconds only
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function MatchDetailsPage({ params }: { params: { id: string } }) {
  // 1. Get Match Data
  const data = await getMatchData(params.id);
  if (!data || !data.header) return notFound();

  const { header, boxscore, gameInfo } = data;
  const home = header.competitions[0].competitors.find((c: any) => c.homeAway === 'home');
  const away = header.competitions[0].competitors.find((c: any) => c.homeAway === 'away');
  const status = header.competitions[0].status;

  // 2. Get User Session (for Prediction Button)
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 3. Stats Parser
  const getStat = (teamId: string, name: string) => {
    const teamStats = boxscore?.teams?.find((t: any) => t.team.id === teamId)?.statistics;
    return teamStats?.find((s: any) => s.name === name)?.displayValue || "0";
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 pb-20">
      
      {/* --- HEADER (Scoreboard) --- */}
      <div className="relative bg-[#0a1428] text-white pb-8 rounded-b-[2.5rem] overflow-hidden shadow-2xl">
        {/* Background FX */}
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-600 rounded-full blur-[100px] opacity-30"></div>
        
        {/* Nav */}
        <div className="relative z-10 p-4 flex items-center justify-between">
          <Link href="/" className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition">
            <ChevronLeft size={24} />
          </Link>
          <span className="text-xs font-bold tracking-widest opacity-70 uppercase">Match Center</span>
          <div className="w-10"></div> {/* Spacer */}
        </div>

        {/* Score Area */}
        <div className="relative z-10 px-6 mt-2">
          {/* Status Badge */}
          <div className="flex justify-center mb-6">
            {status.type.state === 'in' ? (
               <span className="bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-full animate-pulse flex items-center gap-1">
                 <span className="w-1.5 h-1.5 bg-white rounded-full"></span> LIVE {status.displayClock}'
               </span>
            ) : (
               <span className="bg-white/10 text-slate-300 text-[10px] font-bold px-3 py-1 rounded-full">
                 {status.type.detail}
               </span>
            )}
          </div>

          <div className="flex justify-between items-center">
            {/* Home */}
            <div className="flex flex-col items-center w-1/3">
              <div className="w-20 h-20 bg-white p-2 rounded-full shadow-lg shadow-blue-900/50 mb-3">
                 <img src={home.team.logos?.[0]?.href} alt={home.team.name} className="w-full h-full object-contain" />
              </div>
              <h2 className="font-bold text-center text-sm leading-tight">{home.team.displayName}</h2>
            </div>

            {/* Score */}
            <div className="flex flex-col items-center w-1/3">
              <div className="text-5xl font-black tracking-tighter flex items-center gap-2">
                <span>{home.score}</span>
                <span className="text-slate-600 text-3xl">:</span>
                <span>{away.score}</span>
              </div>
            </div>

            {/* Away */}
            <div className="flex flex-col items-center w-1/3">
              <div className="w-20 h-20 bg-white p-2 rounded-full shadow-lg shadow-red-900/50 mb-3">
                 <img src={away.team.logos?.[0]?.href} alt={away.team.name} className="w-full h-full object-contain" />
              </div>
              <h2 className="font-bold text-center text-sm leading-tight">{away.team.displayName}</h2>
            </div>
          </div>
        </div>
      </div>

      {/* --- INFO BAR --- */}
      <div className="mx-4 -mt-6 relative z-20 bg-white rounded-xl shadow-lg p-4 flex justify-between items-center text-xs text-slate-500 font-medium">
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-red-600" />
          {new Date(header.competitions[0].date).toLocaleDateString()}
        </div>
        <div className="h-4 w-[1px] bg-slate-200"></div>
        <div className="flex items-center gap-2">
           <MapPin size={14} className="text-red-600" />
           {gameInfo?.venue?.fullName || "Stadium"}
        </div>
      </div>

      {/* --- TABS & CONTENT --- */}
      <main className="px-4 mt-6 space-y-6">
        
        {/* 1. PREDICTION CARD (The Money Maker) */}
        <div className="bg-gradient-to-br from-blue-900 to-slate-900 rounded-2xl p-1 shadow-xl overflow-hidden">
          <div className="bg-[#0a1428] rounded-xl p-5 relative overflow-hidden">
             {/* Glow FX */}
             <div className="absolute top-0 right-0 w-32 h-32 bg-red-600 blur-[80px] opacity-20"></div>

             <div className="relative z-10">
               <h3 className="text-white font-bold flex items-center gap-2 mb-4">
                 <Zap className="text-yellow-400 fill-yellow-400" size={18} />
                 Make Your Prediction
               </h3>
               
               {user ? (
                 <div className="grid grid-cols-3 gap-2">
                   <button className="bg-white/5 hover:bg-white/10 border border-white/10 text-white py-3 rounded-lg font-bold text-sm transition">
                     {home.team.abbreviation} Win
                   </button>
                   <button className="bg-white/5 hover:bg-white/10 border border-white/10 text-white py-3 rounded-lg font-bold text-sm transition">
                     Draw
                   </button>
                   <button className="bg-white/5 hover:bg-white/10 border border-white/10 text-white py-3 rounded-lg font-bold text-sm transition">
                     {away.team.abbreviation} Win
                   </button>
                 </div>
               ) : (
                 <Link href="/login" className="block w-full bg-red-600 text-white text-center py-3 rounded-lg font-bold text-sm shadow-lg shadow-red-900/30">
                   Login to Predict & Win ₦500k
                 </Link>
               )}
               <p className="text-[10px] text-slate-400 text-center mt-3">
                 *Win 10 Points for correct score. One prediction per match.
               </p>
             </div>
          </div>
        </div>

        {/* 2. STATS GRID */}
        <div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-3 flex items-center gap-2">
            <TrendingUp size={16} /> Match Stats
          </h3>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-5">
            {/* Possession */}
            <StatBar label="Possession" 
              homeVal={getStat(home.id, "possessionPct")} 
              awayVal={getStat(away.id, "possessionPct")} 
              suffix="%" />
            
            {/* Shots */}
            <StatBar label="Total Shots" 
              homeVal={getStat(home.id, "shots")} 
              awayVal={getStat(away.id, "shots")} />
            
            {/* Fouls */}
            <StatBar label="Fouls" 
              homeVal={getStat(home.id, "foulsCommitted")} 
              awayVal={getStat(away.id, "foulsCommitted")} />
          </div>
        </div>

        {/* 3. AFFILIATE BANNER (Revenue) */}
        <div className="bg-[#1A1A1A] rounded-xl p-4 flex items-center justify-between shadow-lg">
           <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-yellow-400 rounded-lg flex items-center justify-center font-black text-black">
               1X
             </div>
             <div>
               <div className="text-white font-bold text-sm">Bet on this Match</div>
               <div className="text-slate-400 text-[10px]">Use code <span className="text-yellow-400 font-bold">FACTSPORT</span></div>
             </div>
           </div>
           <button className="bg-yellow-400 text-black text-xs font-bold px-4 py-2 rounded-full">
             Bet Now
           </button>
        </div>

      </main>
    </div>
  );
}

// Helper Component for Stats
function StatBar({ label, homeVal, awayVal, suffix = "" }: any) {
  const h = parseInt(homeVal) || 0;
  const a = parseInt(awayVal) || 0;
  const total = h + a || 1;
  const homePct = (h / total) * 100;

  return (
    <div>
      <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
        <span>{homeVal}{suffix}</span>
        <span className="text-slate-400 uppercase font-medium text-[10px]">{label}</span>
        <span>{awayVal}{suffix}</span>
      </div>
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
        <div className="h-full bg-blue-600" style={{ width: `${homePct}%` }}></div>
        <div className="h-full bg-red-600 flex-1"></div>
      </div>
    </div>
  );
}

import { Calendar } from 'lucide-react'; // Added missing import