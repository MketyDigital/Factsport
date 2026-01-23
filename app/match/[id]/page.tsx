export const runtime = 'edge';

import { createClient } from '@/app/lib/supabase/server';
import Link from 'next/link';
import { 
  ChevronLeft, Zap, TrendingUp, Users, 
  ExternalLink, AlertCircle, Bug 
} from 'lucide-react';
import FactSportPlayer from '@/app/components/FactSportPlayer';
import PredictionBoard from '@/app/components/PredictionBoard';

// --- DATA FETCHING ---
async function getSupabaseData(id: string) {
    const supabase = createClient();
    try {
        // We removed the Regex check to prevent false positives
        const { data, error } = await supabase.from('matches').select('*').eq('id', id).single();
        if (error) {
            console.error("Supabase Error:", error);
            return null;
        }
        return data;
    } catch (e) {
        console.error("Unexpected Error:", e);
        return null;
    }
}

async function getEspnData(dbData: any) {
  if (!dbData) return null;
  try {
    // Strategy A: Saved ID
    if (dbData.api_id) {
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${dbData.api_id}`, { next: { revalidate: 60 } });
        if (res.ok) {
            const data = await res.json();
            if (data?.header) return data;
        }
    }

    // Strategy B: Auto-Search
    const dateObj = new Date(dbData.match_date);
    if (isNaN(dateObj.getTime())) return null;
    
    const dateStr = dateObj.toISOString().slice(0, 10).replace(/-/g, "");
    
    const searchRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates=${dateStr}`, { next: { revalidate: 60 } });
    if (!searchRes.ok) return null;
    
    const searchData = await searchRes.json();
    if (!searchData?.events) return null;

    const foundEvent = searchData.events.find((e: any) => {
        const name = e.name?.toLowerCase() || "";
        const h = dbData.home_team?.toLowerCase() || "xxx";
        const a = dbData.away_team?.toLowerCase() || "xxx";
        return (name.includes(h) || name.includes(a));
    });

    if (foundEvent) {
        const detailRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${foundEvent.id}`, { next: { revalidate: 60 } });
        if (detailRes.ok) return detailRes.json();
    }
    
    return null;
  } catch (e) {
    return null; 
  }
}

export default async function MatchDetailsPage({ params }: { params: { id: string } }) {
  // 1. FIX: Await params (Critical for Next.js 15+)
  const resolvedParams = await params; 
  const matchId = resolvedParams?.id;

  if (!matchId) {
      return <ErrorDisplay message="No Match ID found in URL" />;
  }

  // 2. Fetch DB Data
  const dbData = await getSupabaseData(matchId);

  // 3. DEBUG VIEW: If DB fails, tell us why instead of 404ing
  if (!dbData) {
      return <ErrorDisplay message={`Match not found in Database. ID: ${matchId}`} />;
  }

  const espnData = await getEspnData(dbData);
  
  // Safe Parsing
  const header = espnData?.header;
  const boxscore = espnData?.boxscore;
  const rosters = espnData?.rosters;

  const homeComp = header?.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === 'home');
  const awayComp = header?.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === 'away');

  const homeTeam = {
      id: homeComp?.team?.id || 'db_home',
      name: homeComp?.team?.name || dbData.home_team,
      logo: homeComp?.team?.logos?.[0]?.href || dbData.home_logo,
      score: homeComp?.score ?? dbData.home_score
  };

  const awayTeam = {
      id: awayComp?.team?.id || 'db_away',
      name: awayComp?.team?.name || dbData.away_team,
      logo: awayComp?.team?.logos?.[0]?.href || dbData.away_logo,
      score: awayComp?.score ?? dbData.away_score
  };
  
  const matchStatus = header?.competitions?.[0]?.status?.type?.state || 'pre';
  const displayClock = header?.competitions?.[0]?.status?.displayClock || '';

  const getStat = (teamId: string, statName: string) => {
    if (!boxscore?.teams) return "0";
    const teamObj = boxscore.teams.find((t: any) => t.team?.id === teamId);
    if (!teamObj?.statistics) return "0";
    const statObj = teamObj.statistics.find((s: any) => s.name === statName);
    return statObj?.displayValue || "0";
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 pb-24 font-sans">
      
      {/* HEADER */}
      <div className="relative bg-[#0a1428] text-white pb-8 rounded-b-[2.5rem] overflow-hidden shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="relative z-10 p-4 flex items-center justify-between">
          <Link href="/" className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition backdrop-blur-md">
            <ChevronLeft size={24} />
          </Link>
          <span className="text-xs font-bold tracking-widest opacity-70 uppercase">{dbData.league || header?.league?.name}</span>
          <div className="w-10"></div>
        </div>

        <div className="relative z-10 px-4 mt-2">
          {/* Status */}
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
                 {homeTeam.logo ? 
                    <img src={homeTeam.logo} className="w-full h-full object-contain" /> : 
                    <div className="font-black text-slate-300 text-xl">{homeTeam.name?.substring(0,1)}</div>
                 }
              </div>
              <h2 className="font-bold text-center text-xs leading-tight opacity-90">{homeTeam.name}</h2>
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
                 {awayTeam.logo ? 
                    <img src={awayTeam.logo} className="w-full h-full object-contain" /> : 
                    <div className="font-black text-slate-300 text-xl">{awayTeam.name?.substring(0,1)}</div>
                 }
              </div>
              <h2 className="font-bold text-center text-xs leading-tight opacity-90">{awayTeam.name}</h2>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-4 -mt-6 relative z-20 space-y-4">
        {dbData.video_url && (
            <div className="rounded-xl overflow-hidden shadow-2xl border border-white/20">
                <FactSportPlayer videoUrl={dbData.video_url} />
            </div>
        )}

        {/* Affiliate Card */}
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

        <div className="bg-white rounded-xl shadow-lg p-5 border border-slate-100">
           <h3 className="text-xs font-black uppercase text-slate-800 flex items-center gap-1 mb-4">
               <Zap size={14} className="text-blue-600 fill-blue-600" /> Predict & Win Points
           </h3>
           <PredictionBoard matchId={dbData.id} matchDate={dbData.match_date} homeTeam={dbData.home_team} awayTeam={dbData.away_team} />
        </div>
      </div>

      {/* RICH DATA (STATS & LINEUPS ONLY) */}
      {!espnData ? (
          <div className="mx-4 mt-6 bg-white p-6 rounded-xl border border-slate-100 text-center shadow-sm">
              <AlertCircle className="mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-bold text-slate-500">Stats unavailable.</p>
              <p className="text-[10px] text-slate-400">Sync pending.</p>
          </div>
      ) : (
        <div className="px-4 mt-8 space-y-8">
            
            {/* STATS */}
            {boxscore && (
            <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <TrendingUp size={14} /> Match Stats
                </h3>
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-5">
                    <StatBar label="Possession" h={getStat(homeTeam.id, "possessionPct")} a={getStat(awayTeam.id, "possessionPct")} suffix="%" />
                    <StatBar label="Shots (On Target)" h={getStat(homeTeam.id, "shotsSummary")} a={getStat(awayTeam.id, "shotsSummary")} />
                    <StatBar label="Corners" h={getStat(homeTeam.id, "corners")} a={getStat(awayTeam.id, "corners")} />
                    <StatBar label="Fouls" h={getStat(homeTeam.id, "foulsCommitted")} a={getStat(awayTeam.id, "foulsCommitted")} />
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
                            {rosters.find((r:any) => r.team?.id === homeTeam.id)?.roster?.filter((p:any) => p.starter).map((p:any) => (
                                <li key={p.athlete?.id || Math.random()} className="text-[10px] font-bold text-slate-600 flex gap-2">
                                    <span className="text-slate-300 w-4">{p.jersey}</span> {p.athlete?.displayName || "Player"}
                                </li>
                            )) || <li className="text-[10px] text-slate-300 italic">Not available</li>}
                        </ul>
                    </div>
                    <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
                        <div className="border-b border-slate-100 pb-2 mb-2 font-black text-[10px] text-slate-400 uppercase">Away</div>
                        <ul className="space-y-1">
                            {rosters.find((r:any) => r.team?.id === awayTeam.id)?.roster?.filter((p:any) => p.starter).map((p:any) => (
                                <li key={p.athlete?.id || Math.random()} className="text-[10px] font-bold text-slate-600 flex gap-2">
                                    <span className="text-slate-300 w-4">{p.jersey}</span> {p.athlete?.displayName || "Player"}
                                </li>
                            )) || <li className="text-[10px] text-slate-300 italic">Not available</li>}
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

// Debug Component to show you WHY it failed
function ErrorDisplay({ message }: { message: string }) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-white text-slate-900 p-6">
            <Bug className="text-red-500 mb-4" size={48} />
            <h1 className="text-xl font-bold mb-2">Debug Info</h1>
            <p className="font-mono bg-slate-100 p-4 rounded text-xs">{message}</p>
            <Link href="/" className="mt-6 text-blue-600 underline text-sm">Return Home</Link>
        </div>
    );
}

// Simple Helper for Stats Bars
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