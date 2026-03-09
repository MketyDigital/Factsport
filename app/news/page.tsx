export const runtime = 'edge';
export const revalidate = 300;

import { createClient } from '@/app/lib/supabase/server';
import Link from 'next/link';
// 🔥 FIX: Added Radio and BarChart2 to the import list below!
import { Calendar, ChevronRight, Zap, Trophy, Youtube, Newspaper, ArrowRight, Flame, Radio, BarChart2, ArrowRight } from 'lucide-react';
import NewsArtwork from '@/app/components/NewsArtwork'; 
import BettingPromo from '@/app/components/BettingPromo';

export default async function NewsListingPage() {
  const supabase = createClient();

  // 1. Fetch News
  const { data: news } = await supabase.from('news').select('*').order('created_at', { ascending: false });

  // 2. Logic: Featured vs Rest
  const featured = news?.find(n => n.is_headline) || news?.[0];
  const rest = news?.filter(n => n.id !== featured?.id) || [];

  return (
    <div className="min-h-screen bg-[#F0F2F5] pb-24 font-sans text-slate-900">
      
      {/* HEADER - CLEAN EDITORIAL LOOK */}
      <div className="bg-[#0a1428] text-white pt-8 pb-20 px-6 relative overflow-hidden shadow-lg border-b border-blue-900/30">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
        <div className="relative z-10 max-w-7xl mx-auto">
             <Link href="/" className="text-xs font-bold text-slate-400 hover:text-white mb-6 inline-flex items-center gap-1 transition-colors"><ChevronRight size={14} className="rotate-180"/> Back Home</Link>
             <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter flex items-center gap-3">
                 <Newspaper className="text-blue-500" size={36} /> The Newsroom
             </h1>
             <p className="text-slate-400 font-medium tracking-wide mt-2 text-sm max-w-md">Breaking stories, tactical Football analysis, and the latest from the world of Sport.</p>
        </div>
      </div>

      <div className="px-4 -mt-10 relative z-20 max-w-7xl mx-auto">

        {/* BIG FEATURED CARD - CINEMATIC LOOK */}
        {featured && (
            <Link href={`/news/${featured.slug}`} className="block group mb-8">
                <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 flex flex-col md:flex-row transition-transform duration-500 hover:shadow-2xl hover:-translate-y-1">
                    <div className="aspect-[4/3] md:aspect-auto md:w-2/3 relative overflow-hidden bg-slate-900">
                        <NewsArtwork 
                            image={featured.image_url} 
                            team1Logo={featured.team_1_logo} 
                            team2Logo={featured.team_2_logo} 
                            title={featured.title} 
                            className="w-full h-full object-cover transition duration-1000 group-hover:scale-105 group-hover:opacity-90"
                        />
                        <div className="absolute top-4 left-4 flex gap-2 z-10">
                             {featured.is_headline && <span className="bg-blue-600 text-white text-[10px] font-black px-3 py-1 rounded-md uppercase tracking-widest shadow-lg border border-blue-500">Top Story</span>}
                             {featured.is_breaking && <span className="bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-md uppercase tracking-widest shadow-lg animate-pulse border border-red-500"><Flame size={10} className="inline mr-1"/> Breaking</span>}
                        </div>
                    </div>
                    <div className="p-6 md:p-10 md:w-1/3 flex flex-col justify-center bg-white relative">
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-600 hidden md:block"></div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-black mb-4 uppercase tracking-widest">
                            <Calendar size={14} /> {new Date(featured.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric'})}
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight group-hover:text-blue-600 transition-colors tracking-tight">
                            {featured.title}
                        </h2>
                        <p className="text-slate-500 text-sm mt-4 line-clamp-3 leading-relaxed font-medium">
                            {featured.body?.substring(0, 200)}...
                        </p>
                        <div className="mt-8 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-blue-600 group-hover:gap-4 transition-all">
                            Read Full Story <ArrowRight size={14} />
                        </div>
                    </div>
                </div>
            </Link>
        )}

        
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

        {/* NEWS GRID - CLEAN MODERN CARDS */}
        <div className="flex items-center gap-3 mb-6 border-b border-slate-200 pb-2">
            <h3 className="font-black text-lg uppercase tracking-tight text-slate-800">Latest Updates</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {rest.map((item) => (
                <Link key={item.id} href={`/news/${item.slug}`} className="group bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-xl hover:border-blue-200 transition-all duration-300 flex flex-col h-full">
                    <div className="aspect-[16/10] relative overflow-hidden bg-slate-900 border-b border-slate-100">
                        <NewsArtwork 
                            image={item.image_url} 
                            team1Logo={item.team_1_logo} 
                            team2Logo={item.team_2_logo} 
                            title={item.title} 
                            className="w-full h-full object-cover transition duration-700 group-hover:scale-110 opacity-90 group-hover:opacity-100"
                        />
                        {item.is_breaking && <div className="absolute top-3 left-3 bg-red-600 text-white text-[9px] font-black tracking-widest px-2.5 py-1 rounded shadow-lg z-10 flex items-center gap-1"><Flame size={10} className="animate-pulse"/> BREAKING</div>}
                    </div>
                    <div className="p-5 flex flex-col flex-1">
                        <div className="text-[9px] text-slate-400 font-black mb-3 uppercase tracking-widest flex items-center gap-1.5">
                             <Calendar size={12} className="text-blue-500" /> {new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric'})}
                        </div>
                        <h3 className="font-black text-slate-800 text-lg leading-snug group-hover:text-blue-600 transition-colors line-clamp-3 mb-4">{item.title}</h3>
                        
                        {/* Pushes arrow to the bottom of the card */}
                        <div className="mt-auto pt-4 border-t border-slate-50 flex items-center text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-blue-600 transition-colors">
                            Read Article <ArrowRight size={12} className="ml-1 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                        </div>
                    </div>
                </Link>
            ))}
        </div>

        {(!news || news.length === 0) && (
            <div className="text-center py-32 bg-white rounded-3xl border border-slate-200 border-dashed shadow-sm">
                <Newspaper className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-black text-slate-700 mb-2">No News Available</h3>
                <p className="text-slate-500 font-medium">Our journalists are currently preparing the next update.</p>
            </div>
        )}
      </div>

        {/* 🟢 COMPONENT 1: BETTING PROMO (Compact layout at the top) */}
        <div className="max-w-2xl mx-auto">
            <BettingPromo affiliateLink={null} />
        </div>

      {/* QUICK ACTIONS FOOTER */}
      <div className="max-w-7xl mx-auto px-4 mt-16 mb-8">
          <div className="bg-[#0a1428] rounded-3xl p-8 shadow-2xl relative overflow-hidden border border-slate-800">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full blur-[100px] opacity-20"></div>
              <h3 className="text-white font-black text-xl italic mb-6 relative z-10 flex items-center gap-2"><Zap className="text-yellow-500"/> EXPLORE FACTSPORT</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
                  <Link href="/matches" className="bg-white/5 hover:bg-white/10 p-4 rounded-2xl flex flex-col items-center justify-center gap-3 transition border border-white/5 hover:border-white/20 active:scale-95 group">
                      <Trophy className="text-yellow-500 group-hover:scale-110 transition-transform" size={28} />
                      <span className="text-[11px] font-black uppercase tracking-widest text-white">Predictions</span>
                  </Link>
                  <Link href="/live" className="bg-white/5 hover:bg-white/10 p-4 rounded-2xl flex flex-col items-center justify-center gap-3 transition border border-white/5 hover:border-white/20 active:scale-95 group">
                      <Radio className="text-red-500 animate-pulse group-hover:scale-110 transition-transform" size={28} />
                      <span className="text-[11px] font-black uppercase tracking-widest text-white">Live Center</span>
                  </Link>
                  <Link href="/standings" className="bg-white/5 hover:bg-white/10 p-4 rounded-2xl flex flex-col items-center justify-center gap-3 transition border border-white/5 hover:border-white/20 active:scale-95 group">
                      <BarChart2 className="text-blue-400 group-hover:scale-110 transition-transform" size={28} />
                      <span className="text-[11px] font-black uppercase tracking-widest text-white">Tables</span>
                  </Link>
                  <a href="https://youtube.com/@factsportlive" target="_blank" rel="noopener noreferrer" className="bg-white/5 hover:bg-white/10 p-4 rounded-2xl flex flex-col items-center justify-center gap-3 transition border border-white/5 hover:border-white/20 active:scale-95 group">
                      <Youtube className="text-red-600 group-hover:scale-110 transition-transform" size={28} />
                      <span className="text-[11px] font-black uppercase tracking-widest text-white">YouTube</span>
                  </a>
              </div>
          </div>
      </div>
    </div>
  );
}