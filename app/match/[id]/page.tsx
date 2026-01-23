// ✅ RUNS ON EDGE
export const runtime = 'edge';

import { createClient } from '@/app/lib/supabase/server';
import { notFound } from "next/navigation";
import Link from 'next/link';
import { 
  ChevronLeft, Calendar, MapPin, Zap, TrendingUp, Users, 
  Clock, PlayCircle, Ticket, ExternalLink, ArrowRight 
} from 'lucide-react';

// 1. Fetch Live Data from ESPN
async function getEspnData(id: string) {
  try {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${id}`, {
        next: { revalidate: 30 } 
    });
    if (!res.ok) return null;
    return res.json();
  } catch (e) {
    return null;
  }
}

// 2. Fetch "Revenue Data" (Codes, Videos) from Supabase
async function getSupabaseData(id: string) {
    const supabase = createClient();
    const { data } = await supabase.from('matches').select('*').eq('id', id).single();
    return data;
}

export default async function MatchDetailsPage({ params }: { params: { id: string } }) {
  // Run fetches in parallel for speed
  const [espnData, dbData] = await Promise.all([
    getEspnData(params.id),
    getSupabaseData(params.id)
  ]);

  if (!espnData || !espnData.header) return notFound();

  const { header, boxscore, gameInfo, rosters } = espnData;
  const home = header.competitions[0].competitors.find((c: any) => c.homeAway === 'home');
  const away = header.competitions[0].competitors.find((c: any) => c.homeAway === 'away');
  const status = header.competitions[0].status;
  const timeline = header.competitions[0].details || [];
  
  // Get User for Prediction Logic
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Helper for Stats
  const getStat = (teamId: string, name: string) => {
    const teamStats = boxscore?.teams?.find((t: any) => t.team.id === teamId)?.statistics;
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
               <span className="bg-white/10 text-slate-300 text-[10px] font-bold px-3 py-1 rounded-full border border-white/10 flex items-center gap-1">
                 {status.type.state === 'post' ? 'Full Time' : new Date(header.competitions[0].date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
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

      {/* --- 2. REVENUE & PREDICTION --- */}
      <div className="mx-4 -mt-4 relative z-20 space-y-3">
        
        {/* A. BETTING PARTNER (Revenue) */}
        <div className="bg-[#1A1A1A] rounded-xl p-4 shadow-xl border border-slate-800 flex items-center justify-between overflow-hidden relative">
            {/* Shine Effect */}
            <div className="absolute top-0 right-0 w-20 h-full bg-gradient-to-l from-white/5 to-transparent"></div>
            
            <div className="flex items-center gap-3 relative z-10">
                <div className="w-10 h-10 bg-yellow-400 rounded-lg flex items-center justify-center font-black text-black shadow-lg">
                    1X
                </div>
                <div>
                    <div className="text-white font-bold text-sm">Bet on 1xBet</div>
                    {dbData?.booking_code ? (
                        <div className="text-yellow-400 text-xs font-mono">Code: <span className="font-black bg-yellow-400/20 px-1 rounded">{dbData.booking_code}</span></div>
                    ) : (
                        <div className="text-slate-400 text-[10px]">Highest Odds Guaranteed</div>
                    )}
                </div>
            </div>
            
            <Link href="https://bit.ly/your-affiliate-link" target="_blank" className="bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black px-4 py-2.5 rounded-lg shadow-lg active:scale-95 transition flex items-center gap-1">
                Bet Now <ExternalLink size={10} />
            </Link>
        </div>

        {/* B. PREDICTION CARD (Engagement) */}
        <div className="bg-white rounded-xl shadow-lg p-4 border border-slate-100">
           <div className="flex justify-between items-center mb-3">
               <h3 className="text-xs font-black uppercase text-slate-800 flex items-center gap-1">
                   <Zap size={14} className="text-blue-600 fill-blue-600" /> FactSport Prediction
               </h3>
               <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold">Win 10 Points</span>
           </div>
           
           {user ? (
             <div className="grid grid-cols-3 gap-2">
               <button className="bg-slate-50 border border-slate-200 py-3 rounded-lg text-xs font-bold hover:bg-blue-600 hover:text-white hover:border-blue-600 transition shadow-sm">
                 {home.team.abbreviation} Win
               </button>
               <button className="bg-slate-50 border border-slate-200 py-3 rounded-lg text-xs font-bold hover:bg-slate-600 hover:text-white hover:border-slate-600 transition shadow-sm">
                 Draw
               </button>
               <button className="bg-slate-50 border border-slate-200 py-3 rounded-lg text-xs font-bold hover:bg-red-600 hover:text-white hover:border-red-600 transition shadow-sm">
                 {away.team.abbreviation} Win
               </button>
             </div>
           ) : (
             <Link href="/login" className="block w-full bg-slate-900 text-white text-center py-3 rounded-lg text-xs font-bold shadow-md active:scale-95 transition">
                Login to Predict & Win
             </Link>
           )}
        </div>
      </div>

      {/* --- 3. CONDITIONAL HIGHLIGHTS --- */}
      {dbData?.video_url && (
          <div className="px-4 mt-6">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <PlayCircle size={14} /> Match Highlights
            </h3>
            <Link href={dbData.video_url} target="_blank">
                <div className="bg-black rounded-xl overflow-hidden aspect-video relative flex items-center justify-center group cursor-pointer shadow-lg border border-slate-800">
                    <img src="https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=800&q=80" className="absolute inset-0 w-full h-full object-cover opacity-50" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                    <PlayCircle size={48} className="text-white relative z-10 opacity-90 group-hover:scale-110 transition shadow-xl" />
                    <div className="absolute bottom-3 left-3 z-10">
                        <p className="text-white text-xs font-bold">Watch Goals & Highlights</p>
                        <p className="text-gray-400 text-[10px]">External Video Source</p>
                    </div>
                </div>
            </Link>
          </div>
      )}

      {/* --- 4. DETAILS TABS --- */}
      <div className="px-4 mt-8 space-y-8">
        
        {/* TIMELINE (Improved) */}
        <div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Clock size={14} /> Key Events
            </h3>
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-2">
                {timeline.length > 0 ? timeline.map((event: any, i: number) => {
                    const isHome = event.team?.id === home.id;
                    const type = event.type?.text?.toLowerCase();
                    let icon = <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>;
                    
                    if(type.includes('goal')) icon = <span className="text-sm">⚽</span>;
                    if(type.includes('yellow')) icon = <div className="w-3 h-4 bg-yellow-400 rounded-[1px] shadow-sm border border-yellow-500"></div>;
                    if(type.includes('red')) icon = <div className="w-3 h-4 bg-red-600 rounded-[1px] shadow-sm border border-red-700"></div>;
                    if(type.includes('substitution')) icon = <span className="text-xs">🔄</span>;

                    return (
                        <div key={i} className={`flex items-center gap-3 p-3 border-b border-slate-50 last:border-0 ${i % 2 === 0 ? 'bg-slate-50/50' : ''}`}>
                            <span className="font-black text-slate-400 text-xs w-8 text-center">{event.clock?.displayValue}'</span>
                            <div className="flex-1 flex items-center gap-3">
                                {isHome ? (
                                    <>
                                        <div className="flex justify-center w-6">{icon}</div>
                                        <div className="flex-col flex">
                                            <span className="font-bold text-xs text-slate-800">{event.text || event.type?.text}</span>
                                            {event.participants?.[0] && <span className="text-[10px] text-slate-500">{event.participants[0].athlete.displayName}</span>}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex-1 text-right">
                                             <span className="font-bold text-xs text-slate-800">{event.text || event.type?.text}</span>
                                             {event.participants?.[0] && <span className="text-[10px] text-slate-500 block">{event.participants[0].athlete.displayName}</span>}
                                        </div>
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
        <div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <TrendingUp size={14} /> Match Stats
            </h3>
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-5">
                <StatBar label="Possession" h={getStat(home.id, "possessionPct")} a={getStat(away.id, "possessionPct")} suffix="%" />
                <StatBar label="Shots (On Target)" h={getStat(home.id, "shotsSummary")} a={getStat(away.id, "shotsSummary")} />
                <StatBar label="Corners" h={getStat(home.id, "corners")} a={getStat(away.id, "corners")} />
                <StatBar label="Fouls" h={getStat(home.id, "foulsCommitted")} a={getStat(away.id, "foulsCommitted")} />
                <StatBar label="Yellow Cards" h={getStat(home.id, "yellowCards")} a={getStat(away.id, "yellowCards")} />
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
                    <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
                        {home.team.logos?.[0]?.href && <img src={home.team.logos[0].href} className="w-4 h-4" />}
                        <span className="text-[10px] font-black uppercase text-slate-800">{home.team.abbreviation}</span>
                    </div>
                    <ul className="space-y-2">
                        {rosters?.find((r:any) => r.team.id === home.id)?.roster?.filter((p:any) => p.starter).map((p:any) => (
                            <li key={p.athlete.id} className="text-[10px] font-bold text-slate-600 flex gap-2">
                                <span className="text-slate-300 w-4 text-right">{p.jersey}</span> {p.athlete.displayName}
                            </li>
                        ))}
                    </ul>
                </div>
                {/* Away Team */}
                <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
                        {away.team.logos?.[0]?.href && <img src={away.team.logos[0].href} className="w-4 h-4" />}
                        <span className="text-[10px] font-black uppercase text-slate-800">{away.team.abbreviation}</span>
                    </div>
                    <ul className="space-y-2">
                        {rosters?.find((r:any) => r.team.id === away.id)?.roster?.filter((p:any) => p.starter).map((p:any) => (
                            <li key={p.athlete.id} className="text-[10px] font-bold text-slate-600 flex gap-2">
                                <span className="text-slate-300 w-4 text-right">{p.jersey}</span> {p.athlete.displayName}
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