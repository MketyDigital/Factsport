export const runtime = 'edge';
export const revalidate = 60;

import { createClient } from '@/app/lib/supabase/server';
import Link from 'next/link';
import { ChevronLeft, Calendar, Newspaper } from 'lucide-react';
import NewsArtwork from '@/app/components/NewsArtwork'; // ✅ Import the smart artwork component

export const metadata = {
  title: 'Latest Sports News | FactSport',
  description: 'Breaking football news, transfer updates, and match previews.',
};

export default async function NewsPage() {
  const supabase = createClient();

  // Fetch all news
  const { data: news } = await supabase
    .from('news')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  const allNews = news || [];

  return (
    <div className="min-h-screen bg-[#F0F2F5] pb-20 font-sans">
      
      {/* HEADER */}
      <div className="bg-[#0a1428] text-white p-4 sticky top-0 z-50 shadow-lg">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition"><ChevronLeft size={20}/></Link>
          <h1 className="text-lg font-black tracking-tight flex items-center gap-2">
             <Newspaper size={20} className="text-blue-400" /> Latest News
          </h1>
        </div>
      </div>

      {/* NEWS LIST */}
      <div className="p-4 space-y-4">
        {allNews.length > 0 ? (
          allNews.map((item) => (
            <Link 
              href={`/news/${item.slug}`} 
              key={item.id} 
              className="block bg-white rounded-2xl p-3 shadow-sm border border-slate-100 hover:shadow-md transition active:scale-[0.99]"
            >
              <div className="flex flex-col gap-3">
                {/* 🟢 FIXED: Uses NewsArtwork to show Team Logos if image is missing */}
                <div className="w-full aspect-video rounded-xl overflow-hidden relative bg-slate-100">
                   <NewsArtwork 
                      image={item.image_url} 
                      team1Logo={item.team_1_logo} 
                      team2Logo={item.team_2_logo} 
                      title={item.title} 
                      className="w-full h-full"
                   />
                </div>

                <div className="flex flex-col gap-2">
                   <h2 className="text-sm font-bold text-slate-800 leading-tight line-clamp-2">
                      {item.title}
                   </h2>
                   <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                      <Calendar size={10} />
                      <span>{new Date(item.created_at).toLocaleDateString()}</span>
                      {item.is_breaking && (
                        <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100 font-bold uppercase text-[8px]">Breaking</span>
                      )}
                   </div>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div className="text-center py-20 opacity-50">
             <div className="bg-slate-200 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Newspaper className="text-slate-400" size={32} />
             </div>
             <p className="text-sm font-bold text-slate-500">No news articles found.</p>
          </div>
        )}
      </div>

    </div>
  );
}