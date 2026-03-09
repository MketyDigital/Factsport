export const runtime = 'edge';
export const revalidate = 3;

import { createClient } from '@/app/lib/supabase/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Zap, ExternalLink, Mic, Radio, PlayCircle, Link as LinkIcon, MapPin, Trophy, Grid } from 'lucide-react';

// 🔥 ALL MODULAR COMPONENTS IMPORTED
import FactSportPlayer from '@/app/components/FactSportPlayer';
import PredictionBoard from '@/app/components/PredictionBoard';
import MatchHeaderClient from '@/app/components/MatchHeaderClient'; 
import StatsLineupsTabs from '@/app/components/StatsLineupsTabs'; 
import FreeTipsBanner from '@/app/components/FreeTipsBanner';
import HeadToHeadStats from '@/app/components/HeadToHeadStats'; 
import ScoreAxisWidget from '@/app/components/ScoreAxisWidget';
import ProBettingSlipLock from '@/app/components/ProBettingSlipLock'; // 🔥 NEW VIP TEASER

import { getExternalData } from '@/app/lib/matchService';

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
      
      {/* 1. MATCH HEADER (Scoreboard, Live Status, Form Rings) */}
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
            
            <MatchHeaderClient matchId={dbData.id} initialData={dbData} />
          </div>
      )}

      <div className="max-w-4xl mx-auto px-4 mt-6 relative z-20 space-y-6">
        
        {/* 2. MATCH INFO STRIP (Venue, Ref, Stage) */}
        {(data?.venue || data?.stage || data?.group || (dbData?.referees && dbData?.referees?.length > 0)) && (
            <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 flex flex-wrap gap-3 items-center justify-center text-[10px] font-bold text-slate-500">
                {data?.stage && <span className="flex items-center gap-1 uppercase bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 shadow-sm"><Trophy size={12} className="text-yellow-500"/> {data.stage.replace(/_/g, ' ')}</span>}
                {data?.group && <span className="flex items-center gap-1 uppercase bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 shadow-sm"><Grid size={12} className="text-blue-500"/> {data.group.replace(/_/g, ' ')}</span>}
                {data?.venue && <span className="flex items-center gap-1 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 shadow-sm"><MapPin size={12} className="text-red-500"/> {data.venue}</span>}
            </div>
        )}

        {hasWidget && (
             <div className="-mt-2">
                 <ScoreAxisWidget matchId={dbData.widget_id} affiliateLink={sanitizeUrl(dbData.affiliate_link) || undefined} />
             </div>
        )}

        {/* 3. MEDIA PLAYERS (Video / Audio) */}
        {activeVideoUrl && (
            <div className="rounded-2xl overflow-hidden shadow-2xl border border-slate-200 relative bg-black">
                <div className="absolute top-3 left-3 z-30 pointer-events-none">
                    {isLiveStream ? (
                        <div className="bg-red-600 text-white text-[9px] font-black px-3 py-1 rounded-md flex items-center gap-1.5 animate-pulse shadow-lg border border-red-500 tracking-widest">
                            <span className="w-1.5 h-1.5 bg-white rounded-full"></span> LIVE WATCHALONG
                        </div>
                    ) : (
                        <div className="bg-black/60 backdrop-blur-md text-white text-[9px] font-black px-3 py-1 rounded-md border border-white/20 flex items-center gap-1.5 shadow-lg tracking-widest">
                            <PlayCircle size={12} className="text-red-500"/> OFFICIAL HIGHLIGHTS
                        </div>
                    )}
                </div>
                <FactSportPlayer videoUrl={activeVideoUrl} />
            </div>
        )}

        <div className="bg-[#0f172a] rounded-2xl p-4 border border-slate-800 shadow-xl flex items-center justify-between group hover:border-blue-500/50 transition-colors">
             <div className="flex items-center gap-4">
                 <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-inner ${dbData.audio_url ? 'bg-red-600/20 border border-red-500/30 text-red-500 animate-pulse' : 'bg-white/5 border border-white/5 text-slate-500'}`}>
                    <Mic size={20} />
                 </div>
                 <div>
                    <h3 className="text-white font-black text-sm tracking-tight">Live Audio Commentary</h3>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">{dbData.audio_url ? "Radio is currently LIVE" : "Tune in at kickoff"}</p>
                 </div>
             </div>
             {dbData.audio_url ? (
                <Link href={sanitizeUrl(dbData.audio_url) || '#'} target="_blank" rel="noopener noreferrer" className="bg-white text-black hover:bg-slate-200 text-[10px] font-black px-5 py-2.5 rounded-xl shadow-lg transition active:scale-95 flex items-center gap-1 uppercase tracking-widest">
                    Listen <ExternalLink size={12} />
                </Link>
             ) : (
                <button disabled className="bg-slate-800 text-slate-500 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl cursor-not-allowed border border-white/5">
                    Off Air
                </button>
             )}
        </div>

        {/* 4. THE PROOF: Head-to-Head Statistics */}
        <HeadToHeadStats dbData={dbData} />

        {/* 5. THE TEASE: VIP Pro Betting Slip Lock 🔥 */}
        {!hasWidget && (
            <ProBettingSlipLock homeTeam={dbData.home_team} awayTeam={dbData.away_team} />
        )}

        {/* 6. THE ENGAGEMENT: User Prediction Board */}
        <div className="bg-white rounded-2xl shadow-xl p-5 border border-slate-200 overflow-hidden relative">
           <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-10 -mt-10 opacity-50 pointer-events-none"></div>
           <h3 className="text-sm font-black uppercase tracking-tighter text-slate-800 flex items-center gap-1.5 mb-5 relative z-10">
               <Zap size={16} className="text-yellow-500 fill-yellow-500 drop-shadow-sm" /> Predict & Win Points
           </h3>
           <div className="relative z-10">
               <PredictionBoard matchId={dbData.id} matchDate={dbData.match_date} homeTeam={dbData.home_team} awayTeam={dbData.away_team} />
           </div>
        </div>

        {/* 7. MONETIZATION: Direct Affiliate Block */}
        {!hasWidget && (
            <div className="bg-[#1A1A1A] rounded-2xl p-4 shadow-2xl border border-slate-800 flex items-center justify-between relative overflow-hidden group hover:border-blue-500/30 transition-colors">
                <div className="absolute top-0 right-0 bg-blue-600 w-24 h-full blur-[50px] opacity-20 group-hover:opacity-40 transition-opacity"></div>
                <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 bg-blue-600 text-white text-xs font-black rounded-xl flex items-center justify-center shadow-lg italic">1X</div>
                    <div>
                        <div className="text-white font-black text-sm tracking-tight mb-0.5">1xBet Official Partner</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                            Code: <span className="text-yellow-400 font-black bg-yellow-400/10 px-1.5 py-0.5 rounded border border-yellow-400/20">{dbData.booking_code || "FACTSPORT"}</span>
                        </div>
                    </div>
                </div>
                <a href={sanitizeUrl(dbData.affiliate_link) || "#"} target="_blank" rel="noopener noreferrer" className="relative z-10 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest px-5 py-3 rounded-xl shadow-[0_4px_15px_rgba(37,99,235,0.4)] text-[10px] flex items-center gap-1.5 active:scale-95 transition">
                    Bet Now <LinkIcon size={12} />
                </a>
            </div>
        )}

      </div>

      {/* 8. DEEP DATA: Live Timeline, Stats, and Lineups */}
      {!hasWidget && (
          <div className="max-w-4xl mx-auto px-4 mt-8 space-y-6">
              <StatsLineupsTabs matchId={dbData.id} initialData={data} />
          </div>
      )}

      {/* 9. FOOTER: Free Tips Banner */}
      <div className="max-w-4xl mx-auto px-4 mt-6">
        <FreeTipsBanner />
      </div>
    </div>
  );
}