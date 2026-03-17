export const runtime = 'edge';
export const revalidate = 180;

import { createClient } from '@supabase/supabase-js'; 
import Link from 'next/link';
import { Calendar, ChevronRight, Zap, Trophy, Youtube, Newspaper, ArrowRight, Flame, Radio, BarChart2, ChevronLeft } from 'lucide-react';
import NewsArtwork from '@/app/components/NewsArtwork'; 
import AdsterraStandardBanner from '@/app/components/AdsterraStandardBanner';
import AdsterraNativeBanner from '@/app/components/AdsterraNativeBanner';

const CATEGORIES = ['All', 'Football', 'Transfers', 'Sports Update', 'Champions League', 'Euros', 'World Cup', 'AFCON', 'Copa America'];
const ITEMS_PER_PAGE = 12;

// 🔥 SEO METADATA ADDED
export const metadata = {
  title: 'Breaking Sports News & Football Updates | FactSport',
  description: 'Read the latest football news, transfer rumors, and breaking sports updates from around the globe.',
};

export default async function NewsListingPage({ searchParams }: { searchParams: { category?: string, page?: string } }) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const resolvedParams = await searchParams;
  
  const currentCategory = resolvedParams.category || 'All';
  const currentPage = parseInt(resolvedParams.page || '1');

  const from = (currentPage - 1) * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE - 1;

  let query = supabase.from('news').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  if (currentCategory !== 'All') {
      query = query.eq('category', currentCategory);
  }
  query = query.range(from, to);

  const { data: news, count } = await query;
  const totalPages = count ? Math.ceil(count / ITEMS_PER_PAGE) : 1;

  const isFirstPage = currentPage === 1;
  const featured = isFirstPage ? (news?.find(n => n.is_headline) || news?.[0]) : null;
  const rest = featured ? (news?.filter(n => n.id !== featured.id) || []) : (news || []);

  return (
    <div className="min-h-screen bg-[#F0F2F5] pb-24 font-sans text-slate-900">
      
      {/* HEADER */}
      <div className="bg-[#0a1428] text-white pt-8 pb-16 px-6 relative overflow-hidden shadow-lg border-b border-blue-900/30">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
        <div className="relative z-10 max-w-7xl mx-auto">
             <Link href="/" className="text-xs font-bold text-slate-400 hover:text-white mb-6 inline-flex items-center gap-1 transition-colors"><ChevronRight size={14} className="rotate-180"/> Back Home</Link>
             <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter flex items-center gap-3">
                 <Newspaper className="text-blue-500" size={36} /> The Newsroom
             </h1>
             <p className="text-slate-400 font-medium tracking-wide mt-2 text-sm max-w-md">Breaking stories, tactical Football analysis, and the latest from the world of Sport.</p>
        </div>
      </div>

      {/* CATEGORY NAVIGATOR */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm overflow-x-auto scrollbar-hide">
          <div className="max-w-7xl mx-auto flex px-4 py-3 space-x-2 min-w-max">
              {CATEGORIES.map((cat) => (
                  <Link 
                      key={cat} 
                      href={`/news?category=${encodeURIComponent(cat)}&page=1`} 
                      scroll={false}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${currentCategory === cat ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200'}`}
                  >
                      {cat}
                  </Link>
              ))}
          </div>
      </div>

      <div className="px-4 mt-6 relative z-20 max-w-7xl mx-auto">

        {/* 🟢 THE TOP BILLBOARD: Instant money on page load! */}
        <AdsterraStandardBanner />

        {/* FEATURED CARD (Only Page 1) */}
        {featured && (
            <Link href={`/news/${featured.slug}`} className="block group mb-8">
                <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 flex flex-col md:flex-row transition-transform duration-500 hover:shadow-2xl hover:-translate-y-1">
                    <div className="aspect-[4/3] md:aspect-auto md:w-2/3 relative overflow-hidden bg-slate-900">
                        <NewsArtwork image={featured.image_url} team1Logo={featured.team_1_logo} team2Logo={featured.team_2_logo} title={featured.title} className="w-full h-full object-cover transition duration-1000 group-hover:scale-105 group-hover:opacity-90" />
                        <div className="absolute top-4 left-4 flex gap-2 z-10">
                             {featured.is_headline && <span className="bg-blue-600 text-white text-[10px] font-black px-3 py-1 rounded-md uppercase tracking-widest shadow-lg border border-blue-500">Top Story</span>}
                             {featured.is_breaking && <span className="bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-md uppercase tracking-widest shadow-lg animate-pulse border border-red-500"><Flame size={10} className="inline mr-1"/> Breaking</span>}
                        </div>
                    </div>
                    <div className="p-6 md:p-10 md:w-1/3 flex flex-col justify-center bg-white relative">
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-black mb-4 uppercase tracking-widest">
                            <Calendar size={14} /> {new Date(featured.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric'})}
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight group-hover:text-blue-600 transition-colors tracking-tight">{featured.title}</h2>
                        <p className="text-slate-500 text-sm mt-4 line-clamp-3 leading-relaxed font-medium">{featured.body?.substring(0, 200)}...</p>
                        <div className="mt-8 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-blue-600 group-hover:gap-4 transition-all">Read Full Story <ArrowRight size={14} /></div>
                    </div>
                </div>
            </Link>
        )}

        {/* NEWS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {rest.map((item) => (
                <Link key={item.id} href={`/news/${item.slug}`} className="group bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-xl hover:border-blue-200 transition-all duration-300 flex flex-col h-full">
                    <div className="aspect-[16/10] relative overflow-hidden bg-slate-900 border-b border-slate-100">
                        <NewsArtwork image={item.image_url} team1Logo={item.team_1_logo} team2Logo={item.team_2_logo} title={item.title} className="w-full h-full object-cover transition duration-700 group-hover:scale-110 opacity-90 group-hover:opacity-100" />
                        <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
                            {item.category && <span className="bg-black/60 backdrop-blur-md text-white text-[8px] font-black px-2 py-1 rounded shadow-sm uppercase tracking-widest">{item.category}</span>}
                            {item.is_breaking && <span className="bg-red-600 text-white text-[8px] font-black tracking-widest px-2 py-1 rounded shadow-lg flex items-center gap-1"><Flame size={10} className="animate-pulse"/> BREAKING</span>}
                        </div>
                    </div>
                    <div className="p-5 flex flex-col flex-1">
                        <div className="text-[9px] text-slate-400 font-black mb-3 uppercase tracking-widest flex items-center gap-1.5"><Calendar size={12} className="text-blue-500" /> {new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric'})}</div>
                        <h3 className="font-black text-slate-800 text-lg leading-snug group-hover:text-blue-600 transition-colors line-clamp-3 mb-4">{item.title}</h3>
                        <div className="mt-auto pt-4 border-t border-slate-50 flex items-center text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-blue-600 transition-colors">Read Article <ArrowRight size={12} className="ml-1 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" /></div>
                    </div>
                </Link>
            ))}
        </div>

        {/* PAGINATION CONTROLS */}
        {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mt-8">
                <Link 
                    href={`/news?category=${encodeURIComponent(currentCategory)}&page=${currentPage - 1}`}
                    className={`px-4 py-2 flex items-center gap-2 rounded-xl text-xs font-black uppercase tracking-widest ${currentPage === 1 ? 'pointer-events-none opacity-30 bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition'}`}
                >
                    <ChevronLeft size={14}/> Prev
                </Link>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Page {currentPage} of {totalPages}</span>
                <Link 
                    href={`/news?category=${encodeURIComponent(currentCategory)}&page=${currentPage + 1}`}
                    className={`px-4 py-2 flex items-center gap-2 rounded-xl text-xs font-black uppercase tracking-widest ${currentPage === totalPages ? 'pointer-events-none opacity-30 bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition'}`}
                >
                    Next <ChevronRight size={14}/>
                </Link>
            </div>
        )}

        {(!news || news.length === 0) && (
            <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 border-dashed shadow-sm mt-6">
                <Newspaper className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-black text-slate-700 mb-2">No News Available</h3>
                <p className="text-slate-500 font-medium">Try checking a different category.</p>
            </div>
        )}
      </div>

           {/* 🟢 THE SCROLL CATCHER: Native banner blends into the feed */}
           <AdsterraNativeBanner />

      {/* QUICK ACTIONS FOOTER */}
      <div className="max-w-7xl mx-auto px-4 mt-16 mb-8">
          <div className="bg-[#0a1428] rounded-3xl p-8 shadow-2xl relative overflow-hidden border border-slate-800">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full blur-[100px] opacity-20"></div>
              <h3 className="text-white font-black text-xl italic mb-6 relative z-10 flex items-center gap-2"><Zap className="text-yellow-500"/> EXPLORE FACTSPORT</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
                  <Link href="/matches" className="bg-white/5 hover:bg-white/10 p-4 rounded-2xl flex flex-col items-center justify-center gap-3 transition border border-white/5 hover:border-white/20 active:scale-95 group"><Trophy className="text-yellow-500 group-hover:scale-110 transition-transform" size={28} /><span className="text-[11px] font-black uppercase tracking-widest text-white">Predictions</span></Link>
                  <Link href="/live" className="bg-white/5 hover:bg-white/10 p-4 rounded-2xl flex flex-col items-center justify-center gap-3 transition border border-white/5 hover:border-white/20 active:scale-95 group"><Radio className="text-red-500 animate-pulse group-hover:scale-110 transition-transform" size={28} /><span className="text-[11px] font-black uppercase tracking-widest text-white">Live Center</span></Link>
                  <Link href="/standings" className="bg-white/5 hover:bg-white/10 p-4 rounded-2xl flex flex-col items-center justify-center gap-3 transition border border-white/5 hover:border-white/20 active:scale-95 group"><BarChart2 className="text-blue-400 group-hover:scale-110 transition-transform" size={28} /><span className="text-[11px] font-black uppercase tracking-widest text-white">Tables</span></Link>
                  <a href="https://youtube.com/@factsportlive" target="_blank" rel="noopener noreferrer" className="bg-white/5 hover:bg-white/10 p-4 rounded-2xl flex flex-col items-center justify-center gap-3 transition border border-white/5 hover:border-white/20 active:scale-95 group"><Youtube className="text-red-600 group-hover:scale-110 transition-transform" size={28} /><span className="text-[11px] font-black uppercase tracking-widest text-white">YouTube</span></a>
              </div>
          </div>
      </div>
    </div>
  );
}