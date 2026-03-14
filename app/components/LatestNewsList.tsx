'use client';
import Link from "next/link";
import { Newspaper, Clock, Flame, ChevronRight } from "lucide-react";
import NewsArtwork from '@/app/components/NewsArtwork';

export default function LatestNewsList({ latestNews }: { latestNews: any[] }) {
  if (!latestNews || latestNews.length === 0) return null;

  return (
    <div className="px-4 mb-4 mt-2">
        <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                <Newspaper size={14} className="text-blue-500"/> Latest News
            </h3>
            <Link href="/news" className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition shadow-sm">
                View All
            </Link>
        </div>
        
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50 overflow-hidden">
            {latestNews.map((item, index) => (
                <Link href={`/news/${item.slug || '#'}`} key={item.id} className="flex gap-4 items-center p-3 md:p-4 active:bg-slate-50 transition group hover:bg-slate-50/80 relative overflow-hidden">
                    
                    {/* 🟢 THE FIX: Increased from w-16 h-16 to w-20 h-20 (and wider on desktop) for better visibility */}
                    <div className="w-20 h-20 md:w-24 md:h-20 bg-slate-100 rounded-xl shrink-0 overflow-hidden relative shadow-sm border border-slate-200/50">
                        <NewsArtwork image={item.image_url} team1Logo={item.team_1_logo} team2Logo={item.team_2_logo} title={item.title} className="w-full h-full object-cover group-hover:scale-110 transition duration-700 ease-out" />
                    </div>
                    
                    <div className="flex-1 pr-6 py-1">
                        {index === 0 && (
                            <span className="flex items-center gap-1 text-[8px] font-black text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-sm uppercase tracking-widest mb-1.5 w-max border border-orange-100">
                                <Flame size={8} className="animate-pulse" /> Trending
                            </span>
                        )}
                        
                        {/* 🟢 Slightly increased text size on desktop to match the bigger image */}
                        <h4 className="text-xs md:text-sm font-bold leading-relaxed line-clamp-2 text-slate-800 group-hover:text-blue-600 transition">{item.title}</h4>
                        
                        <div className="flex items-center gap-3 mt-2">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                <Clock size={10} /> {new Date(item.created_at).toLocaleDateString('en-GB', {day: 'numeric', month: 'short'})}
                            </span>
                            <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Update</span>
                        </div>
                    </div>

                    <div className="absolute right-4 text-slate-300 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                        <ChevronRight size={16} className="text-blue-500" />
                    </div>
                </Link>
            ))}
        </div>
    </div>
  );
}