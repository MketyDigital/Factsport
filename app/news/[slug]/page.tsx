export const runtime = 'edge';
export const revalidate = 180; 

import { createClient } from '@supabase/supabase-js'; 
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { cache } from 'react'; 
import { ChevronLeft, Calendar, Clock, ArrowRight, Trophy, Flame, Zap, ChevronRight, Tag } from 'lucide-react';
import NewsArtwork from '@/app/components/NewsArtwork'; 
import ShareButton from '@/app/components/ShareButton';
import MarkdownRenderer from '@/app/components/MarkdownRenderer'; 
import BettingPromo from '@/app/components/BettingPromo';
import AdsterraStandardBanner from '@/app/components/AdsterraStandardBanner';

const getArticleData = cache(async (slug: string) => {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await supabase.from('news').select('*').eq('slug', slug).single();
  if (error) return null;
  return data;
});

export async function generateMetadata({ params }: { params: { slug: string } }) {
    const resolvedParams = await params;
    const article = await getArticleData(resolvedParams.slug);
    
    if (!article) return { title: 'Article Not Found | FactSport' };

    return {
        title: `${article.title} | FactSport`,
        description: article.body?.substring(0, 160) + '...',
        openGraph: {
            title: article.title,
            description: article.body?.substring(0, 160) + '...',
            type: 'article',
            publishedTime: new Date(article.created_at).toISOString(),
            images: [article.image_url || '/logo.png'],
        },
        twitter: {
            card: 'summary_large_image',
            title: article.title,
            description: article.body?.substring(0, 160) + '...',
            images: [article.image_url || '/logo.png'],
        }
    };
}

export default async function ArticlePage({ params }: { params: { slug: string } }) {
  const resolvedParams = await params;
  const article = await getArticleData(resolvedParams.slug);
    
  if (!article) return notFound();

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: matches } = await supabase.from('matches').select('*').eq('status', 'SCHEDULED').limit(3);

  const jsonLd = {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "headline": article.title,
      "image": [article.image_url || "https://factsport.com/logo.png"],
      "datePublished": new Date(article.created_at).toISOString(),
      "dateModified": new Date(article.updated_at || article.created_at).toISOString(),
      "author": [{"@type": "Person", "name": "FactSport Desk"}],
      "publisher": {"@type": "Organization", "name": "FactSport", "logo": {"@type": "ImageObject", "url": "https://factsport.com/logo.png"}},
      "description": article.body?.substring(0, 160) + '...'
  };

  const content = article.body || article.content || '';
  const splitIndex = content.indexOf('\n\n', Math.floor(content.length / 2));
  const part1 = splitIndex !== -1 ? content.slice(0, splitIndex) : content;
  const part2 = splitIndex !== -1 ? content.slice(splitIndex) : '';

  return (
    <div className="min-h-screen bg-white pb-24 font-sans text-slate-900 selection:bg-blue-200">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      
      <div className="relative h-[60vh] min-h-[400px] w-full bg-[#0a1428] overflow-hidden group border-b-8 border-blue-600">
        <NewsArtwork 
            image={article.image_url} 
            team1Logo={article.team_1_logo} 
            team2Logo={article.team_2_logo} 
            title={article.title} 
            className="w-full h-full opacity-60 transition duration-[2000ms] ease-out group-hover:scale-105 group-hover:opacity-40" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a1428] via-[#0a1428]/80 to-transparent"></div>
        
        <div className="absolute top-6 left-4 md:left-8 z-20">
            <Link href="/news" className="bg-white/10 backdrop-blur-md border border-white/20 text-white p-2.5 rounded-full hover:bg-white/20 transition-all inline-flex shadow-xl group/btn">
                <ChevronLeft size={20} className="group-hover/btn:-translate-x-1 transition-transform" />
            </Link>
        </div>

        <div className="absolute bottom-0 left-0 w-full p-6 md:p-12 z-20 max-w-7xl mx-auto">
            <div className="flex flex-wrap gap-2 mb-4">
                {article.is_breaking && <span className="bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-md uppercase tracking-widest shadow-lg animate-pulse flex items-center gap-1"><Flame size={12}/> Breaking</span>}
                <span className="bg-blue-600 text-white text-[10px] font-black px-3 py-1 rounded-md uppercase tracking-widest shadow-lg border border-blue-500 flex items-center gap-1">
                    <Tag size={12} /> {article.category || 'Football'}
                </span>
            </div>
            
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-white leading-tight md:leading-tight drop-shadow-2xl mb-4 tracking-tight max-w-4xl">
                {article.title}
            </h1>
            
            <div className="mb-4">
                <AdsterraStandardBanner />
            </div>
            
            <div className="flex items-center gap-6 text-xs font-bold text-slate-300 uppercase tracking-widest">
                <span className="flex items-center gap-1.5"><Calendar size={14} className="text-blue-500"/> {new Date(article.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric'})}</span>
                <span className="flex items-center gap-1.5"><Clock size={14} className="text-blue-500"/> {new Date(article.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
        
        <div className="lg:col-span-8">
            <div className="bg-white">

                <div className="mb-8 w-full max-w-3xl overflow-hidden rounded-xl bg-slate-50 border border-slate-100 shadow-sm max-h-[90px]">
                    <BettingPromo affiliateLink={null} />
                </div>

                <div className="prose prose-lg prose-slate max-w-none text-slate-800 leading-relaxed md:leading-loose font-medium prose-headings:font-black prose-headings:tracking-tight prose-a:text-blue-600 prose-img:rounded-2xl prose-img:shadow-lg">
                    {content ? (
                        <>
                            <MarkdownRenderer content={part1} />
                            
                            {part2 && (
                                <div className="my-8">
                                    <AdsterraStandardBanner />
                                </div>
                            )}

                            {part2 && <MarkdownRenderer content={part2} />}
                        </>
                    ) : (
                        <p className="text-slate-500 italic">This story is currently being updated...</p>
                    )}
                </div>
                
                <div className="mt-12 pt-6 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">Share Story</span>
                    <ShareButton title={article.title} slug={article.slug} />
                </div>

                <div className="mt-6">
                    <AdsterraStandardBanner />
                </div>

            </div> 
        </div>

        <div className="lg:col-span-4 space-y-8">
            <div className="sticky top-24 space-y-8">
                
                <div className="bg-[#0a1428] rounded-3xl p-8 text-white text-center shadow-2xl relative overflow-hidden border border-slate-800 group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600 rounded-full blur-[80px] opacity-30 group-hover:opacity-50 transition-opacity"></div>
                    <Trophy className="text-yellow-500 mx-auto mb-4" size={40} />
                    <h3 className="text-2xl font-black uppercase tracking-tighter leading-tight mb-3">Think You<br/><span className="text-yellow-500">Know Football?</span></h3>
                    <p className="text-sm text-slate-400 mb-6 font-medium">Predict upcoming fixtures correctly and Win Amazing Prizes Every Months.</p>
                    <Link href="/matches" className="block w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 rounded-xl text-xs tracking-widest uppercase transition-colors shadow-[0_5px_15px_rgba(234,179,8,0.3)]">
                        Start Predicting
                    </Link>
                </div>

                {matches && matches.length > 0 && (
                    <div className="bg-slate-50 rounded-3xl border border-slate-200 p-6">
                        <div className="flex items-center gap-2 mb-6">
                            <Zap size={16} className="text-blue-600 fill-blue-600"/>
                            <h3 className="text-sm font-black uppercase text-slate-800 tracking-widest">Upcoming Action</h3>
                        </div>
                        <div className="space-y-3">
                            {matches.map((match) => (
                                <Link key={match.id} href={`/match/${match.id}`} className="block bg-white border border-slate-100 rounded-2xl p-4 hover:shadow-md hover:border-blue-200 transition-all group">
                                    <div className="flex justify-between items-center font-black text-slate-800 mb-2">
                                        <span className="group-hover:text-blue-600 transition-colors truncate max-w-[40%]">{match.home_team}</span>
                                        <span className="text-slate-300 text-[10px] uppercase tracking-widest font-bold">VS</span>
                                        <span className="group-hover:text-blue-600 transition-colors truncate max-w-[40%] text-right">{match.away_team}</span>
                                    </div>
                                    <div className="text-[9px] text-slate-400 flex items-center justify-between font-bold uppercase tracking-widest">
                                        <span className="flex items-center gap-1"><Calendar size={10} /> {new Date(match.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short'})}</span>
                                        <span className="text-blue-500 bg-blue-50 px-2 py-0.5 rounded flex items-center gap-1 group-hover:bg-blue-600 group-hover:text-white transition-colors">Predict <ChevronRight size={10}/></span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}