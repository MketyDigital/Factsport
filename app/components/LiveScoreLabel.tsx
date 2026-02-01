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
    const fetchScore = async () => {
      const now = new Date();
      const matchTime = new Date(matchDate);
      
      // ✅ LOGIC: Keep polling during Halftime (HT) so we know when 2nd Half starts
      const shouldPoll = 
         ['LIVE', 'in', '1H', '2H', 'HT', 'Halftime'].includes(data.status) || 
         (now >= new Date(matchTime.getTime() - 10 * 60000) && !['FT', 'post', 'FINISHED'].includes(data.status));

      if (!shouldPoll) return;

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

    const interval = setInterval(fetchScore, 60000);
    return () => clearInterval(interval);
  }, [matchId, matchDate, data.status]);

  // 1. UI for HALF TIME (Now triggered correctly!)
  if (['HT', 'HALF TIME', 'BREAK', 'Half Time', 'STATUS_HALFTIME'].includes(data.status)) {
    return (
      <div className="flex flex-col items-center">
        <div className="text-lg font-black tracking-tighter leading-none text-slate-900">
          {data.home} - {data.away}
        </div>
        <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded mt-1 animate-pulse border border-yellow-200">
          HT
        </span>
      </div>
    );
  }

  // 2. UI for LIVE Matches
  if (['LIVE', 'in', '1H', '2H', 'ET'].includes(data.status)) {
    return (
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-1.5 mb-0.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
            </span>
            <span className="text-red-600 font-bold text-[10px] animate-pulse whitespace-nowrap">
               {data.clock ? `${data.clock}'` : 'LIVE'}
            </span>
        </div>
        
        <div className="text-lg font-black tracking-tighter leading-none text-red-600">
          {data.home} - {data.away}
        </div>
      </div>
    );
  }

  // 3. UI for FINISHED Matches
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

  // 4. UI for UPCOMING Matches
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