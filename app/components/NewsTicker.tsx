'use client';
import Link from "next/link";
import { Activity } from "lucide-react";

export default function NewsTicker({ tickerNews }: { tickerNews: any[] }) {
    if (!tickerNews || tickerNews.length === 0) return null;

    return (
        <div className="bg-yellow-400 text-black text-[10px] font-black h-10 overflow-hidden relative flex items-center shadow-md z-40 border-b border-yellow-500">
            <style>{`
                @keyframes scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
                .animate-scroll { display: flex; width: max-content; animation: scroll 60s linear infinite; }
                .ticker-item { white-space: nowrap; display: flex; align-items: center; }
            `}</style>
            
            <div className="absolute left-0 h-full bg-yellow-500 px-3 flex items-center z-20 shadow-[4px_0_10px_rgba(0,0,0,0.2)] border-r border-yellow-600 whitespace-nowrap">
                <Activity size={14} className="mr-1 animate-pulse text-red-600" /> FACTSPORT
            </div>
            
            <div className="absolute left-24 w-8 h-full bg-gradient-to-r from-yellow-400 to-transparent z-10 pointer-events-none"></div>

            <div className="w-full overflow-hidden flex pl-28"> 
                <div className="animate-scroll flex items-center">
                    {tickerNews.map((n, i) => ( 
                        <div key={`${n.id}-${i}`} className="ticker-item flex items-center mx-4">
                            {n.image_url && (
                                <img src={n.image_url} className="w-5 h-5 rounded object-cover mr-2 shadow-sm border border-yellow-600/30" alt="" />
                            )}
                            <Link href={`/news/${n.slug}`} className="uppercase tracking-wide hover:underline hover:text-red-700 transition text-slate-900">
                                {n.is_breaking && <span className="text-red-600 animate-pulse mr-1">🚨 BREAKING:</span>} 
                                {n.title}
                            </Link>
                            <span className="text-yellow-700/40 ml-6 font-black">•</span>
                        </div> 
                    ))}
                </div>
            </div>
        </div>
    );
}