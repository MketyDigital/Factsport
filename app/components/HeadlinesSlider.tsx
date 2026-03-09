'use client';

import { useState, useEffect } from 'react';
import Link from "next/link";
import NewsArtwork from '@/app/components/NewsArtwork';

export default function HeadlinesSlider({ headlines }: { headlines: any[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % headlines.length);
    }, 5000); 
    return () => clearInterval(timer);
  }, [headlines.length]);

  if (headlines.length === 0) return null;

  return (
    <div className="relative w-full h-56 md:h-72 rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black">
      {headlines.map((item, index) => (
        <div 
            key={item.id}
            className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out ${index === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
        >
            <Link href={`/news/${item.slug || '#'}`} className="block w-full h-full relative group">
                
                {/* Ken Burns Effect (Scale on active index) */}
                <div className={`absolute inset-0 w-full h-full transition-transform duration-[6000ms] ease-linear ${index === currentIndex ? 'scale-110' : 'scale-100'}`}>
                    <NewsArtwork 
                        image={item.image_url} 
                        team1Logo={item.team_1_logo} 
                        team2Logo={item.team_2_logo}
                        title={item.title}
                        className="w-full h-full object-cover"
                    />
                </div>

                {/* Dark Vignette Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent"></div>

                <div className="absolute bottom-0 left-0 p-5 w-full">
                    <span className="bg-blue-600 text-white text-[9px] font-black px-2.5 py-1 rounded uppercase tracking-widest mb-2 inline-block shadow-lg border border-blue-500">
                        Top Story
                    </span>
                    <h3 className="text-white font-black text-xl md:text-2xl leading-tight line-clamp-2 drop-shadow-xl max-w-lg">
                        {item.title}
                    </h3>
                </div>
            </Link>
        </div>
      ))}
      
      {/* Premium Animated Progress Bars */}
      <div className="absolute top-3 left-4 right-4 z-20 flex gap-1.5">
          {headlines.map((_, idx) => (
              <div key={idx} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
                  {idx === currentIndex && (
                      <div className="h-full bg-white animate-[progress_5s_linear] origin-left"></div>
                  )}
                  {idx < currentIndex && (
                      <div className="h-full bg-white"></div>
                  )}
              </div>
          ))}
      </div>
      <style>{`@keyframes progress { 0% { transform: scaleX(0); } 100% { transform: scaleX(1); } }`}</style>
    </div>
  );
}