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
    const isLive = ['LIVE', 'in'].includes(data.status) || 
                   (now >= matchTime && !['FT', 'post', 'FINISHED'].includes(data.status));

    if (!isLive) return;

    const fetchScore = async () => {
      try {
        const res = await fetch(`/api/match/${matchId}`);
        if (res.ok) {
          const json = await res.json();
          setData({
            status: json.status,
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
  }, []);

  // 1. UI for LIVE Matches
  if (['LIVE', 'in'].includes(data.status)) {
    return (
      <div className="flex flex-col items-center">
        <span className="text-red-600 font-bold text-[10px] animate-pulse whitespace-nowrap">
           LIVE {data.clock ? `• ${data.clock}'` : ''}
        </span>
        <div className="text-lg font-black tracking-tighter leading-none">
          {data.home} - {data.away}
        </div>
      </div>
    );
  }

  // 2. UI for FINISHED Matches
  if (['FT', 'post', 'FINISHED'].includes(data.status)) {
    return (
      <div className="flex flex-col items-center">
        <div className="text-lg font-black tracking-tighter text-slate-800 leading-none">
          {data.home} - {data.away}
        </div>
        <span className="text-slate-400 font-bold text-[10px]">FT</span>
      </div>
    );
  }

  // 3. UI for UPCOMING Matches (Restored Date & Time)
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