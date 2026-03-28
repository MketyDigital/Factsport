'use client';
import Link from "next/link";
import { Activity } from "lucide-react";

export default function NewsTicker({ tickerNews }: { tickerNews: any[] }) {
    if (!tickerNews || tickerNews.length === 0) return null;

    // Split news into two arrays for the two rows
    const half = Math.ceil(tickerNews.length / 2);
    const row1 = tickerNews.slice(0, half);
    const row2 = tickerNews.slice(half);

    return (
        // 🟢 Increased height to fit two rows
        <div className="bg-yellow-400 text-black text-[10px] font-black h-14 overflow-hidden relative flex items-center shadow-md z-40 border-b border-yellow-500">
            <style>{`
                @keyframes scroll-fast { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
                @keyframes scroll-slow { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
                .animate-scroll-1 { display: flex; width: max-content; animation: scroll-fast 120s linear infinite; }
                .animate-scroll-2 { display: flex; width: max-content; animation: scroll-slow 150s linear infinite; }
                .ticker-item { white-space: nowrap; display: flex; align-items: center; }
            `}</style>
            
            <div className="absolute left-0 h-full bg-yellow-500 px-3 flex flex-col justify-center z-20 shadow-[4px_0_10px_rgba(0,0,0,0.2)] border-r border-yellow-600 whitespace-nowrap">
                <div className="flex items-center gap-1">
                    <Activity size={14} className="animate-pulse text-red-600" />
                    <span className="text-xs tracking-tighter">FACTSPORT</span>
                </div>
            </div>
            
            {/* Smooth fade effect on the left edge */}
            <div className="absolute left-24 w-8 h-full bg-gradient-to-r from-yellow-400 to-transparent z-10 pointer-events-none"></div>

            <div className="w-full h-full overflow-hidden flex flex-col justify-center gap-1 pl-28 py-1"> 
                {/* ROW 1 */}
                <div className="animate-scroll-1 flex items-center">
                    {row1.map((n, i) => ( 
                        <div key={`r1-${n.id}-${i}`} className="ticker-item flex items-center mx-4">
                            {n.image_url && (
                                <img src={n.image_url} className="w-4 h-4 rounded object-cover mr-2 shadow-sm border border-yellow-600/30" alt="" />
                            )}
                            <Link href={`/news/${n.slug}`} className="uppercase tracking-wide hover:underline hover:text-red-700 transition">
                                {n.is_breaking && <span className="text-red-600 animate-pulse mr-1">🚨 BREAKING:</span>} 
                                {n.title}
                            </Link>
                            <span className="text-yellow-700/30 ml-4 font-black">•</span>
                        </div> 
                    ))}
                </div>

                {/* ROW 2 (Slightly slower to look dynamic) */}
                <div className="animate-scroll-2 flex items-center">
                    {row2.map((n, i) => ( 
                        <div key={`r2-${n.id}-${i}`} className="ticker-item flex items-center mx-4">
                            {n.image_url && (
                                <img src={n.image_url} className="w-4 h-4 rounded object-cover mr-2 shadow-sm border border-yellow-600/30" alt="" />
                            )}
                            <Link href={`/news/${n.slug}`} className="uppercase tracking-wide hover:underline hover:text-red-700 transition text-slate-800">
                                {n.title}
                            </Link>
                            <span className="text-yellow-700/30 ml-4 font-black">•</span>
                        </div> 
                    ))}
                </div>
            </div>
        </div>
    );
}