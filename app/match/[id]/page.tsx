// ✅ RUNS ON EDGE
export const runtime = 'edge';

import { createClient } from '@/app/lib/supabase/server';
import { notFound } from "next/navigation";
import Link from 'next/link';
import { 
  ChevronLeft, Calendar, MapPin, Zap, TrendingUp, Users, 
  Clock, PlayCircle, Ticket, ExternalLink, ArrowRight, Lock, Copy 
} from 'lucide-react';
import FactSportPlayer from '@/app/components/FactSportPlayer';
import PredictionBoard from '@/app/components/PredictionBoard';

// 1. Fetch "Revenue Data" (Codes, Videos, Internal ID) from Supabase
async function getSupabaseData(id: string) {
    const supabase = createClient();
    // We fetch by ID (UUID). This is the source of truth.
    const { data } = await supabase.from('matches').select('*').eq('id', id).single();
    return data;
}

// 2. Fetch Live Data from ESPN using the API_ID from Supabase
async function getEspnData(apiId: string) {
  if (!apiId) return null;
  try {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${apiId}`, {
        next: { revalidate: 30 } // Cache for 30s
    });
    if (!res.ok) return null;
    return res.json();
  } catch (e) {
    return null;
  }
}

export default async function MatchDetailsPage({ params }: { params: { id: string } }) {
  // A. Get Internal Match Data First
  const dbData = await getSupabaseData(params.id);

  if (!dbData) return notFound();

  // B. Get Live ESPN Data (using the stored api_id)
  const espnData = await getEspnData(dbData.api_id);

  // C. Fallback: If ESPN fails, use DB data for basic names
  const header = espnData?.header;
  const boxscore = espnData?.boxscore;
  const gameInfo = espnData?.gameInfo;
  const rosters = espnData?.rosters;
  const timeline = header?.competitions?.[0]?.details || [];

  // Parse Teams (Use ESPN if available, else DB)
  const homeTeamName = header ? header.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.name : dbData.home_team;
  const awayTeamName = header ? header.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.name : dbData.away_team;
  
  const homeScore = header ? header.competitions[0].competitors.find((c: any) => c.homeAway === 'home').score : dbData.home_score;
  const awayScore = header ? header.competitions[0].competitors.find((c: any) => c.homeAway === 'away').score : dbData.away_score;
  
  const homeLogo = header ? header.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.logos?.[0]?.href : dbData.home_logo;
  const awayLogo = header ? header.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.logos?.[0]?.href : dbData.away_logo;

  const matchStatus = header ? header.competitions[0].status.type.state : 'pre'; // pre, in, post
  const displayClock = header ? header.competitions[0].status.displayClock : '';

  // Helper for Stats
  const getStat = (homeAway: string, name: string) => {
    if (!boxscore) return "0";
    const team = header.competitions[0].competitors.find((c: any) => c.homeAway === homeAway);
    const teamStats = boxscore.teams?.find((t: any) => t.team.id === team.id)?.statistics;
    return teamStats?.find((s: any) => s.name === name)?.displayValue || "0";
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 pb-24 font-sans">
      
      {/* --- 1. HEADER (Scoreboard) --- */}
      <div className="relative bg-[#0a1428] text-white pb-6 rounded-b-[2rem] overflow-hidden shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        
        {/* Nav */}
        <div className="relative z-10 p-4 flex items-center justify-between">
          <Link href="/" className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition">
            <ChevronLeft size={24} />
          </Link>
          <span className="text-xs font-bold tracking-widest opacity-70 uppercase">{dbData.league || header?.league?.name}</span>
          <div className="w-10"></div>
        </div>

        {/* Score Area */}
        <div className="relative z-10 px-4 mt-2">
          {/* Status */}
          <div className="flex justify-center mb-6">
            {matchStatus === 'in' ? (
               <span className="bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-full animate-pulse flex items-center gap-1">
                 <span className="w-1.5 h-1.5 bg-white rounded-full"></span> LIVE {displayClock}'
               </span>
            ) : (
               <span className="bg-white/10 text-slate-300 text-[10px] font-bold px-3 py-1 rounded-full border border-white/10 flex items-center gap-1">
                 {matchStatus === 'post' ? 'Full Time' : new Date(dbData.match_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
               </span>
            )}
          </div>

          <div className="flex justify-between items-center">
            {/* Home */}
            <div className="flex flex-col items-center w-1/3">
              <div className="w-16 h-16 bg-white p-2 rounded-full shadow-lg shadow-blue-900/50 mb-2">
                 {homeLogo ? <img src={homeLogo} className="w-full h-full object-contain" /> : <div className="w-full h-full bg-slate-200 rounded-full"></div>}
              </div>
              <h2 className="font-bold text-center text-xs leading-tight">{homeTeamName}</h2>
            </div>

            {/* Score */}
            <div className="flex flex-col items-center w-1/3">
              <div className="text-4xl font-black tracking-tighter flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/10">
                <span>{homeScore ?? 0}</span>
                <span className="text-slate-500 text-2xl">:</span>
                <span>{awayScore ?? 0}</span>
              </div>
            </div>

            {/* Away */}
            <div className="flex flex-col items-center w-1/3">
              <div className="w-16 h-16 bg-white p-2 rounded-full shadow-lg shadow-red-900/50 mb-2">
                 {awayLogo ? <img src={awayLogo} className="w-full h-full object-contain" /> : <div className="w-full h-full bg-slate-200 rounded-full"></div>}
              </div>
              <h2 className="font-bold text-center text-xs leading-tight">{awayTeamName}</h2>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-4 -mt-4 relative z-20 space-y-3">
        
        {/* --- 2. VIDEO PLAYER (If available) --- */}
        {dbData.video_url && (
            <div className="rounded-xl overflow-hidden shadow-2xl border border-white/20">
                <FactSportPlayer videoUrl={dbData.video_url} />
            </div>
        )}

        {/* --- 3. REVENUE CARD (Betting) --- */}
        <div className="bg-[#1A1A1A] rounded-xl p-4 shadow-xl border border-slate-800 flex items-center justify-between overflow-hidden relative">
            <div className="absolute top-0 right-0 w-20 h-full bg-gradient-to-l from-white/5 to-transparent"></div>
            
            <div className="flex items-center gap-3 relative z-10">
                <div className="w-10 h-10 bg-yellow-400 rounded-lg flex items-center justify-center font-black text-black shadow-lg">1X</div>
                <div>
                    <div className="text-white font-bold text-sm">Bet on 1xBet</div>
                    {dbData.booking_code ? (
                        <div className="text-yellow-400 text-xs font-mono">Code: <span className="font-black bg-yellow-400/20 px-1 rounded">{dbData.booking_code}</span></div>
                    ) : (
                        <div className="text-slate-400 text-[10px]">Highest Odds Guaranteed</div>
                    )}
                </div>
            </div>
            
            <Link href={dbData.affiliate_link || "https://bit.ly/your-affiliate-link"} target="_blank" className="bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black px-4 py-2.5 rounded-lg shadow-lg active:scale-95 transition flex items-center gap-1">
                Bet Now <ExternalLink size={10} />
            </Link>
        </div>

        {/* --- 4. PREDICTION BOARD (Interactive) --- */}
        <div className="bg-white rounded-xl shadow-lg p-5 border border-slate-100">
           <h3 className="text-xs font-black uppercase text-slate-800 flex items-center gap-1 mb-4">
               <Zap size={14} className="text-blue-600 fill-blue-600" /> Predict & Win Points
           </h3>
           
           <PredictionBoard 
                matchId={dbData.id} // ✅ Uses Supabase UUID
                matchDate={dbData.match_date} 
                homeTeam={homeTeamName} 
                awayTeam={awayTeamName} 
           />
        </div>
      </div>

      {/* --- 5. DETAILS TABS --- */}
      {header && (
      <div className="px-4 mt-8 space-y-8">
        
        {/* TIMELINE */}
        <div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Clock size={14} /> Key Events
            </h3>
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-2">
                {timeline.length > 0 ? timeline.map((event: any, i: number) => {
                    const isHome = event.team?.id === header.competitions[0].competitors.find((c:any)=>c.homeAway==='home').id;
                    const type = event.type?.text?.toLowerCase() || "";
                    let icon = <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>;
                    
                    if(type.includes('goal')) icon = <span className="text-sm">⚽</span>;
                    if(type.includes('yellow')) icon = <div className="w-3 h-4 bg-yellow-400 rounded-[1px] shadow-sm border border-yellow-500"></div>;
                    if(type.includes('red')) icon = <div className="w-3 h-4 bg-red-600 rounded-[1px] shadow-sm border border-red-700"></div>;

                    return (
                        <div key={i} className={`flex items-center gap-3 p-3 border-b border-slate-50 last:border-0 ${i % 2 === 0 ? 'bg-slate-50/50' : ''}`}>
                            <span className="font-black text-slate-400 text-xs w-8 text-center">{event.clock?.displayValue}'</span>
                            <div className="flex-1 flex items-center gap-3">
                                {isHome ? (
                                    <>
                                        <div className="flex justify-center w-6">{icon}</div>
                                        <span className="font-bold text-xs text-slate-800">{event.text}</span>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex-1 text-right"><span className="font-bold text-xs text-slate-800">{event.text}</span></div>
                                        <div className="flex justify-center w-6">{icon}</div>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                }) : (
                    <div className="text-center text-slate-400 text-xs py-6">No key events recorded yet.</div>
                )}
            </div>
        </div>

        {/* STATS */}
        {boxscore && (
        <div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <TrendingUp size={14} /> Match Stats
            </h3>
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-5">
                <StatBar label="Possession" h={getStat('home', "possessionPct")} a={getStat('away', "possessionPct")} suffix="%" />
                <StatBar label="Shots (On Target)" h={getStat('home', "shotsSummary")} a={getStat('away', "shotsSummary")} />
                <StatBar label="Corners" h={getStat('home', "corners")} a={getStat('away', "corners")} />
                <StatBar label="Fouls" h={getStat('home', "foulsCommitted")} a={getStat('away', "foulsCommitted")} />
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