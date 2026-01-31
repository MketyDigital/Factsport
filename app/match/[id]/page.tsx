export const runtime = 'edge';

import { createClient } from '@/app/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Zap, ExternalLink, AlertCircle, Activity, Mic, AlignLeft, Radio, PlayCircle, Video } from 'lucide-react';
import FactSportPlayer from '@/app/components/FactSportPlayer';
import PredictionBoard from '@/app/components/PredictionBoard';
import BettingPromo from '@/app/components/BettingPromo';
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

  const data = await getExternalData(dbData);

  // 🧠 SMART MEDIA LOGIC
  const activeVideoUrl = dbData.livestream_url || dbData.video_url;
  const isLiveStream = !!dbData.livestream_url; 

  // 🕒 STATUS LOGIC (HT FIX)
  const isHalfTime = data.status === 'HT' || data.status === 'Half Time' || data.status === 'Break';
  const isLive = ['LIVE', '1H', '2H', 'ET', 'P', 'in'].includes(data.status) && !isHalfTime;

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
          
          {/* ✅ FIXED STATUS BADGE */}
          <div className="flex justify-center mb-6">
            {isHalfTime ? (
               <span className="bg-slate-200 text-slate-900 text-[10px] font-black px-4 py-1.5 rounded-full flex items-center gap-1 shadow-lg animate-pulse border border-white/20">
                 HALF TIME
               </span>
            ) : isLive ? (
               <span className="bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-full animate-pulse flex items-center gap-1 shadow-lg">
                 <span className="w-1.5 h-1.5 bg-white rounded-full"></span> LIVE {data.displayClock}'
               </span>
            ) : (
               <span className="bg-white/10 text-slate-300 text-[10px] font-bold px-3 py-1 rounded-full border border-white/10 backdrop-blur-md">
                 {['FT', 'post', 'FINISHED'].includes(data.status) ? 'Full Time' : new Date(dbData.match_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
               </span>
            )}
          </div>

          <div className="flex justify-between items-center">
            <div className="flex flex-col items-center w-1/3">
              <div className="w-16 h-16 bg-white p-3 rounded-2xl shadow-xl mb-3 flex items-center justify-center">
                 {data.home.logo ? <img src={data.home.logo} className="w-full h-full object-contain" /> : <div className="font-black text-slate-300 text-xl">{data.home.name.substring(0,1)}</div>}
              </div>
              <h2 className="font-bold text-center text-xs leading-tight opacity-90">{data.home.name}</h2>
            </div>
            <div className="flex flex-col items-center w-1/3">
              <div className="text-5xl font-black tracking-tighter flex items-center gap-4 text-white drop-shadow-lg">
                <span>{data.home.score}</span><span className="text-slate-600 text-2xl">:</span><span>{data.away.score}</span>
              </div>
            </div>
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
        
        {/* 1. VIDEO PLAYER (Youtube Live or Highlights) */}
        {activeVideoUrl && (
            <div className="rounded-xl overflow-hidden shadow-2xl border border-white/20 relative bg-black">
                <div className="absolute top-3 left-3 z-30 pointer-events-none">
                    {isLiveStream ? (
                        <div className="bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded flex items-center gap-1 animate-pulse shadow-md">
                            <Video size={10} /> LIVE WATCHALONG
                        </div>
                    ) : (
                        <div className="bg-black/60 backdrop-blur text-white text-[9px] font-bold px-2 py-0.5 rounded border border-white/10 flex items-center gap-1">
                            <PlayCircle size={10} /> HIGHLIGHTS
                        </div>
                    )}
                </div>
                <FactSportPlayer videoUrl={activeVideoUrl} />
            </div>
        )}

        {/* 2. AUDIO PLAYER */}
        <div className="bg-[#0f172a] rounded-xl p-3 border border-slate-800 shadow-xl flex items-center justify-between">
             <div className="flex items-center gap-3">
                 <div className={`w-10 h-10 rounded-full flex items-center justify-center ${dbData.audio_url ? 'bg-red-600 animate-pulse shadow-lg shadow-red-900/50' : 'bg-slate-800'}`}>
                    <Mic className="text-white" size={20} />
                 </div>
                 <div>
                    <h3 className="text-white font-bold text-xs">Live Audio Commentary</h3>
                    <p className="text-slate-400 text-[10px]">
                        {dbData.audio_url ? "Radio is currently LIVE" : "Tune in when match starts"}
                    </p>
                 </div>
             </div>
             
             {dbData.audio_url ? (
                 <Link 
                    href={dbData.audio_url} 
                    target="_blank"
                    className="bg-white text-black hover:bg-slate-200 text-[10px] font-black px-4 py-2 rounded-full shadow-lg transition transform active:scale-95 flex items-center gap-1"
                 >
                    LISTEN LIVE <ExternalLink size={10} />
                 </Link>
             ) : (
                 <button disabled className="bg-slate-700 text-slate-500 text-[10px] font-bold px-3 py-1.5 rounded-full cursor-not-allowed border border-white/5 opacity-50">
                      OFF AIR
                 </button>
             )}
        </div>

        {/* 3. BETTING BANNER */}
        <BettingPromo affiliateLink={dbData.affiliate_link} />

        {/* 4. PREDICTIONS */}
        <div className="bg-white rounded-xl shadow-lg p-5 border border-slate-100">
           <h3 className="text-xs font-black uppercase text-slate-800 flex items-center gap-1 mb-4"><Zap size={14} className="text-blue-600 fill-blue-600" /> Predict & Win Points</h3>
           <PredictionBoard matchId={dbData.id} matchDate={dbData.match_date} homeTeam={dbData.home_team} awayTeam={dbData.away_team} />
        </div>
      </div>

      {/* STATS SECTION */}
      {!data.hasExternalData ? (
          <div className="mx-4 mt-6 bg-white p-6 rounded-xl border border-slate-100 text-center shadow-sm">
              <AlertCircle className="mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-bold text-slate-500">Detailed stats unavailable.</p>
          </div>
      ) : (
        <div className="px-4 mt-8 space-y-6">
             {/* GOALS */}
             {data.goals.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                      <h3 className="text-xs font-black uppercase text-slate-400 mb-4 flex items-center gap-2"><Activity size={14} className="text-green-600" /> Goals</h3>
                      <div className="space-y-3">
                          {data.goals.map((goal: any, i: number) => {
                            const isHome = goal.team === 'home'; 
                            return (
                                <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-slate-50 last:border-0">
                                    <div className={`flex-1 text-right ${isHome ? "font-bold text-slate-900" : "text-slate-300"}`}>{isHome && <>{goal.player} {goal.assist && <span className="text-[9px] text-slate-400 block font-normal">({goal.assist})</span>}</>}</div>
                                    <div className="mx-3 text-xs font-mono font-bold bg-green-50 text-green-700 px-2 py-1 rounded flex items-center gap-1">{goal.time}</div>
                                    <div className={`flex-1 text-left ${!isHome ? "font-bold text-slate-900" : "text-slate-300"}`}>{!isHome && <>{goal.player}{goal.assist && <span className="text-[9px] text-slate-400 block font-normal">({goal.assist})</span>}</>}</div>
                                </div>
                            )
                          })}
                      </div>
                </div>
            )}

            {/* AUTOMATED COMMENTARY */}
            {data.commentary.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                    <h3 className="text-xs font-black uppercase text-slate-400 mb-4 flex items-center gap-2">
                        <AlignLeft size={14} className="text-blue-500" /> Live Feed
                    </h3>
                    <div className="space-y-4 max-h-60 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
                        {data.commentary.map((c: any) => (
                            <div key={c.id || Math.random()} className="flex gap-3 text-xs">
                                <div className="font-mono font-bold text-blue-600 min-w-[24px] pt-0.5 text-right">
                                    {c.time ? `${c.time}'` : <span className="text-slate-300 text-lg leading-none">•</span>}
                                </div>
                                <p className="text-slate-700 leading-relaxed font-medium">{c.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {/* STATS BARS */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-5">
                <StatBar label="Possession" h={data.stats.possession.h} a={data.stats.possession.a} suffix="%" />
                <StatBar label="Shots" h={data.stats.shots.h} a={data.stats.shots.a} />
                <StatBar label="Corners" h={data.stats.corners.h} a={data.stats.corners.a} />
                <StatBar label="Fouls" h={data.stats.fouls.h} a={data.stats.fouls.a} />
            </div>

            {/* LINEUPS */}
            <div className="grid grid-cols-2 gap-3">
                 <RosterList title="Home" players={data.lineups.home} />
                 <RosterList title="Away" players={data.lineups.away} />
            </div>
        </div>
      )}
    </div>
  );
}

// Helper Components (Keep these as they were)
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