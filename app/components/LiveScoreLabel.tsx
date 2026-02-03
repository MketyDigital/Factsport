'use client';
import { useState, useEffect } from 'react';

export default function LiveScoreLabel({ matchId, initialStatus, homeScore, awayScore, matchDate }: any) {
  const [data, setData] = useState({ status: initialStatus, home: homeScore, away: awayScore });

  useEffect(() => {
    // Only poll if the match is active
    if (['LIVE', 'IN_PLAY', 'HT', 'PAUSED'].includes(data.status)) {
       const interval = setInterval(async () => {
          try {
             // Polling your internal API which serves the synced data
             const res = await fetch(`/api/matches/${matchId}`); 
             if(res.ok) {
                 const json = await res.json();
                 setData({ status: json.status, home: json.home_score, away: json.away_score });
             }
          } catch(e){}
       }, 60000);
       return () => clearInterval(interval);
    }
  }, [data.status, matchId]);

  if (['LIVE', 'IN_PLAY'].includes(data.status)) {
    return <span className="text-red-600 font-bold text-[10px] animate-pulse">{data.home} - {data.away}</span>;
  }
  if (data.status === 'HT') {
     return <span className="text-yellow-600 font-bold text-[10px] bg-yellow-50 px-1 rounded">HT {data.home}-{data.away}</span>;
  }
  if (['FT', 'FINISHED'].includes(data.status)) {
     return <span className="text-slate-900 font-bold text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">{data.home} - {data.away}</span>;
  }
  return <span className="text-slate-400 text-[9px] font-mono">{new Date(matchDate).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>;
}