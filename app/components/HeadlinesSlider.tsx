// app/components/HeadlinesSlider.tsx

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import NewsArtwork from '@/app/components/NewsArtwork';

export default function HeadlinesSlider({ headlines }: { headlines: any[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!headlines.length) return;

    const id = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % headlines.length);
    }, 5000);

    return () => window.clearInterval(id);
  }, [headlines.length]);

  if (headlines.length === 0) return null;

  return (
    <div className="relative w-full overflow-hidden shadow-2xl border-y md:border border-slate-800 bg-[#050a14]">
      <div className="relative w-full h-[40svh] md:h-[45vh] min-h-[250px] overflow-hidden bg-black">
        {headlines.map((item, index) => (
          <div
            key={`headline-image-${item.id}`}
            className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out ${index === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
          >
            <Link href={`/news/${item.slug || '#'}`} className="block w-full h-full relative">
              <NewsArtwork
                image={item.image_url}
                team1Logo={item.team_1_logo}
                team2Logo={item.team_2_logo}
                title={item.title}
                className="w-full h-full object-cover"
                loading={index === 0 ? 'eager' : 'lazy'}
                fetchPriority={index === 0 ? 'high' : 'auto'}
                decoding="async"
              />
            </Link>
          </div>
        ))}
      </div>

      <div className="relative w-full bg-[#050a14] p-5 md:p-8 min-h-[140px] md:min-h-[160px] flex flex-col justify-center">
        {headlines.map((item, index) => (
          <div
            key={`headline-text-${item.id}`}
            className={`absolute left-0 right-0 px-5 md:px-8 transition-all duration-700 ease-in-out ${index === currentIndex ? 'opacity-100 translate-y-0 z-10' : 'opacity-0 translate-y-4 z-0 pointer-events-none'}`}
          >
            <Link href={`/news/${item.slug || '#'}`} className="block w-full group">
              <span className="bg-blue-600 text-white text-[9px] md:text-[10px] font-black px-2.5 py-1 rounded uppercase tracking-widest mb-3 inline-block shadow-md">
                Top Story
              </span>
              <h3 className="text-white font-black text-xl md:text-3xl leading-snug line-clamp-3 group-hover:text-blue-400 transition-colors">
                {item.title}
              </h3>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}