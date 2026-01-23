export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { createClient } from '@/app/lib/supabase/server';
import Link from 'next/link';
import { Calendar, ChevronRight, Tag, Star } from 'lucide-react';

export default async function NewsListingPage() {
  const supabase = createClient();

  // 1. Fetch News (Order by Newest)
  const { data: news } = await supabase
    .from('news')
    .select('*')
    .order('created_at', { ascending: false });

  // 2. Logic: Find the "Headline" item for the big card
  // If no headline is marked, just take the newest item
  const featured = news?.find(n => n.is_headline) || news?.[0];
  
  // 3. The Rest of the news (excluding the featured one)
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
        
        {/* BIG FEATURED CARD */}
        {featured && (
            <Link href={`/news/${featured.slug}`} className="block group mb-8">
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
                    <div className="aspect-video w-full relative overflow-hidden">
                        <img 
                            src={featured.image_url || 'https://images.unsplash.com/photo-1522778119026-d647f0565c71?auto=format&fit=crop&w=800&q=80'} 
                            alt={featured.title} 
                            className="w-full h-full object-cover transition duration-700 group-hover:scale-110" 
                        />
                        {/* Badges */}
                        <div className="absolute top-4 left-4 flex gap-2">
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

        {/* NEWS GRID (The Rest) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rest.map((item) => (
                <Link key={item.id} href={`/news/${item.slug}`} className="group bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition">
                    <div className="aspect-[3/2] relative overflow-hidden">
                        <img 
                            src={item.image_url || 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=800&q=80'} 
                            alt={item.title} 
                            className="w-full h-full object-cover transition duration-500 group-hover:scale-105" 
                        />
                        {item.is_breaking && (
                             <div className="absolute top-2 right-2 bg-red-600 text-white text-[9px] font-bold px-2 py-1 rounded shadow-md">
                                BREAKING
                            </div>
                        )}
                    </div>
                    <div className="p-4">
                        <div className="text-[9px] text-slate-400 font-bold mb-1 uppercase flex items-center gap-1">
                             <Calendar size={10} /> {new Date(item.created_at).toLocaleDateString()}
                        </div>
                        <h3 className="font-bold text-slate-800 leading-snug group-hover:text-blue-600 transition line-clamp-2">
                            {item.title}
                        </h3>
                    </div>
                </Link>
            ))}
        </div>

        {(!news || news.length === 0) && (
            <div className="text-center py-20">
                <p className="text-slate-400 font-bold">No news articles yet.</p>
            </div>
        )}

      </div>
    </div>
  );
}