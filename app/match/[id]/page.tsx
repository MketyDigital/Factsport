export const runtime = 'edge';
export const revalidate = 3;

import { createClient } from '@/app/lib/supabase/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Zap, ExternalLink, Link as LinkIcon, MapPin, Trophy, Grid, Percent, BarChart2, BrainCircuit, History, Play, Calendar } from 'lucide-react';

import FactSportPlayer from '@/app/components/FactSportPlayer';
import PredictionBoard from '@/app/components/PredictionBoard';
import MatchHeaderClient from '@/app/components/MatchHeaderClient'; 
import StatsLineupsTabs from '@/app/components/StatsLineupsTabs'; 
import FreeTipsBanner from '@/app/components/FreeTipsBanner';
import HeadToHeadStats from '@/app/components/HeadToHeadStats'; 
import ScoreAxisWidget from '@/app/components/ScoreAxisWidget';
import ProBettingSlipLock from '@/app/components/ProBettingSlipLock'; 
import MatchTime from '@/app/components/MatchTime';

import { getExternalData } from '@/app/lib/matchService';

const sanitizeUrl = (url: string | null | undefined) => {
    if (!url) return null;
    if (url.trim().toLowerCase().startsWith('javascript:')) return '#';
    return url;
};

// 🟢 THE MASTER STATUS ARRAYS
const SCHEDULED_STATUSES = ['SCHEDULED', 'PRE', 'UPCOMING', 'TBD', 'DELAYED'];
const FINISHED_STATUSES = ['FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD'];

async function getSupabaseData(id: string) {
    const supabase = createClient();
    const { data, error } = await supabase.from('matches').select('*').eq('id', id).single();
    if (error) return null;
    return data;
}

export default async function MatchDetailsPage({ params }: { params: { id: string } }) {
  const resolvedParams = await params;
  if (!resolvedParams?.id) return notFound();

  const supabase = createClient();
  const dbData = await getSupabaseData(resolvedParams.id);
  if (!dbData) return notFound();

  let isUserVIP = false;
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
      const { data: profile } = await supabase.from('profiles').select('is_vip').eq('id', session.user.id).single();
      if (profile?.is_vip) isUserVIP = true;
  }

  const rawData = await getExternalData(dbData);
  const data = rawData || {};
  
  const currentStatus = (dbData.status || '').toUpperCase();
  const isFinished = FINISHED_STATUSES.includes(currentStatus);
  const isUpcomingMatch = SCHEDULED_STATUSES.includes(currentStatus);
  
  const activeVideoUrl = sanitizeUrl(isFinished ? dbData.video_url : dbData.livestream_url);
  const activeAudioUrl = sanitizeUrl(dbData.audio_url);
  const hasWidget = !!dbData.widget_id; 

  const formattedDate = new Date(dbData.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

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
          <div className="relative bg-[#0a1428] text-white pb-6 rounded-b-[2.5rem] overflow-hidden shadow-2xl border-b border-blue-900/30">
            {dbData.home_stadium ? (
                 <>
                    <div className="absolute top-0 left-0 w-full h-full">
                        <img src={sanitizeUrl(dbData.home_stadium) || undefined} className="w-full h-full object-cover opacity-30 blur-sm scale-110 mix-blend-overlay" />
                    </div>
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-[#0a1428]/90 via-[#0a1428]/70 to-[#0a1428]"></div>
                 </>
            ) : (
                 <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            )}

            <div className="relative z-10 p-4 flex items-center justify-between">
              <Link href="/matches" className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition backdrop-blur-md border border-white/10 shadow-lg active:scale-95">
                <ChevronLeft size={24} />
              </Link>
              {dbData.league_banner ? (
                  <img src={sanitizeUrl(dbData.league_banner) || undefined} className="h-6 object-contain opacity-90 drop-shadow-md" alt={dbData.league} />
              ) : (
                  <span className="text-[10px] font-black tracking-widest opacity-80 uppercase bg-black/40 px-3 py-1 rounded-full border border-white/10">{dbData.league}</span>
              )}
              <div className="w-10"></div>
            </div>
            <MatchHeaderClient matchId={dbData.id} initialData={data} />
          </div>
      )}

      {!hasWidget && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide py-2 md:py-3 px-4 max-w-4xl mx-auto relative z-20 snap-x">
             <a href="#match-center" className="snap-start shrink-0 bg-blue-600 text-white px-3 md:px-4 py-1.5 md:py-2 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow-md flex items-center gap-1.5 active:scale-95 transition"><BarChart2 size={12}/> Match Center</a>
             <a href="#pro-analysis" className="snap-start shrink-0 bg-slate-900 text-yellow-500 px-3 md:px-4 py-1.5 md:py-2 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow-md flex items-center gap-1.5 active:scale-95 transition"><BrainCircuit size={12}/> Pro Slip</a>
             <a href="#h2h" className="snap-start shrink-0 bg-white text-slate-700 border border-slate-200 px-3 md:px-4 py-1.5 md:py-2 rounded-full text-[9px] md:text-[10px] font-bold shadow-sm flex items-center gap-1.5 hover:bg-slate-50 active:scale-95 transition"><History size={12}/> H2H</a>
             <a href="#predictions" className="snap-start shrink-0 bg-white text-slate-700 border border-slate-200 px-3 md:px-4 py-1.5 md:py-2 rounded-full text-[9px] md:text-[10px] font-bold shadow-sm flex items-center gap-1.5 hover:bg-slate-50 active:scale-95 transition"><Trophy size={12}/> Predict</a>
             {(activeVideoUrl || activeAudioUrl) && (
                 <a href="#media" className="snap-start shrink-0 bg-white text-slate-700 border border-slate-200 px-3 md:px-4 py-1.5 md:py-2 rounded-full text-[9px] md:text-[10px] font-bold shadow-sm flex items-center gap-1.5 hover:bg-slate-50 active:scale-95 transition"><Play size={12}/> Media</a>
             )}
          </div>
      )}

      <div className="max-w-4xl mx-auto px-4 mt-2 relative z-20 space-y-3 md:space-y-6">
        
        <div className="bg-white rounded-xl p-2 md:p-3 shadow-sm border border-slate-100 flex flex-wrap gap-2 items-center justify-center text-[9px] md:text-[10px] font-bold text-slate-500">
            <span className="flex items-center gap-1 uppercase bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 shadow-sm text-slate-700">
                <Calendar className="w-2.5 h-2.5 text-slate-400"/> {formattedDate} <span className="text-slate-300 mx-0.5">•</span> <MatchTime date={dbData.match_date} />
            </span>

            {(data?.venue || data?.stage || data?.group || (data?.referees && data.referees.length > 0) || data?.predictor) && (
                <>
                    {data?.stage && <span className="flex items-center gap-1 uppercase bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 shadow-sm"><Trophy className="w-2.5 h-2.5 text-yellow-500"/> {data.stage.replace(/_/g, ' ')}</span>}
                    {data?.group && <span className="flex items-center gap-1 uppercase bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 shadow-sm"><Grid className="w-2.5 h-2.5 text-blue-500"/> {data.group.replace(/_/g, ' ')}</span>}
                    {data?.venue && <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 shadow-sm"><MapPin className="w-2.5 h-2.5 text-red-500"/> {data.venue}</span>}
                    {data?.predictor && <span className="flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-1 rounded-lg border border-blue-100 shadow-sm"><Percent className="w-2.5 h-2.5 text-blue-600"/> Win Prob: {parseFloat(String(data.predictor.home)).toFixed(0)}% | {parseFloat(String(data.predictor.away)).toFixed(0)}%</span>}
                </>
            )}
        </div>

        {hasWidget && (
             <div className="-mt-1 md:-mt-2">
                 <ScoreAxisWidget matchId={dbData.widget_id} affiliateLink={sanitizeUrl(dbData.affiliate_link) || undefined} />
             </div>
        )}

        <div id="media" className="scroll-mt-6 space-y-3">
            {activeVideoUrl && (
                <div className="relative">
                    {!isUpcomingMatch && (
                        <div className="absolute top-2 left-2 z-30 pointer-events-none">
                            {!isFinished ? (
                                <div className="bg-red-600 text-white text-[8px] md:text-[9px] font-black px-2 py-1 rounded-md flex items-center gap-1 shadow-lg tracking-widest">
                                    <span className="w-1 h-1 bg-white rounded-full animate-pulse"></span> LIVE
                                </div>
                            ) : (
                                <div className="bg-black/60 backdrop-blur-md text-white text-[8px] md:text-[9px] font-black px-2 py-1 rounded-md border border-white/10 flex items-center gap-1 shadow-lg tracking-widest">
                                    HIGHLIGHTS
                                </div>
                            )}
                        </div>
                    )}
                    <FactSportPlayer mediaUrl={activeVideoUrl} mode="video" isUpcoming={isUpcomingMatch} />
                </div>
            )}

            {activeAudioUrl && (
                <div className="w-full">
                    <FactSportPlayer mediaUrl={activeAudioUrl} mode="audio" isUpcoming={isUpcomingMatch} />
                </div>
            )}
        </div>

        <div id="h2h" className="scroll-mt-6">
            <HeadToHeadStats dbData={data} />
        </div>

        {!hasWidget && (
            <div id="pro-analysis" className="scroll-mt-6">
                <ProBettingSlipLock 
                    isVIP={isUserVIP} 
                    homeTeam={dbData.home_team} 
                    awayTeam={dbData.away_team} 
                    status={dbData.status} 
                    proAnalysis={dbData.pro_analysis} 
                />
            </div>
        )}

        <div id="predictions" className="scroll-mt-6 bg-white rounded-xl shadow-xl p-2 md:p-5 border border-slate-200 overflow-hidden relative">
           <h3 className="text-[11px] md:text-sm font-black uppercase tracking-tighter text-slate-800 flex items-center gap-1.5 mb-2 md:mb-5 relative z-10">
               <Zap className="w-3.5 h-3.5 md:w-4 md:h-4 text-yellow-500 fill-yellow-500" /> Predict & Win
           </h3>
           <div className="relative z-10 scale-[0.98] md:scale-100 origin-top">
               <PredictionBoard matchId={dbData.id} matchDate={dbData.match_date} homeTeam={dbData.home_team} awayTeam={dbData.away_team} />
           </div>
        </div>

        {!hasWidget && (
            <div className="bg-[#1A1A1A] rounded-xl p-2 md:p-4 shadow-2xl border border-slate-800 flex items-center justify-between relative overflow-hidden group">
                <div className="flex items-center gap-2 md:gap-4 relative z-10">
                    <div className="w-8 h-8 md:w-12 md:h-12 bg-blue-600 text-white text-[10px] md:text-xs font-black rounded-lg flex items-center justify-center shadow-lg italic">1X</div>
                    <div>
                        <div className="text-white font-black text-[11px] md:text-sm tracking-tight mb-0">1xBet Partner</div>
                        <div className="text-[8px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                            Code: <span className="text-yellow-400 font-black">FACTSPORT</span>
                        </div>
                    </div>
                </div>
                <a href={sanitizeUrl(dbData.affiliate_link) || "#"} target="_blank" rel="noopener noreferrer" className="relative z-10 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest px-3 py-1.5 md:px-5 md:py-3 rounded-lg shadow-lg text-[8px] md:text-[10px] flex items-center gap-1">
                    Bet <span className="hidden sm:inline">Now</span> <LinkIcon className="w-2.5 h-2.5" />
                </a>
            </div>
        )}

      </div>

      {!hasWidget && (
          <div id="match-center" className="scroll-mt-6 max-w-4xl mx-auto px-4 mt-4 md:mt-8 space-y-6">
              <StatsLineupsTabs matchId={dbData.id} initialData={data} />
          </div>
      )}

      <div className="max-w-4xl mx-auto px-4 mt-6">
        <FreeTipsBanner />
      </div>
    </div>
  );
}