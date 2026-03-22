'use client';
import { useState, useEffect, useRef } from 'react';

const HT_STATUSES = ['HT', 'HALFTIME', 'HALF TIME', 'HALF-TIME'];
const LIVE_STATUSES = ['LIVE', 'IN_PLAY', 'IN', '1H', '2H', 'ET', 'EXTRA TIME', 'P', 'PENALTIES', ...HT_STATUSES];
const FINISHED_STATUSES = ['FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD'];

export default function LiveScoreLabel({ 
    matchId, espnId, initialStatus, homeScore, awayScore, matchDate, variant = 'small', homeTeam, awayTeam 
}: any) {
  const [data, setData] = useState({ status: initialStatus, home: homeScore, away: awayScore, clock: '' });
  
  const hasFetchedLive = useRef(false);
  const isFetching = useRef(false);

  useEffect(() => {
      if (!hasFetchedLive.current) {
          setData(prev => ({ ...prev, status: initialStatus, home: homeScore, away: awayScore }));
      }
  }, [initialStatus, homeScore, awayScore]);

  // 🟢 RECURSIVE POLLING + WORKER ONLY
  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const currentDataStatus = (initialStatus || '').toUpperCase();
    if (FINISHED_STATUSES.includes(currentDataStatus) || !espnId) return;

    const fetchLiveScore = async () => {
      if (isFetching.current || !isMounted || document.visibilityState !== 'visible') return;
      isFetching.current = true;

      try {
          const res = await fetch(`https://fse.mkpoikankes.workers.dev/?espn_id=${espnId}&t=${Date.now()}`);
          if (res.ok) {
              const matchData = await res.json();
              if (matchData && !matchData.error && isMounted) {
                  hasFetchedLive.current = true; 
                  setData({ 
                      status: matchData.status, 
                      home: matchData.home_score, 
                      away: matchData.away_score,
                      clock: matchData.displayClock
                  });

                  if (FINISHED_STATUSES.includes((matchData.status || '').toUpperCase())) {
                      isFetching.current = false;
                      return; // Stop polling
                  }
              }
          }
      } catch (error) {}
      finally {
          isFetching.current = false;
      }

      if (isMounted) {
          timeoutId = setTimeout(fetchLiveScore, 5000); 
      }
    };

    fetchLiveScore();

    return () => {
        isMounted = false;
        clearTimeout(timeoutId);
    };
  }, [espnId, initialStatus]); 

  const userTime = new Date(matchDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  const cleanStatus = (data.status || '').toUpperCase();
  const isHT = HT_STATUSES.includes(cleanStatus);
  const isLive = LIVE_STATUSES.includes(cleanStatus);
  const isFinished = FINISHED_STATUSES.includes(cleanStatus);

  if (variant === 'badge') {
      if (isHT) return <span className="bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded shadow-sm tracking-widest border border-amber-600">HT</span>;
      if (isLive) return <span className="bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded animate-pulse shadow-sm tracking-widest border border-red-500">{data.clock || 'LIVE'}</span>;
      if (isFinished) return <span className="bg-slate-200 text-slate-600 text-[9px] font-black px-2 py-0.5 rounded tracking-widest shadow-inner border border-slate-300">FT</span>;
      return <span className="bg-slate-100 text-slate-500 text-[9px] font-bold px-2 py-0.5 rounded shadow-inner uppercase tracking-widest border border-slate-200">UPCOMING</span>;
  }

  if (variant === 'large') {
      return (
          <div className="flex justify-between items-center mb-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="text-center w-1/3">
                  <div className="text-3xl font-black text-slate-800 tracking-tighter">{data.home ?? 0}</div>
                  <div className="text-[10px] font-black uppercase text-slate-500 line-clamp-1 mt-1">{homeTeam}</div>
              </div>
              <div className="flex flex-col items-center justify-center">
                  <div className="text-slate-300 font-black text-lg italic mb-1">VS</div>
                  {isHT && <span className="bg-amber-100 text-amber-700 text-[9px] px-2 py-0.5 rounded font-black border border-amber-200">HT</span>}
                  {isLive && !isHT && data.clock && <span className="text-red-500 text-[10px] font-black animate-pulse bg-red-50 px-2 py-0.5 rounded">{data.clock}</span>}
              </div>
              <div className="text-center w-1/3">
                  <div className="text-3xl font-black text-slate-800 tracking-tighter">{data.away ?? 0}</div>
                  <div className="text-[10px] font-black uppercase text-slate-500 line-clamp-1 mt-1">{awayTeam}</div>
              </div>
          </div>
      );
  }

  if (isLive) {
    return (
        <div className="flex flex-col items-center justify-center">
            <span className={`font-black text-xs px-1.5 py-0.5 rounded flex items-center gap-1 ${isHT ? 'text-amber-600 bg-amber-50 border border-amber-200' : 'text-red-600 bg-red-50 border border-red-100 animate-pulse'}`}>
                {isHT ? <span className="text-[8px] mr-1">HT</span> : null} 
                {data.home} - {data.away}
            </span>
            {data.clock && !isHT && <span className="text-[9px] text-red-500 font-bold mt-1">{data.clock}</span>}
        </div>
    );
  }
  
  if (isFinished) return <span className="text-slate-700 font-black text-[11px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded shadow-sm">{data.home} - {data.away}</span>;
  return <span className="text-slate-500 text-[10px] font-bold bg-white border border-slate-100 px-2 py-0.5 rounded shadow-sm">{userTime}</span>;
}