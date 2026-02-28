export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { createClient } from '@/app/lib/supabase/server';
import Link from "next/link";
import { PlayCircle, Calendar, ArrowLeft, Tv, ShieldCheck } from "lucide-react";
import { unstable_noStore as noStore } from 'next/cache'; // 🛑 MAXIMUM SECURITY: FORCE FRESH DATA

export const metadata = {
  title: 'Match Highlights | FactSport',
  description: 'Watch the latest match highlights and recap the best moments.',
};

export default async function HighlightsPage() {
  // 🛡️ SECURITY & FRESHNESS: Kills cache to prevent stale data. 
  // Ensures DB is queried securely on the server for every request.
  noStore(); 

  const supabase = createClient();

  // 🟢 FETCH LOGIC: 
  // 1. Only matches where video_url is not null AND not empty
  // 2. Ordered by match_date descending (Latest first)
  const { data: highlights, error } = await supabase
    .from('matches')
    .select('*')
    .not('video_url', 'is', null)
    .neq('video_url', '') 
    .order('match_date', { ascending: false });

  const safeHighlights = highlights || [];

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 font-sans pb-12 overflow-x-hidden">
      
      {/* 1. HEADER */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <Link href="/" className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition text-slate-600 active:scale-95">
                    <ArrowLeft size={18} />
                </Link>
                <h1 className="text-lg md:text-xl font-black uppercase tracking-tight flex items-center gap-2">
                    <Tv className="text-red-600" size={20} /> Match Highlights
                </h1>
            </div>
            {/* Security Indicator */}
            <div className="hidden sm:flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded border border-green-200">
                <ShieldCheck size={12} />
                <span className="text-[9px] font-bold uppercase tracking-wider">Live Sync</span>
            </div>
        </div>
      </div>

      {/* 2. HIGHLIGHTS GRID */}
      <div className="max-w-7xl mx-auto px-4 mt-6">
        {safeHighlights.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                {safeHighlights.map((item) => (
                    <Link href={`/match/${item.id}`} key={item.id} className="group flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                        
                        {/* THUMBNAIL AREA */}
                        <div className="relative aspect-video bg-[#0a1428] overflow-hidden border-b border-slate-100">
                            {/* Visual Match Representation */}
                            <div className="absolute inset-0 flex items-center justify-center gap-6 opacity-80 group-hover:opacity-40 transition-opacity duration-300">
                                <div className="w-12 h-12 md:w-16 md:h-16 flex items-center justify-center">
                                    {item.home_logo ? <img src={item.home_logo} alt={item.home_team} className="w-full h-full object-contain drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]"/> : <span className="text-white text-xs font-bold">{item.home_team.substring(0,3)}</span>}
                                </div>
                                <span className="text-slate-500 font-black italic text-lg drop-shadow-md">VS</span>
                                <div className="w-12 h-12 md:w-16 md:h-16 flex items-center justify-center">
                                    {item.away_logo ? <img src={item.away_logo} alt={item.away_team} className="w-full h-full object-contain drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]"/> : <span className="text-white text-xs font-bold">{item.away_team.substring(0,3)}</span>}
                                </div>
                            </div>

                            {/* Play Button Overlay */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="bg-red-600/90 w-14 h-14 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(220,38,38,0.6)] group-hover:scale-110 transition-transform duration-300">
                                    <PlayCircle className="text-white ml-1" size={28} />
                                </div>
                            </div>

                            {/* Top Badges */}
                            <div className="absolute top-3 left-3 flex gap-2">
                                <span className="bg-black/60 backdrop-blur-md text-white text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-widest border border-white/10 shadow-lg">
                                    {item.league}
                                </span>
                            </div>
                            
                            {/* Score Display */}
                            {(item.home_score !== null && item.away_score !== null) && (
                                <div className="absolute top-3 right-3 flex gap-1">
                                    <span className="bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded-md flex items-center gap-1 shadow-lg border border-red-500">
                                        {item.home_score} - {item.away_score}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* DETAILS AREA */}
                        <div className="p-4 md:p-5 flex flex-col flex-1 justify-between gap-4">
                            <h2 className="text-sm md:text-base font-black text-slate-800 leading-snug group-hover:text-red-600 transition-colors line-clamp-2">
                                {item.home_team} vs {item.away_team}
                            </h2>
                            
                            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                                <div className="flex items-center gap-1.5 text-slate-400">
                                    <Calendar size={12} />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">
                                        {new Date(item.match_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </span>
                                </div>
                                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    Watch Video
                                </span>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        ) : (
            /* EMPTY STATE FALLBACK */
            <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-dashed border-slate-300 shadow-sm mx-4">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-5 border border-slate-100 shadow-inner">
                    <Tv className="text-slate-300" size={40} />
                </div>
                <h3 className="text-xl font-black text-slate-800 mb-2">No Highlights Available</h3>
                <p className="text-xs text-slate-500 max-w-sm text-center leading-relaxed">
                    There are currently no match highlights to display. As soon as a video link is added in the admin panel, it will appear here automatically.
                </p>
                <Link href="/" className="mt-8 bg-[#0a1428] text-white px-8 py-3 rounded-xl text-xs font-black hover:bg-slate-900 transition-all shadow-lg active:scale-95 flex items-center gap-2">
                    <ArrowLeft size={14} /> Back to Homepage
                </Link>
            </div>
        )}
      </div>
    </div>
  );
}