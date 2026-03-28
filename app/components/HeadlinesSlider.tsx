'use client';

import { useState } from 'react';
import Link from "next/link";
import NewsArtwork from '@/app/components/NewsArtwork';
import { useSmartInterval } from '@/app/hooks/useSmartInterval';

export default function HeadlinesSlider({ headlines }: { headlines: any[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextSlide = () => {
      setCurrentIndex((prev) => (prev + 1) % headlines.length);
  };

  useSmartInterval(nextSlide, headlines.length > 0 ? 5000 : null);

  if (headlines.length === 0) return null;

  return (
    <div className="relative w-full rounded-none md:rounded-2xl overflow-hidden shadow-2xl border-y md:border border-slate-800 bg-[#050a14] flex flex-col">
      
      {/* Premium Animated Progress Bars (Now pinned to the very top) */}
      <div className="absolute top-3 left-4 right-4 md:top-4 md:left-6 md:right-6 z-30 flex gap-1.5">
          {headlines.map((_, idx) => (
              <div key={idx} className="h-1 md:h-1.5 flex-1 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm shadow-sm">
                  {idx === currentIndex && (
                      <div className="h-full bg-blue-500 animate-[progress_5s_linear] origin-left shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>
                  )}
                  {idx < currentIndex && (
                      <div className="h-full bg-blue-500"></div>
                  )}
              </div>
          ))}
      </div>

      {/* TOP HALF: The Animated Image */}
      <div className="relative w-full h-[40svh] md:h-[45vh] min-h-[250px] overflow-hidden bg-black z-10">
        {headlines.map((item, index) => (
          <div 
              key={`img-${item.id}`}
              className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out ${index === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
          >
              <Link href={`/news/${item.slug || '#'}`} className="block w-full h-full relative">
                  {/* Ken Burns Effect */}
                  <div className={`absolute inset-0 w-full h-full transition-transform duration-[6000ms] ease-linear ${index === currentIndex ? 'scale-110' : 'scale-100'}`}>
                      <NewsArtwork 
                          image={item.image_url} 
                          team1Logo={item.team_1_logo} 
                          team2Logo={item.team_2_logo}
                          title={item.title}
                          className="w-full h-full object-cover"
                      />
                  </div>
                  {/* Light Vignette just for image depth */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#050a14] via-transparent to-black/40"></div>
              </Link>
          </div>
        ))}
      </div>

      {/* BOTTOM HALF: The Title & Text */}
      <div className="relative w-full bg-gradient-to-b from-[#050a14] to-[#0a1428] p-5 md:p-8 z-20 min-h-[140px] md:min-h-[160px] flex flex-col justify-center">
        {headlines.map((item, index) => (
           <div 
              key={`text-${item.id}`}
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
      <style>{`@keyframes progress { 0% { transform: scaleX(0); } 100% { transform: scaleX(1); } }`}</style>
    </div>
  );
}