export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { createClient } from '@/app/lib/supabase/server';
import Link from 'next/link';
import { Calendar, ChevronRight, Zap, Trophy, Youtube, Newspaper, ArrowRight } from 'lucide-react';
import NewsArtwork from '@/app/components/NewsArtwork'; // ✅ Import the smart artwork component

export default async function NewsListingPage() {
  const supabase = createClient();

  // 1. Fetch News
  const { data: news } = await supabase.from('news').select('*').order('created_at', { ascending: false });

  // 2. Logic: Featured vs Rest
  const featured = news?.find(n => n.is_headline) || news?.[0];
  const rest = news?.filter(n => n.id !== featured?.id) || [];

  return (
    <div className="min-h-screen bg-[#F0F2F5] pb-24 font-sans text-slate-900">
      
      {/* HEADER */}
      <div className="bg-[#0a1428] text-white pt-8 pb-16 px-6 rounded-b-[2.5rem] relative overflow-hidden shadow-2xl">
        <div className="relative z-10">
             <Link href="/" className="text-xs font-bold text-slate-400 hover:text-white mb-4 inline-flex items-center gap-1"><ChevronRight size={14} className="rotate-180"/> Back Home</Link>
             <h1 className="text-3xl font-black italic uppercase">Latest News</h1>
        </div>
      </div>

      <div className="px-4 -mt-10 relative z-20">

        {/* 🏆 PREDICT & WIN BANNER */}
        <div className="mb-8 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-2xl p-6 text-black shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl transform translate-x-20 -translate-y-20"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-black/10 rounded-full flex items-center justify-center backdrop-blur-sm">
                        <Trophy size={24} className="text-black"/>
                    </div>
                    <div>
                        <h3 className="font-black text-xl uppercase italic tracking-tighter">Predict & Win Millions</h3>
                        <p className="font-bold text-sm opacity-80">Join the monthly leaderboard. Win up to ₦500,000!</p>
                    </div>
                </div>
                <Link href="/matches" className="bg-black text-white px-8 py-3 rounded-xl font-black text-xs uppercase hover:scale-105 transition shadow-xl flex items-center gap-2">
                    Play Now <ArrowRight size={14}/>
                </Link>
            </div>
        </div>
        
        {/* BIG FEATURED CARD */}
        {featured && (
            <Link href={`/news/${featured.slug}`} className="block group mb-8">
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
                    <div className="aspect-video w-full relative overflow-hidden bg-slate-100">
                        {/* 🟢 FIXED: Use NewsArtwork instead of <img> */}
                        <NewsArtwork 
                            image={featured.image_url} 
                            team1Logo={featured.team_1_logo} 
                            team2Logo={featured.team_2_logo} 
                            title={featured.title} 
                            className="w-full h-full object-cover transition duration-700 group-hover:scale-105"
                        />
                        <div className="absolute top-4 left-4 flex gap-2 z-10">
                             {featured.is_headline && <span className="bg-blue-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase shadow-lg">Featured</span>}
                             {featured.is_breaking && <span className="bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase shadow-lg animate-pulse">Breaking</span>}
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold mb-2 uppercase tracking-widest">
                            <Calendar size={12} /> {new Date(featured.created_at).toLocaleDateString()}
                        </div>
                        <h2 className="text-xl md:text-2xl font-black text-slate-900 leading-tight group-hover:text-blue-600 transition">
                            {featured.title}
                        </h2>
                        <p className="text-slate-500 text-sm mt-3 line-clamp-2">
                            {featured.body?.substring(0, 150)}...
                        </p>
                    </div>
                </div>
            </Link>
        )}

        {/* NEWS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rest.map((item) => (
                <Link key={item.id} href={`/news/${item.slug}`} className="group bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition">
                    <div className="aspect-[3/2] relative overflow-hidden bg-slate-100">
                        {/* 🟢 FIXED: Use NewsArtwork instead of <img> */}
                        <NewsArtwork 
                            image={item.image_url} 
                            team1Logo={item.team_1_logo} 
                            team2Logo={item.team_2_logo} 
                            title={item.title} 
                            className="w-full h-full object-cover transition duration-500 group-hover:scale-105"
                        />
                        {item.is_breaking && <div className="absolute top-2 right-2 bg-red-600 text-white text-[9px] font-bold px-2 py-1 rounded shadow-md z-10">BREAKING</div>}
                    </div>
                    <div className="p-4">
                        <div className="text-[9px] text-slate-400 font-bold mb-1 uppercase flex items-center gap-1">
                             <Calendar size={10} /> {new Date(item.created_at).toLocaleDateString()}
                        </div>
                        <h3 className="font-bold text-slate-800 leading-snug group-hover:text-blue-600 transition line-clamp-2">{item.title}</h3>
                    </div>
                </Link>
            ))}
        </div>

        {(!news || news.length === 0) && <div className="text-center py-20"><p className="text-slate-400 font-bold">No news articles yet.</p></div>}
      </div>

      {/* QUICK ACTIONS FOOTER */}
      <div className="px-4 mt-12 mb-4">
          <div className="bg-[#0a1428] rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 blur-[80px] opacity-20"></div>
              <h3 className="text-white font-black text-lg italic mb-4 relative z-10 flex items-center gap-2"><Zap className="text-yellow-500"/> QUICK ACTIONS</h3>
              <div className="grid grid-cols-3 gap-3 relative z-10">
                  <Link href="/matches" className="bg-white/10 hover:bg-white/20 p-3 rounded-xl flex flex-col items-center justify-center gap-2 transition border border-white/5 active:scale-95">
                      <Trophy className="text-yellow-500" size={24} />
                      <span className="text-[10px] font-bold text-white">Predictions</span>
                  </Link>
                  <Link href="/" className="bg-white/10 hover:bg-white/20 p-3 rounded-xl flex flex-col items-center justify-center gap-2 transition border border-white/5 active:scale-95">
                      <Newspaper className="text-blue-400" size={24} />
                      <span className="text-[10px] font-bold text-white">Home</span>
                  </Link>
                  <a href="https://youtube.com/@factsportlive" target="_blank" className="bg-white/10 hover:bg-white/20 p-3 rounded-xl flex flex-col items-center justify-center gap-2 transition border border-white/5 active:scale-95">
                      <Youtube className="text-red-500" size={24} />
                      <span className="text-[10px] font-bold text-white">YouTube</span>
                  </a>
              </div>
          </div>
      </div>
    </div>
  );
}