'use client';
import { useEffect, useRef } from 'react';

interface Props { matchId: string; }

export default function ScoreAxisWidget({ matchId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 🟢 SET THIS ONCE. It defines the look (White background, standard fonts).
  // You never need to change this line again.
  const STYLE_ID = "8ocgml6m4s1j"; 

  useEffect(() => {
    if (!containerRef.current || !matchId) return;
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    // We combine YOUR Style ID (fixed) with the specific Match ID (dynamic)
    script.src = `https://widgets.scoreaxis.com/api/football/live-match/${matchId}?widgetId=${STYLE_ID}&links=0&logo=0&lineupsBlock=1&eventsBlock=1&statsBlock=1&font=heebo`;
    script.async = true;
    containerRef.current.appendChild(script);
  }, [matchId]); // <--- This ensures it updates when you change the match in Admin

  return (
    <div className="w-full relative bg-white rounded-xl overflow-hidden shadow-lg mb-6 border border-slate-100">
       <div ref={containerRef} className="min-h-[500px] bg-white"></div>
       {/* The "Shield" to block bottom branding clicks */}
       <div className="absolute bottom-0 left-0 w-full h-[40px] z-50 bg-transparent cursor-default" />
    </div>
  );
}