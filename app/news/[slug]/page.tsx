export const runtime = 'edge';

import { createClient } from '@/app/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Calendar, Clock, Share2, ArrowRight, Zap, Trophy, Youtube, Newspaper } from 'lucide-react';
import NewsArtwork from '@/app/components/NewsArtwork'; 

export default async function ArticlePage({ params }: { params: { slug: string } }) {
  const resolvedParams = await params;
  const supabase = createClient();

  // 1. Fetch Article by SLUG
  const { data: article } = await supabase
    .from('news')
    .select('*')
    .eq('slug', resolvedParams.slug)
    .single();
    
  if (!article) return notFound();

  // 2. Fetch Latest 3 Matches for Sidebar (Cross-sell)
  const { data: matches } = await supabase.from('matches').select('*').eq('status', 'SCHEDULED').limit(3);

  return (
    <div className="min-h-screen bg-[#F0F2F5] pb-24 font-sans text-slate-900">
      
      {/* HERO SECTION */}
      <div className="relative h-64 md:h-80 w-full bg-slate-900 overflow-hidden group">
         <NewsArtwork 
            image={article.image_url} 
            team1Logo={article.team_1_logo} 
            team2Logo={article.team_2_logo} 
            title={article.title}
            className="w-full h-full transition duration-700 group-hover:scale-105"
         />
         <div className="absolute inset-0 bg-gradient-to-t from-[#F0F2F5] via-black/20 to-black/40"></div>
         
         <div className="absolute top-4 left-4 z-20">
             <Link href="/" className="bg-white/20 backdrop-blur-md text-white p-2 rounded-full hover:bg-white/30 transition inline-flex shadow-lg">
                <ChevronLeft size={20} />
             </Link>
         </div>

         <div className="absolute bottom-0 left-0 w-full p-6 z-20">
            <div className="flex gap-2 mb-2">
                {article.is_breaking && <span className="bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded uppercase shadow-sm animate-pulse">Breaking</span>}
                <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded uppercase shadow-sm">{article.category || 'News'}</span>
            </div>
            <h1 className="text-2xl md:text-4xl font-black text-slate-900 leading-tight drop-shadow-sm mb-2">
                {article.title}
            </h1>
            <div className="flex items-center gap-4 text-xs font-bold text-slate-600">
                <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(article.created_at).toLocaleDateString()}</span>
                <span className="flex items-center gap-1"><Clock size={12}/> {new Date(article.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
         </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-6 grid grid-cols-1 md:grid-cols-3 gap-8">
         
         {/* MAIN CONTENT */}
         <div className="md:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
                <div className="prose prose-slate prose-sm max-w-none text-slate-700 leading-relaxed whitespace-pre-line">
                    {article.body || article.content || "No content available."}
                </div>
                
                {/* 🏆 NEW: PREDICT & WIN BANNER (End of Article) */}
                <div className="mt-8 mb-4 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-xl p-6 text-black relative overflow-hidden group shadow-lg">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-20 rounded-full blur-2xl transform translate-x-10 -translate-y-10"></div>
                    <div className="relative z-10">
                        <h3 className="font-black text-lg uppercase italic tracking-tighter mb-1">Make Money from Sports?</h3>
                        <p className="text-xs font-bold opacity-90 mb-4">Join our VIP Prediction League. Win Monthly Cash Prizes!</p>
                        <Link href="/matches" className="inline-flex items-center gap-2 bg-black text-white px-6 py-3 rounded-lg font-black text-xs uppercase hover:scale-105 transition shadow-lg">
                            Predict Now <ArrowRight size={14} />
                        </Link>
                    </div>
                </div>

                {/* Share Button */}
                <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400">Share this story</span>
                    <button className="flex items-center gap-2 text-blue-600 font-bold text-xs hover:bg-blue-50 px-3 py-1.5 rounded-full transition">
                        <Share2 size={14} /> Share Article
                    </button>
                </div>
            </div>
         </div>

         {/* SIDEBAR (Betting Conversion) */}
         <div className="space-y-6">
            {/* CTA Card */}
            <div className="bg-[#0a1428] rounded-2xl p-6 text-white text-center shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600 rounded-full blur-[60px] opacity-20"></div>
                <h3 className="text-lg font-black italic mb-2">Make Money?</h3>
                <p className="text-sm text-slate-400 mb-4">Predict matches correctly and win monthly cash prizes.</p>
                <Link href="/matches" className="block w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-3 rounded-xl transition active:scale-95 shadow-lg">
                    PREDICT NOW
                </Link>
            </div>

            {/* Upcoming Matches */}
            {matches && matches.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
                    <h3 className="text-xs font-black uppercase text-slate-400 mb-4 tracking-widest">Upcoming Matches</h3>
                    <div className="space-y-3">
                        {matches.map((match) => (
                            <Link key={match.id} href={`/match/${match.id}`} className="block border border-slate-100 rounded-xl p-3 hover:bg-slate-50 transition group">
                                <div className="flex justify-between items-center text-xs font-bold text-slate-800 mb-1">
                                    <span className="group-hover:text-blue-600 transition">{match.home_team}</span>
                                    <span className="text-slate-400 text-[10px]">vs</span>
                                    <span className="group-hover:text-blue-600 transition">{match.away_team}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                    <Calendar size={10} /> {new Date(match.match_date).toLocaleDateString()}
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
         </div>

      </div>

      {/* 🚀 QUICK ACTIONS FOOTER (Added) */}
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