'use client';

import { useState, useEffect } from 'react';
import Link from "next/link";
import NewsArtwork from '@/app/components/NewsArtwork';

export default function HeadlinesSlider({ headlines }: { headlines: any[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-Slide Logic
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % headlines.length);
    }, 5000); // Change every 5 seconds

    return () => clearInterval(timer);
  }, [headlines.length]);

  if (headlines.length === 0) return null;

  return (
    <div className="relative w-full h-48 md:h-64 rounded-2xl overflow-hidden shadow-lg border border-white/20">
      {headlines.map((item, index) => (
        <div 
            key={item.id}
            className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out ${index === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
        >
            <Link href={`/news/${item.slug || '#'}`} className="block w-full h-full relative">
                <NewsArtwork 
                    image={item.image_url} 
                    team1Logo={item.team_1_logo} 
                    team2Logo={item.team_2_logo}
                    title={item.title}
                    className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent"></div>
                <div className="absolute bottom-0 left-0 p-4 w-full">
                    <span className="bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase mb-1.5 inline-block shadow-sm animate-pulse">
                        Top Story {index + 1}/{headlines.length}
                    </span>
                    <h3 className="text-white font-bold text-lg md:text-xl leading-tight line-clamp-2 drop-shadow-md">
                        {item.title}
                    </h3>
                </div>
            </Link>
        </div>
      ))}
      
      {/* Dots Indicator */}
      <div className="absolute bottom-2 right-4 z-20 flex gap-1">
          {headlines.map((_, idx) => (
              <div key={idx} className={`w-1.5 h-1.5 rounded-full transition-all ${idx === currentIndex ? 'bg-white w-4' : 'bg-white/50'}`}></div>
          ))}
      </div>
    </div>
  );
}