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
    // Only update if LIVE or Scheduled for TODAY
    const now = new Date();
    const matchTime = new Date(matchDate);
    // Logic: Is it live? OR Is it future/past but the component is stale?
    // We only fetch if it's explicitly LIVE/IN or we want to catch the kick-off
    const isLive = data.status === 'LIVE' || data.status === 'in' || 
                   (now >= matchTime && data.status !== 'FT' && data.status !== 'post');

    if (!isLive) return;

    const fetchScore = async () => {
      try {
        const res = await fetch(`/api/match/${matchId}`);
        if (res.ok) {
          const json = await res.json();
          setData({
            status: json.status === 'in' ? 'LIVE' : json.status,
            home: json.home.score,
            away: json.away.score,
            clock: json.displayClock
          });
        }
      } catch (e) {}
    };

    fetchScore();
    const interval = setInterval(fetchScore, 60000);
    return () => clearInterval(interval);
  }, []);

  if (data.status === 'LIVE' || data.status === 'in') {
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

  if (data.status === 'FT' || data.status === 'post') {
    return (
      <div className="flex flex-col items-center">
        <div className="text-lg font-black tracking-tighter text-slate-800 leading-none">
          {data.home} - {data.away}
        </div>
        <span className="text-slate-400 font-bold text-[10px]">FT</span>
      </div>
    );
  }

  return (
    <div className="bg-slate-100 px-3 py-1 rounded text-xs font-bold text-slate-500 whitespace-nowrap">
      {new Date(matchDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
    </div>
  );
}