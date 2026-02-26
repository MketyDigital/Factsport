export const runtime = 'edge';

import { createClient } from '@/app/lib/supabase/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Zap, ExternalLink, Mic, Radio, PlayCircle, Link as LinkIcon, MapPin, Trophy, Grid } from 'lucide-react';
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
  
  try {
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
                    {data?.stage && <span className="flex items-center gap-1 uppercase bg-slate-50 px-2 py-1 rounded"><Trophy size={12} className="text-amber-500"/> {data.stage}</span>}
                    {data?.group && <span className="flex items-center gap-1 uppercase bg-slate-50 px-2 py-1 rounded"><Grid size={12} className="text-blue-500"/> {data.group}</span>}
                    {data?.venue && <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded"><MapPin size={12} className="text-red-500"/> {data.venue}</span>}
                    {dbData?.referees && dbData?.referees?.length > 0 && (
                        <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded">
                            <span className="w-3 h-3 bg-slate-800 rounded-sm inline-block border border-white shrink-0"></span> 
                            Ref: {dbData.referees[0]}
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

            {dbData?.h2h && dbData?.h2h?.numberOfMatches > 0 && (
                <div className="bg-white rounded-xl shadow-lg p-4 border border-slate-100">
                    <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider text-center mb-3">
                        Head-to-Head Summary (Last {dbData.h2h.numberOfMatches} Matches)
                    </h3>
                    <div className="flex justify-between items-center text-center">
                        <div className="flex-1">
                            <div className="text-2xl font-black text-slate-800">{dbData.h2h?.homeTeam?.wins || 0}</div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1 line-clamp-1 px-1">{dbData.home_team} Wins</div>
                        </div>
                        <div className="flex-1 border-x border-slate-100">
                            <div className="text-xl font-black text-slate-400">{dbData.h2h?.homeTeam?.draws || 0}</div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">Draws</div>
                        </div>
                        <div className="flex-1">
                            <div className="text-2xl font-black text-slate-800">{dbData.h2h?.awayTeam?.wins || 0}</div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1 line-clamp-1 px-1">{dbData.away_team} Wins</div>
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
  } catch (error: any) {
      // 🚨 THIS IS THE DEBUG SCREEN 🚨
      // It will print the exact crash log on your phone/computer
      return (
          <div className="min-h-screen bg-red-50 p-6 flex flex-col items-center justify-center font-mono">
              <div className="bg-white border-2 border-red-500 rounded-xl p-6 shadow-2xl w-full max-w-lg overflow-auto">
                  <h1 className="text-red-600 font-black text-xl flex items-center gap-2 mb-4">
                      <AlertCircle size={24} /> CRASH DETECTED
                  </h1>
                  <div className="mb-4">
                      <h2 className="text-xs font-bold text-slate-500 uppercase">Error Message:</h2>
                      <p className="text-sm font-bold text-slate-800 break-words">{error.message}</p>
                  </div>
                  <div>
                      <h2 className="text-xs font-bold text-slate-500 uppercase mb-1">Stack Trace:</h2>
                      <pre className="text-[10px] text-slate-600 whitespace-pre-wrap bg-slate-100 p-3 rounded-lg border border-slate-200">
                          {error.stack}
                      </pre>
                  </div>
              </div>
          </div>
      );
  }
}