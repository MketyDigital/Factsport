'use client';
import { useEffect, useRef } from 'react';

interface Props { matchId: string; }

export default function ScoreAxisWidget({ matchId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Your fixed style ID (Blue theme, No Links)
  const STYLE_ID = "zdnyml5r3bw6"; 

  useEffect(() => {
    if (!containerRef.current || !matchId) return;
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    // Force specific parameters to ensure it stays clean
    script.src = `https://widgets.scoreaxis.com/api/football/live-match/${matchId}?widgetId=${STYLE_ID}&links=0&logo=0&lineupsBlock=1&eventsBlock=1&statsBlock=1&font=heebo`;
    script.async = true;
    containerRef.current.appendChild(script);
  }, [matchId]);

  return (
    <div className="w-full relative bg-white rounded-xl overflow-hidden shadow-lg mb-6 border border-slate-100">
       {/* Widget Container */}
       <div ref={containerRef} className="min-h-[500px] bg-white"></div>

       {/* 🛡️ THE SHIELD: Invisible layer covering the bottom logo to prevent clicks */}
       <div className="absolute bottom-0 left-0 w-full h-[40px] z-50 bg-transparent cursor-default" />
    </div>
  );
}