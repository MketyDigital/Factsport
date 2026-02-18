'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';

export default function LiveScoreLabel({ matchId, initialStatus, homeScore, awayScore, matchDate }: any) {
  const [data, setData] = useState({ 
      status: initialStatus, 
      home: homeScore, 
      away: awayScore, 
      clock: '' 
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`label-${matchId}`)
      .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'matches', 
          filter: `id=eq.${matchId}` 
      }, (payload) => {
          setData({ 
              status: payload.new.status, 
              home: payload.new.home_score, 
              away: payload.new.away_score,
              clock: payload.new.displayClock
          });
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [matchId]);

  const userTime = new Date(matchDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

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