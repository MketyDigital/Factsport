export const runtime = 'edge';

import { createClient } from '@/app/lib/supabase/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Zap, ExternalLink, AlertCircle, Activity, Mic, AlignLeft, Radio, PlayCircle } from 'lucide-react';
import FactSportPlayer from '@/app/components/FactSportPlayer';
import PredictionBoard from '@/app/components/PredictionBoard';
import MatchHeaderClient from '@/app/components/MatchHeaderClient'; // ✅
import StatsLineupsTabs from '@/app/components/StatsLineupsTabs'; // ✅
import FreeTipsBanner from '@/app/components/FreeTipsBanner';
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
  const activeVideoUrl = dbData.livestream_url || dbData.video_url;
  const isLiveStream = !!dbData.livestream_url;

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 pb-24 font-sans">
      
      {/* HEADER (Sticky) */}
      <div className="sticky top-0 z-50 bg-[#0a1428] text-white pb-4 rounded-b-[2rem] overflow-hidden shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="relative z-10 p-4 flex items-center justify-between">
          <Link href="/" className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition backdrop-blur-md">
            <ChevronLeft size={24} />
          </Link>
          <span className="text-xs font-bold tracking-widest opacity-70 uppercase">{dbData.league}</span>
          <div className="w-10"></div>
        </div>

        {/* 🟢 REALTIME SCOREBOARD + CENTERED SCORERS */}
        <MatchHeaderClient matchId={dbData.id} initialData={dbData} initialGoals={data.goals} />
      </div>

      <div className="mx-4 -mt-6 relative z-20 space-y-4">
        
        {/* 📺 VIDEO PLAYER */}
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

        {/* 🎙️ AUDIO PLAYER */}
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

        {/* 4. PREDICTION */}
        <div className="bg-white rounded-xl shadow-lg p-5 border border-slate-100">
           <h3 className="text-xs font-black uppercase text-slate-800 flex items-center gap-1 mb-4"><Zap size={14} className="text-blue-600 fill-blue-600" /> Predict & Win Points</h3>
           <PredictionBoard matchId={dbData.id} matchDate={dbData.match_date} homeTeam={dbData.home_team} awayTeam={dbData.away_team} />
        </div>

        {/* 5. OLD 1XBET BANNER (Placed below Prediction as requested) */}
        <div className="bg-[#1A1A1A] rounded-xl p-4 shadow-xl border border-slate-800 flex items-center justify-between overflow-hidden relative">
            <div className="absolute top-0 right-0 w-20 h-full bg-gradient-to-l from-white/5 to-transparent"></div>
            <div className="flex items-center gap-3 relative z-10">
                <div className="w-10 h-10 bg-yellow-400 rounded-lg flex items-center justify-center font-black text-black shadow-lg">1X</div>
                <div>
                    <div className="text-white font-bold text-sm">Bet on 1xBet</div>
                    {dbData.booking_code ? <div className="text-yellow-400 text-xs font-mono">Code: {dbData.booking_code}</div> : <div className="text-slate-400 text-[10px]">Highest Odds Guaranteed</div>}
                </div>
            </div>
            <Link href={dbData.affiliate_link || "#"} target="_blank" className="bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-1">Bet Now <ExternalLink size={10} /></Link>
        </div>
      </div>

      {/* 6. CONTENT SECTION (Feed + Tabs) */}
      {!data.hasExternalData ? (
          <div className="mx-4 mt-6 bg-white p-6 rounded-xl border border-slate-100 text-center shadow-sm">
              <AlertCircle className="mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-bold text-slate-500">Detailed stats unavailable.</p>
          </div>
      ) : (
        <div className="px-4 mt-8 space-y-6">
            
            {/* 7. LIVE FEED (Separate & Clean) */}
            {data.commentary.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                    <h3 className="text-xs font-black uppercase text-slate-400 mb-4 flex items-center gap-2">
                        <AlignLeft size={14} className="text-blue-500" /> Live Feed
                    </h3>
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
            
            {/* 8. TABS: STATS & LINEUPS ONLY */}
            <StatsLineupsTabs data={data} />
        </div>
      )}

      {/* 9. FREE TIPS (Bottom) */}
      <div className="px-4 mt-6">
        <FreeTipsBanner />
      </div>
    </div>
  );
}