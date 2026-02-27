export const runtime = 'edge';

import { createClient } from '@/app/lib/supabase/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Zap, ExternalLink, Mic, Radio, PlayCircle, Link as LinkIcon, MapPin, Trophy, Grid, History } from 'lucide-react';
import FactSportPlayer from '@/app/components/FactSportPlayer';
import PredictionBoard from '@/app/components/PredictionBoard';
import MatchHeaderClient from '@/app/components/MatchHeaderClient'; 
import StatsLineupsTabs from '@/app/components/StatsLineupsTabs'; 
import FreeTipsBanner from '@/app/components/FreeTipsBanner';
import { getExternalData } from '@/app/lib/matchService';
import ScoreAxisWidget from '@/app/components/ScoreAxisWidget';
import { unstable_noStore as noStore } from 'next/cache'; 

const sanitizeUrl = (url: string | null | undefined) => {
    if (!url) return null;
    if (url.trim().toLowerCase().startsWith('javascript:')) return '#';
    return url;
};

async function getSupabaseData(id: string) {
    const supabase = createClient();
    const { data, error } = await supabase.from('matches').select('*').eq('id', id).single();
    if (error) return null;
    return data;
}

export default async function MatchDetailsPage({ params }: { params: { id: string } }) {
  noStore(); 
  
  const resolvedParams = await params;
  if (!resolvedParams?.id) return notFound();

  const dbData = await getSupabaseData(resolvedParams.id);
  if (!dbData) return notFound();

  const rawData = await getExternalData(dbData);
  const data = rawData || {};
  
  const currentStatus = dbData.status?.toUpperCase() || '';
  const isFinished = ['FT', 'FINISHED', 'AWARDED', 'AET', 'PEN'].includes(currentStatus);
  const activeVideoUrl = sanitizeUrl(isFinished ? dbData.video_url : dbData.livestream_url);
  const isLiveStream = !isFinished && !!dbData.livestream_url;
  
  const hasWidget = !!dbData.widget_id; 

  // 🟢 BULLETPROOF H2H EXTRACTION & EMERGENCY RECALCULATOR
  let parsedH2h = dbData?.h2h;
  if (typeof parsedH2h === 'string') {
      try { parsedH2h = JSON.parse(parsedH2h); } catch (e) { parsedH2h = {}; }
  }

  const h2hObj = parsedH2h?.aggregates || parsedH2h || {};
  const matchesArray = parsedH2h?.matches || [];

  let h2hTotal = h2hObj.numberOfMatches ?? h2hObj.played ?? h2hObj.count ?? 0;

  const homeData = typeof h2hObj.homeTeam === 'object' ? h2hObj.homeTeam : {};
  const awayData = typeof h2hObj.awayTeam === 'object' ? h2hObj.awayTeam : {};

  // Hunts for the data no matter how corrupted the API structure is
  let h2hHomeWins = Number(homeData.wins ?? h2hObj.homeWins ?? h2hObj.home_wins ?? 0);
  let h2hDraws = Number(homeData.draws ?? h2hObj.draws ?? 0);
  let h2hAwayWins = Number(awayData.wins ?? homeData.losses ?? h2hObj.awayWins ?? h2hObj.away_wins ?? 0);

  // 🛡️ RECALCULATOR: If the API's aggregate is missing the wins, we calculate it mathematically from historical matches!
  if (matchesArray.length > 0) {
      let calcHomeWins = 0, calcDraws = 0, calcAwayWins = 0;
      
      matchesArray.forEach((m: any) => {
          const hScore = m.score?.fullTime?.home ?? m.score?.regularTime?.home;
          const aScore = m.score?.fullTime?.away ?? m.score?.regularTime?.away;
          
          if (hScore !== null && aScore !== null && hScore !== undefined) {
              // Align the historical match teams to today's teams
              const isHome = (m.homeTeam?.name === dbData.home_team || m.homeTeam?.shortName === dbData.home_team || m.homeTeam?.id === homeData?.id);
              
              if (hScore === aScore) {
                  calcDraws++;
              } else if (hScore > aScore) {
                  isHome ? calcHomeWins++ : calcAwayWins++;
              } else {
                  isHome ? calcAwayWins++ : calcHomeWins++;
              }
          }
      });

      // Override with perfectly calculated stats if they exist
      if (calcHomeWins + calcAwayWins + calcDraws > 0) {
          h2hHomeWins = calcHomeWins;
          h2hAwayWins = calcAwayWins;
          h2hDraws = calcDraws;
          h2hTotal = matchesArray.length; 
      }
  }

  // Prevents division by zero for the visual bar
  const barTotal = (h2hHomeWins + h2hDraws + h2hAwayWins) || 1;
  const homePct = (h2hHomeWins / barTotal) * 100;
  const drawPct = (h2hDraws / barTotal) * 100;
  const awayPct = (h2hAwayWins / barTotal) * 100;

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 pb-24 font-sans">
      
      {hasWidget ? (
          <div className="bg-[#0a1428] text-white p-4 shadow-md flex items-center justify-between sticky top-0 z-40">
              <Link href="/matches" className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition backdrop-blur-md">
                <ChevronLeft size={20} />
              </Link>
              <span className="text-xs font-bold tracking-widest uppercase opacity-90">{dbData.league}</span>
              <div className="w-9"></div>
          </div>
      ) : (
          <div className="relative bg-[#0a1428] text-white pb-6 rounded-b-[2rem] overflow-hidden shadow-2xl">
            {dbData.home_stadium ? (
                 <>
                    <div className="absolute top-0 left-0 w-full h-full">
                        <img src={sanitizeUrl(dbData.home_stadium) || undefined} className="w-full h-full object-cover opacity-30 blur-sm scale-110" />
                    </div>
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-[#0a1428]/90 via-[#0a1428]/70 to-[#0a1428]"></div>
                 </>
            ) : (
                 <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            )}

            <div className="relative z-10 p-4 flex items-center justify-between">
              <Link href="/matches" className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition backdrop-blur-md border border-white/10">
                <ChevronLeft size={24} />
              </Link>
              
              {dbData.league_banner ? (
                  <img src={sanitizeUrl(dbData.league_banner) || undefined} className="h-6 object-contain opacity-80" alt={dbData.league} />
              ) : (
                  <span className="text-xs font-bold tracking-widest opacity-70 uppercase">{dbData.league}</span>
              )}
              
              <div className="w-10"></div>
            </div>
            
            <MatchHeaderClient matchId={dbData.id} initialData={dbData} />
          </div>
      )}

      <div className="mx-4 mt-4 relative z-20 space-y-4">
        
        {(data?.venue || data?.stage || data?.group || (dbData?.referees && dbData?.referees?.length > 0)) && (
            <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 flex flex-wrap gap-4 items-center justify-center text-[10px] font-bold text-slate-500">
                {data?.stage && <span className="flex items-center gap-1 uppercase bg-slate-50 px-2 py-1 rounded"><Trophy size={12} className="text-amber-500"/> {data.stage.replace(/_/g, ' ')}</span>}
                {data?.group && <span className="flex items-center gap-1 uppercase bg-slate-50 px-2 py-1 rounded"><Grid size={12} className="text-blue-500"/> {data.group.replace(/_/g, ' ')}</span>}
                {data?.venue && <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded"><MapPin size={12} className="text-red-500"/> {data.venue}</span>}
                {dbData?.referees && dbData?.referees?.length > 0 && (
                    <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded">
                        <span className="w-3 h-3 bg-slate-800 rounded-sm inline-block border border-white shrink-0"></span> 
                        Ref: {typeof dbData.referees[0] === 'object' ? dbData.referees[0].name : dbData.referees[0]}
                    </span>
                )}
            </div>
        )}

        {hasWidget && (
             <div className="-mt-2">
                 <ScoreAxisWidget matchId={dbData.widget_id} affiliateLink={sanitizeUrl(dbData.affiliate_link) || undefined} />
             </div>
        )}

        {dbData.home_jersey && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex items-center justify-center gap-6">
                 <div className="text-center">
                     <p className="text-[9px] font-bold text-slate-400 uppercase mb-2">Home Kit</p>
                     <img src={sanitizeUrl(dbData.home_jersey) || undefined} className="h-16 object-contain drop-shadow-md" />
                 </div>
            </div>
        )}

        {activeVideoUrl && (
            <div className="rounded-xl overflow-hidden shadow-2xl border border-white/20 relative">
                <div className="absolute top-3 left-3 z-30 pointer-events-none">
                    {isLiveStream ? (
                        <div className="bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded flex items-center gap-1 animate-pulse shadow-md">
                            <Radio size={10} /> LIVE WATCHALONG
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

        <div className="bg-[#0f172a] rounded-xl p-3 border border-slate-800 shadow-xl flex items-center justify-between">
             <div className="flex items-center gap-3">
                 <div className={`w-10 h-10 rounded-full flex items-center justify-center ${dbData.audio_url ? 'bg-red-600 animate-pulse' : 'bg-slate-800'}`}>
                    <Mic className="text-white" size={20} />
                 </div>
                 <div>
                    <h3 className="text-white font-bold text-xs">Live Audio Commentary</h3>
                    <p className="text-slate-400 text-[10px]">{dbData.audio_url ? "Radio is currently LIVE" : "Tune in when match starts"}</p>
                 </div>
             </div>
             {dbData.audio_url ? <Link href={sanitizeUrl(dbData.audio_url) || '#'} target="_blank" rel="noopener noreferrer" className="bg-white text-black hover:bg-slate-200 text-[10px] font-black px-4 py-2 rounded-full shadow-lg transition transform active:scale-95 flex items-center gap-1">LISTEN NOW <ExternalLink size={10} /></Link> : <button disabled className="bg-slate-700 text-slate-400 text-[10px] font-bold px-3 py-1.5 rounded-full cursor-not-allowed border border-white/5">OFF AIR</button>}
        </div>

        {/* 🟢 UPGRADED H2H UI (Global Standard Bar Chart) */}
        {h2hTotal > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-5 border border-slate-100">
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center justify-center gap-2 mb-4">
                    <History size={14} className="text-slate-400" /> Head-to-Head (Last {h2hTotal} Matches)
                </h3>
                
                {/* Visual Data Bar */}
                <div className="flex w-full h-2.5 rounded-full overflow-hidden mb-3 shadow-inner bg-slate-100">
                    <div style={{ width: `${homePct}%` }} className="bg-blue-600 transition-all duration-700 ease-out"></div>
                    <div style={{ width: `${drawPct}%` }} className="bg-slate-300 transition-all duration-700 ease-out"></div>
                    <div style={{ width: `${awayPct}%` }} className="bg-red-500 transition-all duration-700 ease-out"></div>
                </div>

                <div className="flex justify-between items-center text-center">
                    <div className="flex flex-col items-start w-1/3">
                        <span className="text-2xl font-black text-blue-600 leading-none">{h2hHomeWins}</span>
                        <span className="text-[9px] font-bold text-slate-500 uppercase mt-1 line-clamp-1">{dbData.home_team} Wins</span>
                    </div>
                    <div className="flex flex-col items-center w-1/3 border-x border-slate-100">
                        <span className="text-lg font-black text-slate-400 leading-none">{h2hDraws}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase mt-1">Draws</span>
                    </div>
                    <div className="flex flex-col items-end w-1/3">
                        <span className="text-2xl font-black text-red-500 leading-none">{h2hAwayWins}</span>
                        <span className="text-[9px] font-bold text-slate-500 uppercase mt-1 line-clamp-1 text-right">{dbData.away_team} Wins</span>
                    </div>
                </div>
            </div>
        )}

        <div className="bg-white rounded-xl shadow-lg p-5 border border-slate-100">
           <h3 className="text-xs font-black uppercase text-slate-800 flex items-center gap-1 mb-4"><Zap size={14} className="text-blue-600 fill-blue-600" /> Predict & Win Points</h3>
           <PredictionBoard matchId={dbData.id} matchDate={dbData.match_date} homeTeam={dbData.home_team} awayTeam={dbData.away_team} />
        </div>

        {!hasWidget && (
            <div className="bg-[#1A1A1A] rounded-xl p-3 shadow-lg border border-white/5 flex items-center justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-blue-600 w-16 h-full blur-[40px] opacity-20"></div>
                <div className="flex items-center gap-3 relative z-10">
                    <div className="bg-blue-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded">1X</div>
                    <div>
                        <div className="text-white font-bold text-xs">1xBet Official</div>
                        <div className="text-[9px] text-slate-400">Code: <span className="text-white font-bold tracking-wider">{dbData.booking_code || "FACTSPORT"}</span></div>
                    </div>
                </div>
                <a href={sanitizeUrl(dbData.affiliate_link) || "#"} target="_blank" rel="noopener noreferrer" className="bg-blue-600 hover:bg-blue-500 text-white font-black uppercase px-4 py-2 rounded-lg shadow-lg text-[10px] flex items-center gap-1 active:scale-95 transition">
                    Bet <LinkIcon size={10} />
                </a>
            </div>
        )}
      </div>

      {!hasWidget && (
          <div className="px-4 mt-8 space-y-6">
              <StatsLineupsTabs matchId={dbData.id} initialData={data} />
          </div>
      )}

      <div className="px-4 mt-6">
        <FreeTipsBanner />
      </div>
    </div>
  );
}