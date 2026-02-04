'use client';

import { useEffect, useState } from 'react';

export default function LeagueNavigator({ leagues }: { leagues: string[] }) {
  const [activeLeague, setActiveLeague] = useState(leagues[0]);

  const scrollToLeague = (league: string) => {
    setActiveLeague(league);
    const element = document.getElementById(league.replace(/\s+/g, '-'));
    if (element) {
      // Offset for the sticky header (approx 120px)
      const headerOffset = 120;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
  
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
  };

  if (leagues.length === 0) return null;

  return (
    <div className="sticky top-[60px] z-40 bg-[#F0F2F5]/95 backdrop-blur-sm border-b border-slate-200 py-2 overflow-x-auto scrollbar-hide">
      <div className="flex px-4 space-x-2 min-w-max">
        {leagues.map((league) => (
          <button
            key={league}
            onClick={() => scrollToLeague(league)}
            className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all shadow-sm ${
              activeLeague === league 
                ? 'bg-blue-600 text-white shadow-blue-200' 
                : 'bg-white text-slate-500 border border-slate-200 hover:border-blue-300'
            }`}
          >
            {league}
          </button>
        ))}
      </div>
    </div>
  );
}