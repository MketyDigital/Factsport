export const runtime = 'edge';

import { createClient } from '@/app/lib/supabase/server';
import { notFound } from "next/navigation";
import Link from 'next/link';
import { 
  ChevronLeft, Zap, TrendingUp, Users, Clock, 
  PlayCircle, ExternalLink, AlertCircle
} from 'lucide-react';
import FactSportPlayer from '@/app/components/FactSportPlayer';
import PredictionBoard from '@/app/components/PredictionBoard';

// 1. Fetch Supabase Data
async function getSupabaseData(id: string) {
    const supabase = createClient();
    const { data } = await supabase.from('matches').select('*').eq('id', id).single();
    return data;
}

// 2. SMART FETCH: Try ID first, if missing, Search ESPN
async function getEspnData(dbData: any) {
  try {
    // A. Fast Path: We have the ID
    if (dbData.api_id) {
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${dbData.api_id}`, { next: { revalidate: 60 } });
        if (res.ok) return res.json();
    }

    // B. Slow Path: Auto-Search (The Magic)
    // Format date to YYYYMMDD
    const dateStr = new Date(dbData.match_date).toISOString().slice(0, 10).replace(/-/g, "");
    console.log(`Auto-detecting match for ${dbData.home_team} vs ${dbData.away_team} on ${dateStr}...`);
    
    const searchRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates=${dateStr}`, { next: { revalidate: 60 } });
    const searchData = await searchRes.json();
    
    // Find the match in the daily scoreboard
    const foundEvent = searchData.events?.find((e: any) => {
        const name = e.name.toLowerCase();
        const h = dbData.home_team.toLowerCase();
        const a = dbData.away_team.toLowerCase();
        // Loose matching
        return (name.includes(h) || name.includes(a));
    });

    if (foundEvent) {
        // Found it! Fetch the full details now
        const detailRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${foundEvent.id}`, { next: { revalidate: 60 } });
        if (detailRes.ok) return detailRes.json();
    }
    
    return null; // Truly not found
  } catch (e) {
    console.error("ESPN Fetch Error:", e);
    return null;
  }
}

export default async function MatchDetailsPage({ params }: { params: { id: string } }) {
  const dbData = await getSupabaseData(params.id);
  if (!dbData) return notFound();

  // This now handles both scenarios (ID exists OR it searches)
  const espnData = await getEspnData(dbData);
  
  // Data Parsing
  const header = espnData?.header;
  const boxscore = espnData?.boxscore;
  const rosters = espnData?.rosters;
  const timeline = header?.competitions?.[0]?.details || [];

  // Fallback Data (If ESPN fails entirely, show DB data)
  const homeTeam = header ? header.competitions[0].competitors.find((c: any) => c.homeAway === 'home') : { team: { name: dbData.home_team }, score: dbData.home_score };
  const awayTeam = header ? header.competitions[0].competitors.find((c: any) => c.homeAway === 'away') : { team: { name: dbData.away_team }, score: dbData.away_score };
  
  const matchStatus = header ? header.competitions[0].status.type.state : 'pre';
  const displayClock = header ? header.competitions[0].status.displayClock : '';

  // Stats Helper
  const getStat = (id: string, name: string) => {
    const teamStats = boxscore?.teams?.find((t: any) => t.team.id === id)?.statistics;
    return teamStats?.find((s: any) => s.name === name)?.displayValue || "0";
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 pb-24 font-sans">
      
      {/* 1. HEADER (Scoreboard) */}
      <div className="relative bg-[#0a1428] text-white pb-8 rounded-b-[2.5rem] overflow-hidden shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        
        {/* Nav */}
        <div className="relative z-10 p-4 flex items-center justify-between">
          <Link href="/" className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition backdrop-blur-md">
            <ChevronLeft size={24} />
          </Link>
          <span className="text-xs font-bold tracking-widest opacity-70 uppercase">{dbData.league || header?.league?.name}</span>
          <div className="w-10"></div>
        </div>

        {/* Score Area */}
        <div className="relative z-10 px-4 mt-2">
          {/* Status Badge */}
          <div className="flex justify-center mb-6">
            {matchStatus === 'in' ? (
               <span className="bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-full animate-pulse flex items-center gap-1 shadow-lg shadow-red-900/50">
                 <span className="w-1.5 h-1.5 bg-white rounded-full"></span> LIVE {displayClock}'
               </span>
            ) : (
               <span className="bg-white/10 text-slate-300 text-[10px] font-bold px-3 py-1 rounded-full border border-white/10 backdrop-blur-md flex items-center gap-1">
                 {matchStatus === 'post' ? 'Full Time' : new Date(dbData.match_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
               </span>
            )}
          </div>

          <div className="flex justify-between items-center">
            {/* Home */}
            <div className="flex flex-col items-center w-1/3">
              <div className="w-16 h-16 bg-white p-3 rounded-2xl shadow-xl shadow-blue-900/40 mb-3 flex items-center justify-center">
                 {homeTeam.team.logos?.[0]?.href || dbData.home_logo ? 
                    <img src={homeTeam.team.logos?.[0]?.href || dbData.home_logo} className="w-full h-full object-contain" /> : 
                    <div className="font-black text-slate-300 text-xl">{homeTeam.team.name?.substring(0,1)}</div>
                 }
              </div>
              <h2 className="font-bold text-center text-xs leading-tight opacity-90">{homeTeam.team.name || homeTeam.team.shortDisplayName}</h2>
            </div>

            {/* Score */}
            <div className="flex flex-col items-center w-1/3">
              <div className="text-5xl font-black tracking-tighter flex items-center gap-4 text-white drop-shadow-lg">
                <span>{homeTeam.score ?? 0}</span>
                <span className="text-slate-600 text-2xl">:</span>
                <span>{awayTeam.score ?? 0}</span>
              </div>
            </div>

            {/* Away */}
            <div className="flex flex-col items-center w-1/3">
              <div className="w-16 h-16 bg-white p-3 rounded-2xl shadow-xl shadow-red-900/40 mb-3 flex items-center justify-center">
                 {awayTeam.team.logos?.[0]?.href || dbData.away_logo ? 
                    <img src={awayTeam.team.logos?.[0]?.href || dbData.away_logo} className="w-full h-full object-contain" /> : 
                    <div className="font-black text-slate-300 text-xl">{awayTeam.team.name?.substring(0,1)}</div>
                 }
              </div>
              <h2 className="font-bold text-center text-xs leading-tight opacity-90">{awayTeam.team.name || awayTeam.team.shortDisplayName}</h2>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-4 -mt-6 relative z-20 space-y-4">
        
        {/* 2. VIDEO PLAYER */}
        {dbData.video_url && (
            <div className="rounded-xl overflow-hidden shadow-2xl border border-white/20">
                <FactSportPlayer videoUrl={dbData.video_url} />
            </div>
        )}

        {/* 3. REVENUE CARD */}
        <div className="bg-[#1A1A1A] rounded-xl p-4 shadow-xl border border-slate-800 flex items-center justify-between overflow-hidden relative">
            <div className="absolute top-0 right-0 w-20 h-full bg-gradient-to-l from-white/5 to-transparent"></div>
            <div className="flex items-center gap-3 relative z-10">
                <div className="w-10 h-10 bg-yellow-400 rounded-lg flex items-center justify-center font-black text-black shadow-lg">1X</div>
                <div>
                    <div className="text-white font-bold text-sm">Bet on 1xBet</div>
                    {dbData.booking_code ? (
                        <div className="text-yellow-400 text-xs font-mono">Code: <span className="font-black bg-yellow-400/20 px-1 rounded">{dbData.booking_code}</span></div>
                    ) : <div className="text-slate-400 text-[10px]">Highest Odds Guaranteed</div>}
                </div>
            </div>
            <Link href={dbData.affiliate_link || "https://bit.ly/your-affiliate-link"} target="_blank" className="bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black px-4 py-2.5 rounded-lg shadow-lg active:scale-95 transition flex items-center gap-1">
                Bet Now <ExternalLink size={10} />
            </Link>
        </div>

        {/* 4. PREDICTION BOARD */}
        <div className="bg-white rounded-xl shadow-lg p-5 border border-slate-100">
           <h3 className="text-xs font-black uppercase text-slate-800 flex items-center gap-1 mb-4">
               <Zap size={14} className="text-blue-600 fill-blue-600" /> Predict & Win Points
           </h3>
           <PredictionBoard matchId={dbData.id} matchDate={dbData.match_date} homeTeam={dbData.home_team} awayTeam={dbData.away_team} />
        </div>
      </div>

      {/* 5. RICH STATS SECTIONS (Now Auto-Appears) */}
      {!espnData ? (
          <div className="mx-4 mt-6 bg-white p-6 rounded-xl border border-slate-100 text-center shadow-sm">
              <AlertCircle className="mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-bold text-slate-500">Stats syncing from live feed...</p>
              <p className="text-[10px] text-slate-400">Check back in a moment.</p>
          </div>
      ) : (
        <div className="px-4 mt-8 space-y-8">
            
            {/* TIMELINE */}
            <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Clock size={14} /> Key Events
                </h3>
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-2">
                    {timeline.length > 0 ? timeline.map((event: any, i: number) => {
                        const isHome = event.team?.id === homeTeam.team.id;
                        const type = event.type?.text?.toLowerCase() || "";
                        let icon = <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>;
                        if(type.includes('goal')) icon = <span className="text-sm">⚽</span>;
                        if(type.includes('yellow')) icon = <div className="w-3 h-4 bg-yellow-400 rounded-[1px] border border-yellow-500"></div>;
                        if(type.includes('red')) icon = <div className="w-3 h-4 bg-red-600 rounded-[1px] border border-red-700"></div>;

                        return (
                            <div key={i} className={`flex items-center gap-3 p-3 border-b border-slate-50 last:border-0 ${i % 2 === 0 ? 'bg-slate-50/50' : ''}`}>
                                <span className="font-black text-slate-400 text-xs w-8 text-center">{event.clock?.displayValue}'</span>
                                <div className="flex-1 flex items-center gap-3">
                                    {isHome ? (
                                        <>
                                            <div className="flex justify-center w-6">{icon}</div>
                                            <div className="flex-1"><span className="font-bold text-xs text-slate-800 block">{event.text}</span>{event.participants?.[0] && <span className="text-[9px] text-slate-400">{event.participants[0].athlete.displayName}</span>}</div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex-1 text-right"><span className="font-bold text-xs text-slate-800 block">{event.text}</span>{event.participants?.[0] && <span className="text-[9px] text-slate-400">{event.participants[0].athlete.displayName}</span>}</div>
                                            <div className="flex justify-center w-6">{icon}</div>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    }) : <div className="text-center text-slate-400 text-xs py-6">No events recorded.</div>}
                </div>
            </div>

            {/* STATS */}
            {boxscore && (
            <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <TrendingUp size={14} /> Match Stats
                </h3>
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-5">
                    <StatBar label="Possession" h={getStat(homeTeam.team.id, "possessionPct")} a={getStat(awayTeam.team.id, "possessionPct")} suffix="%" />
                    <StatBar label="Shots (On Target)" h={getStat(homeTeam.team.id, "shotsSummary")} a={getStat(awayTeam.team.id, "shotsSummary")} />
                    <StatBar label="Corners" h={getStat(homeTeam.team.id, "corners")} a={getStat(awayTeam.team.id, "corners")} />
                    <StatBar label="Fouls" h={getStat(homeTeam.team.id, "foulsCommitted")} a={getStat(awayTeam.team.id, "foulsCommitted")} />
                </div>
            </div>
            )}

            {/* LINEUPS */}
            {rosters && (
            <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Users size={14} /> Lineups
                </h3>
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
                        <div className="border-b border-slate-100 pb-2 mb-2 font-black text-[10px] text-slate-400 uppercase">Home</div>
                        <ul className="space-y-1">
                            {rosters.find((r:any) => r.team.id === homeTeam.team.id)?.roster?.filter((p:any) => p.starter).map((p:any) => (
                                <li key={p.athlete.id} className="text-[10px] font-bold text-slate-600 flex gap-2"><span className="text-slate-300 w-4">{p.jersey}</span> {p.athlete.displayName}</li>
                            ))}
                        </ul>
                    </div>
                    <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
                        <div className="border-b border-slate-100 pb-2 mb-2 font-black text-[10px] text-slate-400 uppercase">Away</div>
                        <ul className="space-y-1">
                            {rosters.find((r:any) => r.team.id === awayTeam.team.id)?.roster?.filter((p:any) => p.starter).map((p:any) => (
                                <li key={p.athlete.id} className="text-[10px] font-bold text-slate-600 flex gap-2"><span className="text-slate-300 w-4">{p.jersey}</span> {p.athlete.displayName}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
            )}
        </div>
      )}
    </div>
  );
}

// Helper for Stats Bars
function StatBar({ label, h, a, suffix = "" }: any) {
    const hVal = parseInt(h) || 0;
    const aVal = parseInt(a) || 0;
    const total = hVal + aVal || 1;
    const pct = (hVal / total) * 100;
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-[10px] font-bold text-slate-500">
            <span>{h}{suffix}</span>
            <span className="uppercase text-slate-300 text-[9px] tracking-wider">{label}</span>
            <span>{a}{suffix}</span>
        </div>
        <div className="h-1.5 w-full bg-slate-100 rounded-full flex overflow-hidden">
            <div className="h-full bg-blue-600" style={{ width: `${pct}%` }}></div>
            <div className="h-full bg-red-600 flex-1"></div>
        </div>
      </div>
    );
}