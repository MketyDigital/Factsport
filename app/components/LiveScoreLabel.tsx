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

    // 1. Define the function that grabs the score instantly
    const fetchLiveScore = async () => {
      const { data: matchData } = await supabase
        .from('matches')
        .select('status, home_score, away_score, displayClock')
        .eq('id', matchId)
        .single();

      if (matchData) {
        setData({ 
            status: matchData.status, 
            home: matchData.home_score, 
            away: matchData.away_score,
            clock: matchData.displayClock
        });
      }
    };

    // 2. Set up the silent polling timer (every 15 seconds)
    // 15 seconds is fast enough for sports, but slow enough to cost $0 at scale
    const interval = setInterval(fetchLiveScore, 15000);

    // 3. Clean up the timer if the user leaves the page
    return () => clearInterval(interval);
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