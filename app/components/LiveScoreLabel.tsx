'use client';
import { useState, useEffect, useRef } from 'react';

// 🟢 THE MASTER STATUS ARRAYS
const LIVE_STATUSES = ['LIVE', 'IN_PLAY', 'IN', '1H', '2H', 'HT', 'HALFTIME', 'ET', 'EXTRA TIME', 'P', 'PENALTIES'];
const FINISHED_STATUSES = ['FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD'];

export default function LiveScoreLabel({ 
    matchId, 
    initialStatus, 
    homeScore, 
    awayScore, 
    matchDate,
    variant = 'small', 
    homeTeam,
    awayTeam 
}: any) {
  const [data, setData] = useState({ 
      status: initialStatus, 
      home: homeScore, 
      away: awayScore, 
      clock: '' 
  });
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchLiveScore = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
          const res = await fetch(`/api/match-data?id=${matchId}`);
          if (!res.ok) return;
          const matchData = await res.json();

          if (matchData && !matchData.error) {
            setData({ 
                status: matchData.status, 
                home: matchData.home_score, 
                away: matchData.away_score,
                clock: matchData.displayClock
            });

            const currentStatus = (matchData.status || '').toUpperCase();
            if (FINISHED_STATUSES.includes(currentStatus)) {
                if (intervalRef.current) clearInterval(intervalRef.current);
            }
          }
      } catch (error) {
          console.error("Failed to fetch score");
      }
    };

    const currentDataStatus = (data.status || '').toUpperCase();
    if (!FINISHED_STATUSES.includes(currentDataStatus)) {
        intervalRef.current = setInterval(fetchLiveScore, 5000);
    }

    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') fetchLiveScore();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [matchId, data.status]);

  const userTime = new Date(matchDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  const cleanStatus = (data.status || '').toUpperCase();

  if (variant === 'badge') {
      if (LIVE_STATUSES.includes(cleanStatus)) {
          return <span className="bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded animate-pulse shadow-sm tracking-widest border border-red-500">LIVE</span>;
      }
      
      if (FINISHED_STATUSES.includes(cleanStatus)) {
          return <span className="bg-slate-200 text-slate-600 text-[9px] font-black px-2 py-0.5 rounded tracking-widest shadow-inner border border-slate-300">FT</span>;
      }
      
      return <span className="bg-slate-100 text-slate-500 text-[9px] font-bold px-2 py-0.5 rounded shadow-inner uppercase tracking-widest border border-slate-200">UPCOMING</span>;
  }

  if (variant === 'large') {
      return (
          <div className="flex justify-between items-center mb-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="text-center w-1/3">
                  <div className="text-3xl font-black text-slate-800 tracking-tighter">{data.home ?? 0}</div>
                  <div className="text-[10px] font-black uppercase text-slate-500 line-clamp-1 mt-1">{homeTeam}</div>
              </div>
              <div className="text-slate-300 font-black text-lg italic">VS</div>
              <div className="text-center w-1/3">
                  <div className="text-3xl font-black text-slate-800 tracking-tighter">{data.away ?? 0}</div>
                  <div className="text-[10px] font-black uppercase text-slate-500 line-clamp-1 mt-1">{awayTeam}</div>
              </div>
          </div>
      );
  }

  if (LIVE_STATUSES.includes(cleanStatus)) {
    return (
        <div className="flex flex-col items-center justify-center">
            <span className={`font-black text-xs px-1.5 py-0.5 rounded flex items-center gap-1 ${cleanStatus === 'HT' || cleanStatus === 'HALFTIME' ? 'text-amber-600 bg-amber-50 border border-amber-200' : 'text-red-600 bg-red-50 border border-red-100 animate-pulse'}`}>
                {cleanStatus === 'HT' || cleanStatus === 'HALFTIME' ? <span className="text-[8px] mr-1">HT</span> : null} 
                {data.home} - {data.away}
            </span>
            {data.clock && <span className="text-[9px] text-red-500 font-bold mt-1">{data.clock}</span>}
        </div>
    );
  }
  
  if (FINISHED_STATUSES.includes(cleanStatus)) {
     return <span className="text-slate-700 font-black text-[11px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded shadow-sm">{data.home} - {data.away}</span>;
  }
  
  return <span className="text-slate-500 text-[10px] font-bold bg-white border border-slate-100 px-2 py-0.5 rounded shadow-sm">{userTime}</span>;
}