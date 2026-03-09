'use client';
import Link from "next/link";
import { PlayCircle } from "lucide-react";

export default function HighlightsSlider({ highlights }: { highlights: any[] }) {
    if (!highlights || highlights.length === 0) return null;

    return (
        <div className="mt-6 px-4">
             <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                    <PlayCircle size={14} className="text-red-600" /> Highlights
                </h3>
                <Link href="/highlights" className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition shadow-sm">
                    View All
                </Link>
            </div>
            
            <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-4 scrollbar-hide">
                {highlights.map((item: any) => (
                    <Link href={`/match/${item.id}`} key={item.id} className="snap-center shrink-0 w-[220px] group relative">
                        <div className="relative aspect-video bg-[#0a1428] rounded-xl overflow-hidden shadow-lg border border-slate-200 mb-2 transform transition-transform duration-300 group-hover:-translate-y-1 group-hover:shadow-xl group-hover:border-blue-500/50">
                            
                            <div className="absolute inset-0 flex items-center justify-between px-6 opacity-80 group-hover:opacity-40 transition duration-500 bg-gradient-to-tr from-slate-900 to-slate-800">
                                <div className="w-12 h-12 flex items-center justify-center">
                                    {item.home_logo ? <img src={item.home_logo} className="w-full h-full object-contain drop-shadow-md"/> : <div className="w-8 h-8 bg-white/10 rounded-full"></div>}
                                </div>
                                <span className="text-slate-500 font-black italic text-lg drop-shadow-md">VS</span>
                                <div className="w-12 h-12 flex items-center justify-center">
                                    {item.away_logo ? <img src={item.away_logo} className="w-full h-full object-contain drop-shadow-md"/> : <div className="w-8 h-8 bg-white/10 rounded-full"></div>}
                                </div>
                            </div>
                            
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="bg-red-600/90 rounded-full p-2 shadow-[0_0_15px_rgba(220,38,38,0.5)] transform scale-90 group-hover:scale-110 transition duration-300 backdrop-blur-sm">
                                    <PlayCircle className="text-white" size={24} />
                                </div>
                            </div>
                            
                            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur text-white text-[8px] font-bold px-1.5 py-0.5 rounded border border-white/10 uppercase tracking-widest">
                                {item.league}
                            </div>
                        </div>
                        
                        {/* 🔥 Full Team Names Restored & Truncated safely */}
                        <h4 className="text-xs font-black text-slate-800 leading-tight truncate group-hover:text-blue-600 transition">
                            {item.home_team} <span className="text-slate-400 font-medium mx-0.5">vs</span> {item.away_team}
                        </h4>
                    </Link>
                ))}
            </div>
        </div>
    );
}