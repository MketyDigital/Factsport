export const runtime = 'edge';

import { createClient } from '@/app/lib/supabase/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Zap, ExternalLink, AlertCircle, Activity, Trophy } from 'lucide-react';
import FactSportPlayer from '@/app/components/FactSportPlayer';
import PredictionBoard from '@/app/components/PredictionBoard';
import { getExternalData } from '@/app/lib/matchService';

async function getSupabaseData(id: string) {
    const supabase = createClient();
    const { data, error } = await supabase.from('matches').select('*').eq('id', id).single();
    if (error) return null;
    return data;
}

export default async function MatchDetailsPage({ params }: { params: { id: string } }) {
  const resolvedParams = await params;
  if (!resolvedParams?.id) return notFound();

  const dbData = await getSupabaseData(resolvedParams.id);
  if (!dbData) return notFound();

  // This now returns your clean "UnifiedMatchData"
  const data = await getExternalData(dbData);

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 pb-24 font-sans">
      
      {/* HEADER */}
      <div className="relative bg-[#0a1428] text-white pb-8 rounded-b-[2.5rem] overflow-hidden shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="relative z-10 p-4 flex items-center justify-between">
          <Link href="/" className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition backdrop-blur-md">
            <ChevronLeft size={24} />
          </Link>
          <span className="text-xs font-bold tracking-widest opacity-70 uppercase">{dbData.league}</span>
          <div className="w-10"></div>
        </div>

        <div className="relative z-10 px-4 mt-2">
          {/* Status Section - UPDATED LOGIC */}
          <div className="flex justify-center mb-6">
            {['LIVE', 'in', '1H', '2H'].includes(data.status) ? (
               <span className="bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-full animate-pulse flex items-center gap-1 shadow-lg">
                 <span className="w-1.5 h-1.5 bg-white rounded-full"></span> LIVE {data.displayClock}'
               </span>
            ) : data.status === 'HT' ? (
               <span className="bg-slate-200 text-slate-800 text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1 shadow-lg animate-pulse">
                 HALF TIME
               </span>
            ) : (
               <span className="bg-white/10 text-slate-300 text-[10px] font-bold px-3 py-1 rounded-full border border-white/10 backdrop-blur-md">
                 {['FT', 'post', 'FINISHED'].includes(data.status) ? 'Full Time' : new Date(dbData.match_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
               </span>
            )}
          </div>

          <div className="flex justify-between items-center">
            {/* Home */}
            <div className="flex flex-col items-center w-1/3">
              <div className="w-16 h-16 bg-white p-3 rounded-2xl shadow-xl mb-3 flex items-center justify-center">
                 {data.home.logo ? <img src={data.home.logo} className="w-full h-full object-contain" /> : <div className="font-black text-slate-300 text-xl">{data.home.name.substring(0,1)}</div>}
              </div>
              <h2 className="font-bold text-center text-xs leading-tight opacity-90">{data.home.name}</h2>
            </div>
            {/* Score */}
            <div className="flex flex-col items-center w-1/3">
              <div className="text-5xl font-black tracking-tighter flex items-center gap-4 text-white drop-shadow-lg">
                <span>{data.home.score}</span><span className="text-slate-600 text-2xl">:</span><span>{data.away.score}</span>
              </div>
            </div>
            {/* Away */}
            <div className="flex flex-col items-center w-1/3">
              <div className="w-16 h-16 bg-white p-3 rounded-2xl shadow-xl mb-3 flex items-center justify-center">
                 {data.away.logo ? <img src={data.away.logo} className="w-full h-full object-contain" /> : <div className="font-black text-slate-300 text-xl">{data.away.name.substring(0,1)}</div>}
              </div>
              <h2 className="font-bold text-center text-xs leading-tight opacity-90">{data.away.name}</h2>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-4 -mt-6 relative z-20 space-y-4">
        {dbData.video_url && <div className="rounded-xl overflow-hidden shadow-2xl border border-white/20"><FactSportPlayer videoUrl={dbData.video_url} /></div>}

        <div className="bg-[#1A1A1A] rounded-xl p-4 shadow-xl border border-slate-800 flex items-center justify-between overflow-hidden relative">
            <div className="absolute top-0 right-0 w-20 h-full bg-gradient-to-l from-white/5 to-transparent"></div>
            <div className="flex items-center gap-3 relative z-10">
                <div className="w-10 h-10 bg-yellow-400 rounded-lg flex items-center justify-center font-black text-black shadow-lg">1X</div>
                <div>
                    <div className="text-white font-bold text-sm">Bet on 1xBet</div>
                    {dbData.booking_code ? <div className="text-yellow-400 text-xs font-mono">Code: {dbData.booking_code}</div> : <div className="text-slate-400 text-[10px]">Highest Odds Guaranteed</div>}
                </div>
            </div>
            <Link href={dbData.affiliate_link || "#"} target="_blank" className="bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-1">Bet Now <ExternalLink size={10} /></Link>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-5 border border-slate-100">
           <h3 className="text-xs font-black uppercase text-slate-800 flex items-center gap-1 mb-4"><Zap size={14} className="text-blue-600 fill-blue-600" /> Predict & Win Points</h3>
           <PredictionBoard matchId={dbData.id} matchDate={dbData.match_date} homeTeam={dbData.home_team} awayTeam={dbData.away_team} />
        </div>
      </div>

      {!data.hasExternalData ? (
          <div className="mx-4 mt-6 bg-white p-6 rounded-xl border border-slate-100 text-center shadow-sm">
              <AlertCircle className="mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-bold text-slate-500">Detailed stats unavailable.</p>
          </div>
      ) : (
        <div className="px-4 mt-8 space-y-6">
            {/* GOALS SECTION - NOW USING CLEAN ADAPTER DATA */}
            {data.goals.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                      <h3 className="text-xs font-black uppercase text-slate-400 mb-4 flex items-center gap-2"><Activity size={14} className="text-green-600" /> Goals</h3>
                      <div className="space-y-3">
                         {data.goals.map((goal: any, i: number) => {
                            // Adapter returns 'home' or 'away'
                            const isHome = goal.team === 'home'; 
                            return (
                                <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-slate-50 last:border-0">
                                    <div className={`flex-1 text-right ${isHome ? "font-bold text-slate-900" : "text-slate-300"}`}>
                                        {isHome && (
                                            <>
                                                {goal.player} 
                                                {goal.assist && <span className="text-[9px] text-slate-400 block font-normal">({goal.assist})</span>}
                                            </>
                                        )}
                                    </div>
                                    
                                    <div className="mx-3 text-xs font-mono font-bold bg-green-50 text-green-700 px-2 py-1 rounded flex items-center gap-1">
                                        {goal.time}
                                    </div>
                                    
                                    <div className={`flex-1 text-left ${!isHome ? "font-bold text-slate-900" : "text-slate-300"}`}>
                                        {!isHome && (
                                            <>
                                                {goal.player}
                                                {goal.assist && <span className="text-[9px] text-slate-400 block font-normal">({goal.assist})</span>}
                                            </>
                                        )}
                                    </div>
                                </div>
                            )
                         })}
                      </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-5">
                <StatBar label="Possession" h={data.stats.possession.h} a={data.stats.possession.a} suffix="%" />
                <StatBar label="Shots" h={data.stats.shots.h} a={data.stats.shots.a} />
                <StatBar label="Corners" h={data.stats.corners.h} a={data.stats.corners.a} />
                <StatBar label="Fouls" h={data.stats.fouls.h} a={data.stats.fouls.a} />
            </div>

            <div className="grid grid-cols-2 gap-3">
                 <RosterList title="Home" players={data.lineups.home} />
                 <RosterList title="Away" players={data.lineups.away} />
            </div>
        </div>
      )}
    </div>
  );
}

function StatBar({ label, h, a, suffix = "" }: any) {
    const total = (h + a) || 1;
    const pct = (h / total) * 100;
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-[10px] font-bold text-slate-500">
            <span>{h}{suffix}</span><span className="uppercase text-slate-300 text-[9px] tracking-wider">{label}</span><span>{a}{suffix}</span>
        </div>
        <div className="h-1.5 w-full bg-slate-100 rounded-full flex overflow-hidden">
            <div className="h-full bg-blue-600" style={{ width: `${pct}%` }}></div><div className="h-full bg-red-600 flex-1"></div>
        </div>
      </div>
    );
}

function RosterList({ title, players }: any) {
    return (
        <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
            <div className="border-b border-slate-100 pb-2 mb-2 font-black text-[10px] text-slate-400 uppercase">{title}</div>
            <ul className="space-y-1">
                {players.length > 0 ? players.map((p:any) => (
                    <li key={p.athlete?.id || Math.random()} className="text-[10px] font-bold text-slate-600 flex gap-2">
                        <span className="text-slate-300 w-4">{p.jersey}</span> {p.athlete?.displayName || "Player"}
                    </li>
                )) : <li className="text-[10px] text-slate-300 italic">Not available</li>}
            </ul>
        </div>
    )
}