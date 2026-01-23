export const runtime = 'edge';

import { createClient } from '@/app/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Calendar, User, Clock, Share2, Tag } from 'lucide-react';

export default async function ArticlePage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  // 1. Fetch Article
  const { data: article } = await supabase.from('news').select('*').eq('id', params.id).single();
  
  if (!article) return notFound();

  // 2. Increment View Count (Optional - done in background ideally, but simple update here works for V1)
  // Note: On Edge, simple GETs usually shouldn't mutate, but for a simple view counter it's often acceptable or done via client useEffect. 
  // For now, we just display.

  // 3. Fetch "Related" (Latest 3 matches to keep them engaged)
  const { data: matches } = await supabase.from('matches').select('*').eq('status', 'SCHEDULED').limit(3);

  return (
    <div className="min-h-screen bg-[#F0F2F5] pb-24 font-sans text-slate-900">
      
      {/* HERO IMAGE */}
      <div className="relative h-64 md:h-80 w-full bg-slate-900">
         <img 
            src={article.image_url || 'https://images.unsplash.com/photo-1522778119026-d647f0565c71?auto=format&fit=crop&w=1200&q=80'} 
            className="w-full h-full object-cover opacity-60" 
         />
         <div className="absolute inset-0 bg-gradient-to-t from-[#F0F2F5] via-transparent to-black/30"></div>
         
         <div className="absolute top-4 left-4">
             <Link href="/news" className="bg-white/20 backdrop-blur-md text-white p-2 rounded-full hover:bg-white/30 transition inline-flex">
                <ChevronLeft size={20} />
             </Link>
         </div>

         <div className="absolute bottom-0 left-0 w-full p-6">
            <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded uppercase tracking-wider mb-2 inline-block shadow-lg">
                {article.category || 'News'}
            </span>
            <h1 className="text-2xl md:text-4xl font-black text-slate-900 leading-tight drop-shadow-sm mb-2">
                {article.title}
            </h1>
            <div className="flex items-center gap-4 text-xs font-bold text-slate-600">
                <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(article.created_at).toLocaleDateString()}</span>
                <span className="flex items-center gap-1"><Clock size={12}/> 3 min read</span>
            </div>
         </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-6 grid grid-cols-1 md:grid-cols-3 gap-8">
         
         {/* MAIN CONTENT */}
         <div className="md:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
                {/* Render Content: 
                   If you save HTML from a rich text editor, use dangerouslySetInnerHTML.
                   If plain text, just render in <p>.
                   We assume plain text with line breaks for safety here.
                */}
                <div className="prose prose-slate prose-sm max-w-none">
                    {article.content ? article.content.split('\n').map((paragraph: string, i: number) => (
                        <p key={i} className="mb-4 text-slate-700 leading-relaxed text-sm md:text-base">
                            {paragraph}
                        </p>
                    )) : <p>No content available.</p>}
                </div>
            </div>
         </div>

         {/* SIDEBAR (Betting Conversion) */}
         <div className="space-y-6">
            
            {/* CTA Card */}
            <div className="bg-[#0a1428] rounded-2xl p-6 text-white text-center shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600 rounded-full blur-[60px] opacity-20"></div>
                <h3 className="text-lg font-black italic mb-2">Feeling Lucky?</h3>
                <p className="text-sm text-slate-400 mb-4">Predict matches and win monthly cash prizes.</p>
                <Link href="/" className="block w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-3 rounded-xl transition active:scale-95">
                    PREDICT NOW
                </Link>
            </div>

            {/* Upcoming Matches List */}
            {matches && matches.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
                    <h3 className="text-xs font-black uppercase text-slate-400 mb-4 tracking-widest">Upcoming Matches</h3>
                    <div className="space-y-3">
                        {matches.map((match) => (
                            <Link key={match.id} href={`/match/${match.id}`} className="block border border-slate-100 rounded-xl p-3 hover:bg-slate-50 transition">
                                <div className="flex justify-between items-center text-xs font-bold text-slate-800 mb-1">
                                    <span>{match.home_team}</span>
                                    <span className="text-slate-400">vs</span>
                                    <span>{match.away_team}</span>
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
    </div>
  );
}