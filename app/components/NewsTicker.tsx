'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { Newspaper } from "lucide-react";

export default function NewsTicker({ tickerNews }: { tickerNews: any[] }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(false);

    useEffect(() => {
        if (!tickerNews || tickerNews.length <= 1) return;

        const interval = setInterval(() => {
            setIsTransitioning(true);
            
            // Wait for the slide-out animation to complete before changing content
            setTimeout(() => {
                setCurrentIndex((prevIndex) => (prevIndex + 1) % tickerNews.length);
                setIsTransitioning(false);
            }, 400); // Matches transition duration
        }, 5000); // Rotates every 5 seconds

        return () => clearInterval(interval);
    }, [tickerNews]);

    if (!tickerNews || tickerNews.length === 0) return null;

    const currentItem = tickerNews[currentIndex];

    return (
        <div className="bg-slate-950 text-white text-[11px] uppercase tracking-wider font-extrabold h-11 overflow-hidden relative flex items-center shadow-lg z-40 border-b border-slate-800 selection:bg-red-600 selection:text-white">
            <style>{`
                .slide-active {
                    transform: translateY(0);
                    opacity: 1;
                    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease;
                }
                .slide-hidden {
                    transform: translateY(-15px);
                    opacity: 0;
                    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease;
                }
            `}</style>
            
            {/* Left Static Brand Tag */}
            <div className="absolute left-0 h-full bg-red-600 px-4 flex items-center z-20 shadow-[6px_0_15px_rgba(0,0,0,0.4)] border-r border-red-700 whitespace-nowrap text-white font-black tracking-tighter">
                <Newspaper size={14} className="mr-2 text-white fill-white/10" /> 
                FACTSPORT
            </div>
            
            {/* Visual Fade Gradient for Smooth Entry */}
            <div className="absolute left-[110px] w-12 h-full bg-gradient-to-r from-slate-950 to-transparent z-10 pointer-events-none"></div>

            {/* Active Ticker Item Display */}
            <div className="w-full flex pl-[130px] pr-4 items-center h-full"> 
                <div className={`flex items-center w-full ${isTransitioning ? 'slide-hidden' : 'slide-active'}`}>
                    
                    {/* Fixed Thumbnail Element */}
                    {currentItem.image_url && (
                        <img 
                            src={currentItem.image_url} 
                            className="w-5 h-5 rounded-md object-cover mr-3 shadow-md border border-slate-700 flex-shrink-0 aspect-square" 
                            alt="News preview" 
                            onError={(e) => {
                                // Fallback hide if the image URL itself is broken/404
                                (e.target as HTMLElement).style.display = 'none';
                            }}
                        />
                    )}
                    
                    {/* News Content Link */}
                    <Link 
                        href={`/news/${currentItem.slug}`} 
                        className="hover:text-red-500 transition-colors duration-200 text-slate-100 flex items-center line-clamp-1 truncate"
                    >
                        {currentItem.is_breaking && (
                            <span className="bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded mr-2 font-black animate-pulse flex-shrink-0">
                                BREAKING
                            </span>
                        )} 
                        <span className="font-semibold tracking-wide text-slate-200 hover:underline">
                            {currentItem.title}
                        </span>
                    </Link>
                    
                </div>
            </div>
        </div>
    );
}