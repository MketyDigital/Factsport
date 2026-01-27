'use client';

import { useState, useEffect } from 'react';

export default function LiveScoreLabel({ matchId, initialStatus, homeScore, awayScore, matchDate }: any) {
  const [data, setData] = useState({ 
    status: initialStatus, 
    home: homeScore, 
    away: awayScore,
    clock: '' 
  });

  useEffect(() => {
    const now = new Date();
    const matchTime = new Date(matchDate);
    
    // Logic: Only poll the API if match is currently Live or about to start
    const isLive = ['LIVE', 'in', '1H', '2H', 'HT'].includes(data.status) || 
                   (now >= matchTime && !['FT', 'post', 'FINISHED'].includes(data.status));

    if (!isLive) return;

    const fetchScore = async () => {
      try {
        const res = await fetch(`/api/match/${matchId}`);
        if (res.ok) {
          const json = await res.json();
          setData({
            status: json.status, // This needs to return "HT" from your bot for the HT logic to work
            home: json.home.score,
            away: json.away.score,
            clock: json.displayClock
          });
        }
      } catch (e) {}
    };

    fetchScore();
    const interval = setInterval(fetchScore, 60000); // Check every 60 seconds
    return () => clearInterval(interval);
  }, []); // Empty dependency array to run once on mount

  // 1. ✅ NEW: UI for HALF TIME
  // Checks for various HT strings to be safe
  if (['HT', 'HALF TIME', 'BREAK', 'Half Time'].includes(data.status)) {
    return (
      <div className="flex flex-col items-center">
        <div className="text-lg font-black tracking-tighter leading-none text-slate-900">
          {data.home} - {data.away}
        </div>
        <span className="text-[10px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded mt-1 animate-pulse">
          Half Time
        </span>
      </div>
    );
  }

  // 2. ✅ UPDATED: UI for LIVE Matches (With Pulsing Dot)
  if (['LIVE', 'in', '1H', '2H'].includes(data.status)) {
    return (
      <div className="flex flex-col items-center">
        {/* Pulsing Dot & Time */}
        <div className="flex items-center gap-1.5 mb-0.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
            </span>
            <span className="text-red-600 font-bold text-[10px] animate-pulse whitespace-nowrap">
               {data.clock ? `${data.clock}'` : 'LIVE'}
            </span>
        </div>
        
        {/* Score */}
        <div className="text-lg font-black tracking-tighter leading-none text-red-600">
          {data.home} - {data.away}
        </div>
      </div>
    );
  }

  // 3. UI for FINISHED Matches (Your existing logic)
  if (['FT', 'post', 'FINISHED', 'FULL TIME'].includes(data.status)) {
    return (
      <div className="flex flex-col items-center">
        <div className="text-lg font-black tracking-tighter text-slate-800 leading-none">
          {data.home} - {data.away}
        </div>
        <span className="text-slate-400 font-bold text-[10px]">FT</span>
      </div>
    );
  }

  // 4. UI for UPCOMING Matches (Your existing custom design)
  return (
    <div className="flex flex-col items-center min-w-[70px]">
      <span className="text-[8px] font-black text-slate-400 uppercase tracking-tight mb-1">
        {new Date(matchDate).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
      </span>
      <div className="bg-slate-100 px-3 py-1 rounded-lg text-[10px] font-black text-slate-600 whitespace-nowrap border border-slate-200/50">
        {new Date(matchDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
      </div>
    </div>
  );
}