'use client';
import { useState, useEffect, useRef } from 'react';

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

            if (['FT', 'FINISHED', 'AET', 'PEN', 'ABD'].includes(matchData.status)) {
                if (intervalRef.current) clearInterval(intervalRef.current);
            }
          }
      } catch (error) {
          console.error("Failed to fetch score");
      }
    };

    if (!['FT', 'FINISHED', 'AET', 'PEN', 'ABD'].includes(data.status)) {
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

  if (variant === 'badge') {
      const isLive = ['LIVE', 'IN_PLAY', '1H', '2H', 'HT'].includes(data.status);
      if (isLive) {
          return <span className="bg-red-600 text-white text-[9px] font-black px-2 py-1 rounded animate-pulse shadow-sm">LIVE</span>;
      }
      return <span className="bg-slate-200 text-slate-500 text-[9px] font-bold px-2 py-1 rounded shadow-inner">UPCOMING</span>;
  }

  if (variant === 'large') {
      return (
          <div className="flex justify-between items-center mb-4">
              <div className="text-center w-1/3">
                  <div className="text-2xl font-black">{data.home ?? 0}</div>
                  <div className="text-xs font-bold text-slate-600 line-clamp-1">{homeTeam}</div>
              </div>
              <div className="text-slate-200 font-black text-lg">VS</div>
              <div className="text-center w-1/3">
                  <div className="text-2xl font-black">{data.away ?? 0}</div>
                  <div className="text-xs font-bold text-slate-600 line-clamp-1">{awayTeam}</div>
              </div>
          </div>
      );
  }

  if (['LIVE', 'IN_PLAY', 'HT'].includes(data.status)) {
    return (
        <div className="flex flex-col items-center">
            <span className={`font-bold text-[10px] ${data.status === 'HT' ? 'text-yellow-600 bg-yellow-50 px-1 rounded' : 'text-red-600 animate-pulse'}`}>
                {data.status === 'HT' ? 'HT' : ''} {data.home} - {data.away}
            </span>
            {data.clock && <span className="text-[8px] text-red-400 font-mono leading-none mt-0.5">{data.clock}</span>}
        </div>
    );
  }
  
  if (['FT', 'FINISHED', 'ABD'].includes(data.status)) {
     return <span className="text-slate-900 font-bold text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">{data.home} - {data.away}</span>;
  }
  
  return <span className="text-slate-400 text-[9px] font-mono">{userTime}</span>;
}