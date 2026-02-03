export const runtime = 'edge';

import { createClient } from '@/app/lib/supabase/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Zap, ExternalLink, Mic, Radio, PlayCircle, Link as LinkIcon } from 'lucide-react';
import FactSportPlayer from '@/app/components/FactSportPlayer';
import PredictionBoard from '@/app/components/PredictionBoard';
import MatchHeaderClient from '@/app/components/MatchHeaderClient'; 
import StatsLineupsTabs from '@/app/components/StatsLineupsTabs'; 
import FreeTipsBanner from '@/app/components/FreeTipsBanner';
import { getExternalData } from '@/app/lib/matchService';
import ScoreAxisWidget from '@/app/components/ScoreAxisWidget';

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
  const activeVideoUrl = dbData.livestream_url || dbData.video_url;
  const isLiveStream = !!dbData.livestream_url;

  // 🟢 LOGIC: 
  // 1. If Widget exists, we HIDE the fallback stats.
  // 2. We ALSO hide the main Scoreboard Header to avoid duplicates.
  const hasWidget = !!dbData.widget_id; 

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 pb-24 font-sans">
      
      {/* 1. HEADER */}
      {/* If Widget exists, we show a "Slim Header" (Just Back Button & League). */}
      {/* If Widget missing, we show the "Full Scoreboard". */}
      
      {hasWidget ? (
          // 🟢 SLIM HEADER (Used when Widget is present)
          <div className="bg-[#0a1428] text-white p-4 shadow-md flex items-center justify-between sticky top-0 z-40">
              <Link href="/matches" className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition backdrop-blur-md">
                <ChevronLeft size={20} />
              </Link>
              <span className="text-xs font-bold tracking-widest uppercase opacity-90">{dbData.league}</span>
              <div className="w-9"></div> {/* Spacer for alignment */}
          </div>
      ) : (
          // 🔴 FULL HEADER (Used when Widget is missing)
          <div className="relative bg-[#0a1428] text-white pb-6 rounded-b-[2rem] overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            <div className="relative z-10 p-4 flex items-center justify-between">
              <Link href="/matches" className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition backdrop-blur-md">
                <ChevronLeft size={24} />
              </Link>
              <span className="text-xs font-bold tracking-widest opacity-70 uppercase">{dbData.league}</span>
              <div className="w-10"></div>
            </div>
            {/* Realtime Scoreboard */}
            <MatchHeaderClient matchId={dbData.id} initialData={dbData} initialGoals={data.goals} />
          </div>
      )}

      <div className="mx-4 mt-4 relative z-20 space-y-4">
        
        {/* 🟢 2. SCOREAXIS WIDGET */}
        {hasWidget && (
             <div className="-mt-2"> {/* Pull it up slightly to sit under the slim header */}
                 <ScoreAxisWidget matchId={dbData.widget_id} affiliateLink={dbData.affiliate_link} />
             </div>
        )}

        {/* 3. VIDEO PLAYER */}
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

        {/* 4. AUDIO PLAYER */}
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
             {dbData.audio_url ? (
                 <Link href={dbData.audio_url} target="_blank" className="bg-white text-black hover:bg-slate-200 text-[10px] font-black px-4 py-2 rounded-full shadow-lg transition transform active:scale-95 flex items-center gap-1">
                    LISTEN NOW <ExternalLink size={10} />
                 </Link>
             ) : (
                 <button disabled className="bg-slate-700 text-slate-400 text-[10px] font-bold px-3 py-1.5 rounded-full cursor-not-allowed border border-white/5">OFF AIR</button>
             )}
        </div>

        {/* 5. PREDICTION */}
        <div className="bg-white rounded-xl shadow-lg p-5 border border-slate-100">
           <h3 className="text-xs font-black uppercase text-slate-800 flex items-center gap-1 mb-4"><Zap size={14} className="text-blue-600 fill-blue-600" /> Predict & Win Points</h3>
           <PredictionBoard matchId={dbData.id} matchDate={dbData.match_date} homeTeam={dbData.home_team} awayTeam={dbData.away_team} />
        </div>

        {/* 6. BETTING BANNER (Only show if Widget is missing, because Widget has its own button now) */}
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
                <a href={dbData.affiliate_link || "#"} target="_blank" className="bg-blue-600 hover:bg-blue-500 text-white font-black uppercase px-4 py-2 rounded-lg shadow-lg text-[10px] flex items-center gap-1 active:scale-95 transition">
                    Bet <LinkIcon size={10} />
                </a>
            </div>
        )}
      </div>

      {/* 🟢 7. CONDITIONAL CONTENT SECTION */}
      {/* Logic: Only show Football API Stats/Tabs if the Widget is MISSING */}
      {!hasWidget && (
          <>
            {!data.hasExternalData ? (
                <div className="mx-4 mt-6 bg-white p-6 rounded-xl border border-slate-100 text-center shadow-sm">
                    <p className="text-xs font-bold text-slate-500">Detailed stats unavailable.</p>
                </div>
            ) : (
                <div className="px-4 mt-8 space-y-6">
                    {data.commentary.length > 0 && (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                            <div className="flex items-center gap-2 mb-4 text-slate-400">
                                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                                <h3 className="text-xs font-black uppercase tracking-wider">Live Feed</h3>
                            </div>
                            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
                                {data.commentary.map((c: any) => (
                                    <div key={c.id || Math.random()} className="flex gap-3 text-xs">
                                        <div className="font-mono font-bold text-slate-400 min-w-[24px] pt-0.5">{c.time}'</div>
                                        <p className="text-slate-700 leading-relaxed font-medium">{c.text}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <StatsLineupsTabs data={data} />
                </div>
            )}
          </>
      )}

      {/* 8. FREE TIPS */}
      <div className="px-4 mt-6">
        <FreeTipsBanner />
      </div>
    </div>
  );
}