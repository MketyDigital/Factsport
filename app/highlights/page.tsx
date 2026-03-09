export const runtime = 'edge';
export const revalidate = 60;

import { createClient } from '@/app/lib/supabase/server';
import Link from "next/link";
import { PlayCircle, Calendar, ArrowLeft, Tv, ShieldCheck, Trophy, ArrowRight } from "lucide-react";
import BettingPromo from '@/app/components/BettingPromo';

export const metadata = {
  title: 'Match Highlights | FactSport',
  description: 'Watch the latest match highlights and recap the best moments.',
};

export default async function HighlightsPage() {
  const supabase = createClient();

  // 🟢 REVERTED: Strictly fetches ONLY matches with actual video URLs
  const { data: highlights, error } = await supabase
    .from('matches')
    .select('*')
    .not('video_url', 'is', null)
    .neq('video_url', '') 
    .order('match_date', { ascending: false });

  const safeHighlights = highlights || [];

  return (
    <div className="min-h-screen bg-[#0a1428] text-white font-sans pb-16 overflow-x-hidden selection:bg-red-500">
      
      {/* 1. HEADER */}
      <div className="bg-[#0f1c3a] border-b border-white/10 sticky top-0 z-30 shadow-2xl backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <Link href="/" className="p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-full transition text-white active:scale-95">
                    <ArrowLeft size={18} />
                </Link>
                <h1 className="text-lg md:text-xl font-black uppercase tracking-tight flex items-center gap-2">
                    <Tv className="text-red-500" size={20} /> Video Hub
                </h1>
            </div>
            <div className="hidden sm:flex items-center gap-1 bg-green-500/20 text-green-400 px-2 py-1 rounded border border-green-500/30">
                <ShieldCheck size={12} />
                <span className="text-[9px] font-bold uppercase tracking-widest">Official Sync</span>
            </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-6">
        
        {/* 🟢 COMPONENT 1: BETTING PROMO (Made small/compact at the top) */}
        <div className="max-w-xl mx-auto mb-8">
            <BettingPromo affiliateLink={null} />
        </div>

        {/* 2. HIGHLIGHTS GRID (Reverted to pure Video layout) */}
        {safeHighlights.length > 0 ? (
            <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                    {safeHighlights.map((item) => (
                        <Link href={`/match/${item.id}`} key={item.id} className="group flex flex-col bg-slate-900 rounded-2xl shadow-xl border border-slate-800 overflow-hidden hover:shadow-2xl hover:border-blue-500/50 transition-all duration-500 hover:-translate-y-1">
                            
                            {/* THUMBNAIL AREA */}
                            <div className="relative aspect-video bg-black overflow-hidden border-b border-slate-800">
                                {/* Cinematic Zoom Background */}
                                <div className="absolute inset-0 bg-gradient-to-tr from-slate-900 to-slate-800 group-hover:scale-110 transition-transform duration-700 ease-out"></div>
                                
                                {/* Visual Match Representation */}
                                <div className="absolute inset-0 flex items-center justify-center gap-6 opacity-90 group-hover:opacity-50 transition-opacity duration-500">
                                    <div className="w-12 h-12 md:w-16 md:h-16 flex items-center justify-center">
                                        {item.home_logo ? <img src={item.home_logo} alt={item.home_team} className="w-full h-full object-contain drop-shadow-2xl"/> : <span className="text-white text-xs font-bold">{item.home_team.substring(0,3)}</span>}
                                    </div>
                                    <span className="text-slate-600 font-black italic text-xl drop-shadow-lg">VS</span>
                                    <div className="w-12 h-12 md:w-16 md:h-16 flex items-center justify-center">
                                        {item.away_logo ? <img src={item.away_logo} alt={item.away_team} className="w-full h-full object-contain drop-shadow-2xl"/> : <span className="text-white text-xs font-bold">{item.away_team.substring(0,3)}</span>}
                                    </div>
                                </div>

                                {/* Play Button Overlay */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="bg-red-600/90 w-14 h-14 rounded-full flex items-center justify-center shadow-[0_0_25px_rgba(220,38,38,0.7)] transform scale-90 group-hover:scale-110 transition-all duration-300 backdrop-blur-sm">
                                        <PlayCircle className="text-white ml-1" size={28} />
                                    </div>
                                </div>

                                {/* Top Badges */}
                                <div className="absolute top-3 left-3">
                                    <span className="bg-black/60 backdrop-blur-md text-white text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-widest border border-white/10 shadow-lg">
                                        {item.league}
                                    </span>
                                </div>
                                
                                {/* Score Display */}
                                {(item.home_score !== null && item.away_score !== null) && (
                                    <div className="absolute top-3 right-3">
                                        <span className="bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-black px-2 py-1 rounded-md border border-white/10 shadow-lg tracking-widest">
                                            {item.home_score} - {item.away_score}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* DETAILS AREA */}
                            <div className="p-4 md:p-5 flex flex-col flex-1 justify-between gap-4 bg-slate-900">
                                <h2 className="text-sm md:text-base font-black text-white leading-snug group-hover:text-blue-400 transition-colors line-clamp-2">
                                    {item.home_team} vs {item.away_team}
                                </h2>
                                
                                <div className="flex items-center justify-between border-t border-slate-800 pt-3 mt-auto">
                                    <div className="flex items-center gap-1.5 text-slate-400">
                                        <Calendar size={12} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">
                                            {new Date(item.match_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </span>
                                    </div>
                                    <span className="text-[10px] font-black text-slate-300 group-hover:text-red-400 flex items-center gap-1 transition-colors uppercase tracking-widest">
                                        Play <PlayCircle size={10}/>
                                    </span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>

                {/* 🟢 COMPONENT 2: PREDICT & WIN BANNER (Made slim and placed at the bottom) */}
                <div className="mt-10 max-w-3xl mx-auto bg-[#0a1428] rounded-2xl p-4 md:p-5 border border-yellow-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500 opacity-10 rounded-full blur-2xl transform translate-x-10 -translate-y-10"></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(234,179,8,0.4)]">
                            <Trophy size={24} className="text-black fill-black" />
                        </div>
                        <div>
                            <h3 className="font-black text-lg uppercase italic text-white leading-tight tracking-tighter">Predict & <span className="text-yellow-500">Win Prizes</span></h3>
                            <p className="text-xs text-slate-400 font-bold mt-0.5">Join the leaderboard for fantastic rewards.</p>
                        </div>
                    </div>
                    <Link href="/vip/upgrade" className="relative z-10 w-full sm:w-auto shrink-0 bg-yellow-500 hover:bg-yellow-400 text-black px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition flex items-center justify-center gap-2 active:scale-95 shadow-md">
                        Join Now <ArrowRight size={14}/>
                    </Link>
                </div>
            </>
        ) : (
            /* EMPTY STATE FALLBACK */
            <div className="flex flex-col items-center justify-center py-24 bg-white/5 rounded-3xl border border-white/10 border-dashed shadow-2xl mx-4 backdrop-blur-sm">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-5 border border-white/10 shadow-inner">
                    <Tv className="text-slate-500" size={40} />
                </div>
                <h3 className="text-xl font-black text-white mb-2">No Highlights Available</h3>
                <p className="text-xs text-slate-400 max-w-sm text-center leading-relaxed">
                    There are currently no match highlights to display. Check back after the next round of fixtures.
                </p>
                <Link href="/" className="mt-8 bg-blue-600 text-white px-8 py-3 rounded-xl text-xs font-black hover:bg-blue-500 transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] active:scale-95 flex items-center gap-2">
                    <ArrowLeft size={14} /> Back to Homepage
                </Link>
            </div>
        )}
      </div>
    </div>
  );
}