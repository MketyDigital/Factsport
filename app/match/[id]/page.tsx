// ✅ RUNS ON EDGE
export const runtime = 'edge';

import { createClient } from '@/app/lib/supabase/server';
import { notFound } from "next/navigation";
import Link from 'next/link';
import { ChevronLeft, Calendar, MapPin, Zap, TrendingUp, Users, Clock, PlayCircle, Lock } from 'lucide-react';

// Fetch Live Data directly from ESPN
async function getMatchData(id: string) {
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${id}`, {
    next: { revalidate: 30 } 
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function MatchDetailsPage({ params }: { params: { id: string } }) {
  const data = await getMatchData(params.id);
  if (!data || !data.header) return notFound();

  const { header, boxscore, gameInfo, rosters } = data;
  const home = header.competitions[0].competitors.find((c: any) => c.homeAway === 'home');
  const away = header.competitions[0].competitors.find((c: any) => c.homeAway === 'away');
  const status = header.competitions[0].status;
  
  // Parse Timeline (Goals/Cards)
  const timeline = header.competitions[0].details || [];

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Helper for Stats
  const getStat = (teamId: string, name: string) => {
    const teamStats = boxscore?.teams?.find((t: any) => t.team.id === teamId)?.statistics;
    return teamStats?.find((s: any) => s.name === name)?.displayValue || "0";
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 pb-20">
      
      {/* --- 1. HEADER (Scoreboard) --- */}
      <div className="relative bg-[#0a1428] text-white pb-6 rounded-b-[2rem] overflow-hidden shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        
        {/* Nav */}
        <div className="relative z-10 p-4 flex items-center justify-between">
          <Link href="/" className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition">
            <ChevronLeft size={24} />
          </Link>
          <span className="text-xs font-bold tracking-widest opacity-70 uppercase">{header.league?.name}</span>
          <div className="w-10"></div>
        </div>

        {/* Score Area */}
        <div className="relative z-10 px-4 mt-2">
          {/* Status */}
          <div className="flex justify-center mb-6">
            {status.type.state === 'in' ? (
               <span className="bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-full animate-pulse flex items-center gap-1">
                 <span className="w-1.5 h-1.5 bg-white rounded-full"></span> LIVE {status.displayClock}'
               </span>
            ) : (
               <span className="bg-white/10 text-slate-300 text-[10px] font-bold px-3 py-1 rounded-full border border-white/10">
                 {status.type.detail}
               </span>
            )}
          </div>

          <div className="flex justify-between items-center">
            {/* Home */}
            <div className="flex flex-col items-center w-1/3">
              <div className="w-16 h-16 bg-white p-2 rounded-full shadow-lg shadow-blue-900/50 mb-2">
                 <img src={home.team.logos?.[0]?.href} alt={home.team.name} className="w-full h-full object-contain" />
              </div>
              <h2 className="font-bold text-center text-xs leading-tight">{home.team.shortDisplayName}</h2>
            </div>

            {/* Score */}
            <div className="flex flex-col items-center w-1/3">
              <div className="text-4xl font-black tracking-tighter flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/10">
                <span>{home.score}</span>
                <span className="text-slate-500 text-2xl">:</span>
                <span>{away.score}</span>
              </div>
            </div>

            {/* Away */}
            <div className="flex flex-col items-center w-1/3">
              <div className="w-16 h-16 bg-white p-2 rounded-full shadow-lg shadow-red-900/50 mb-2">
                 <img src={away.team.logos?.[0]?.href} alt={away.team.name} className="w-full h-full object-contain" />
              </div>
              <h2 className="font-bold text-center text-xs leading-tight">{away.team.shortDisplayName}</h2>
            </div>
          </div>
        </div>
      </div>

      {/* --- 2. PREDICTION SECTION (Revenue) --- */}
      <div className="mx-4 -mt-4 relative z-20">
        <div className="bg-gradient-to-r from-red-600 to-blue-900 p-[1px] rounded-xl shadow-lg">
            <div className="bg-white rounded-xl p-4">
               <div className="flex justify-between items-center mb-3">
                   <h3 className="text-xs font-black uppercase text-slate-800 flex items-center gap-1">
                       <Zap size={14} className="text-yellow-500 fill-yellow-500" /> Prediction
                   </h3>
                   <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold">Win 10pts</span>
               </div>
               
               {user ? (
                 <div className="grid grid-cols-3 gap-2">
                   <button className="bg-slate-50 border border-slate-200 py-2 rounded-lg text-xs font-bold hover:bg-blue-50 hover:border-blue-200 transition">1 (Home)</button>
                   <button className="bg-slate-50 border border-slate-200 py-2 rounded-lg text-xs font-bold hover:bg-blue-50 hover:border-blue-200 transition">X (Draw)</button>
                   <button className="bg-slate-50 border border-slate-200 py-2 rounded-lg text-xs font-bold hover:bg-blue-50 hover:border-blue-200 transition">2 (Away)</button>
                 </div>
               ) : (
                 <Link href="/login" className="block w-full bg-slate-900 text-white text-center py-2.5 rounded-lg text-xs font-bold">
                    Login to Predict
                 </Link>
               )}
            </div>
        </div>
      </div>

      {/* --- 3. VIDEO HIGHLIGHTS (Placeholder) --- */}
      <div className="px-4 mt-6">
        <div className="bg-black rounded-xl overflow-hidden aspect-video relative flex items-center justify-center group cursor-pointer shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
            <PlayCircle size={48} className="text-white relative z-10 opacity-80 group-hover:opacity-100 transition shadow-xl" />
            <div className="absolute bottom-3 left-3 z-10">
                <p className="text-white text-xs font-bold">Watch Match Highlights</p>
                <p className="text-gray-400 text-[10px]">Tap to play video</p>
            </div>
        </div>
      </div>

      {/* --- 4. DETAILS TABS --- */}
      <div className="px-4 mt-8 space-y-8">
        
        {/* STATS */}
        <div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <TrendingUp size={14} /> Match Stats
            </h3>
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-4">
                <StatBar label="Possession" h={getStat(home.id, "possessionPct")} a={getStat(away.id, "possessionPct")} suffix="%" />
                <StatBar label="Shots (On Target)" h={`${getStat(home.id, "shotsSummary")}`} a={`${getStat(away.id, "shotsSummary")}`} />
                <StatBar label="Corners" h={getStat(home.id, "corners")} a={getStat(away.id, "corners")} />
                <StatBar label="Fouls" h={getStat(home.id, "foulsCommitted")} a={getStat(away.id, "foulsCommitted")} />
                <StatBar label="Yellow Cards" h={getStat(home.id, "yellowCards")} a={getStat(away.id, "yellowCards")} />
            </div>
        </div>

        {/* TIMELINE */}
        <div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Clock size={14} /> Key Events
            </h3>
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-4">
                {timeline.length > 0 ? timeline.map((event: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 text-xs">
                        <span className="font-bold text-slate-400 w-8">{event.clock?.displayValue}</span>
                        <div className={`w-2 h-2 rounded-full ${event.team?.id === home.id ? 'bg-blue-600' : 'bg-red-600'}`}></div>
                        <div className="flex-1">
                            <span className="font-bold text-slate-800">{event.type?.text}</span>
                            <span className="text-slate-500"> - {event.participants?.[0]?.athlete?.displayName}</span>
                        </div>
                    </div>
                )) : (
                    <div className="text-center text-slate-400 text-xs py-4">No events yet</div>
                )}
            </div>
        </div>

        {/* LINEUPS */}
        <div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Users size={14} /> Starting Lineups
            </h3>
            <div className="grid grid-cols-2 gap-3">
                {/* Home Team */}
                <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
                    <div className="text-[10px] font-black uppercase text-blue-900 mb-2 border-b border-slate-100 pb-1">{home.team.shortDisplayName}</div>
                    <ul className="space-y-1.5">
                        {rosters?.find((r:any) => r.team.id === home.id)?.roster?.filter((p:any) => p.starter).map((p:any) => (
                            <li key={p.athlete.id} className="text-[10px] font-bold text-slate-600 flex gap-2">
                                <span className="text-slate-300 w-3">{p.jersey}</span> {p.athlete.displayName}
                            </li>
                        ))}
                    </ul>
                </div>
                {/* Away Team */}
                <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
                    <div className="text-[10px] font-black uppercase text-red-900 mb-2 border-b border-slate-100 pb-1">{away.team.shortDisplayName}</div>
                    <ul className="space-y-1.5">
                        {rosters?.find((r:any) => r.team.id === away.id)?.roster?.filter((p:any) => p.starter).map((p:any) => (
                            <li key={p.athlete.id} className="text-[10px] font-bold text-slate-600 flex gap-2">
                                <span className="text-slate-300 w-3">{p.jersey}</span> {p.athlete.displayName}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}

function StatBar({ label, h, a, suffix = "" }: any) {
    const hVal = parseInt(h) || 0;
    const aVal = parseInt(a) || 0;
    const total = hVal + aVal || 1;
    const pct = (hVal / total) * 100;
  
    return (
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-[10px] font-bold text-slate-500">
            <span>{h}{suffix}</span>
            <span className="uppercase text-slate-300">{label}</span>
            <span>{a}{suffix}</span>
        </div>
        <div className="h-1.5 w-full bg-slate-100 rounded-full flex overflow-hidden">
            <div className="h-full bg-blue-600" style={{ width: `${pct}%` }}></div>
            <div className="h-full bg-red-600 flex-1"></div>
        </div>
      </div>
    );
  }