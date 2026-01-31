'use client';

import { createClient } from '@/app/lib/supabase/client';
import { useEffect, useState } from 'react';

export default function LiveScoreLabel({ matchId, initialStatus, homeScore, awayScore, matchDate }: any) {
  const [status, setStatus] = useState(initialStatus);
  const [hScore, setHScore] = useState(homeScore);
  const [aScore, setAScore] = useState(awayScore);
  const [minute, setMinute] = useState(0);

  useEffect(() => {
    const supabase = createClient();

    // 1. Calculate Initial Minute
    const calculateMinute = () => {
        const start = new Date(matchDate).getTime();
        const now = new Date().getTime();
        const diffMins = Math.floor((now - start) / 60000);
        return diffMins > 0 ? diffMins : 0;
    };
    setMinute(calculateMinute());

    // 2. PRIMARY: Realtime Subscription (Instant Updates)
    const channel = supabase.channel(`match-${matchId}`)
      .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'matches', 
          filter: `id=eq.${matchId}` 
      }, (payload) => {
          setStatus(payload.new.status);
          setHScore(payload.new.home_score);
          setAScore(payload.new.away_score);
      })
      .subscribe();

    // 3. SECONDARY: Polling Backup (Every 30 Seconds)
    // ✅ CHANGED: 60000 -> 30000
    const backupInterval = setInterval(async () => {
        const isGameActive = ['LIVE', '1H', '2H', 'in', 'HT'].includes(status);
        const isAboutToStart = new Date() >= new Date(matchDate);

        // Only fetch if game is active or starting (saves resources)
        if (isGameActive || isAboutToStart) {
            const { data } = await supabase
                .from('matches')
                .select('status, home_score, away_score')
                .eq('id', matchId)
                .single();
            
            if (data) {
                setStatus(data.status);
                setHScore(data.home_score);
                setAScore(data.away_score);
            }
        }

        // Local Timer Tick (Keep this visual update smooth)
        if (['LIVE', '1H', '2H', 'in'].includes(status)) {
            setMinute(prev => prev + 1);
        }
    }, 30000); // 👈 NOW RUNS EVERY 30 SECONDS

    return () => {
        supabase.removeChannel(channel);
        clearInterval(backupInterval);
    };
  }, [matchId, matchDate, status]);

  // --- UI RENDERING ---

  // 1. HALF TIME
  if (['HT', 'HALF TIME', 'BREAK', 'Half Time', 'Halftime'].includes(status)) {
      return (
        <div className="flex flex-col items-center min-w-[60px]">
            <div className="text-lg font-black tracking-tighter leading-none text-slate-900 mb-1">
                {hScore} - {aScore}
            </div>
            <span className="bg-slate-200 text-slate-700 text-[10px] font-black px-2 py-0.5 rounded animate-pulse whitespace-nowrap">
                HT
            </span>
        </div>
      );
  }

  // 2. LIVE MATCH
  if (['LIVE', '1H', '2H', 'in', 'ET'].includes(status)) {
      const displayMin = (status === '2H' && minute < 45) ? 45 + minute : minute;
      
      return (
        <div className="flex flex-col items-center min-w-[60px]">
            <div className="flex items-center gap-1.5 mb-0.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-600"></span>
                </span>
                <span className="text-red-600 font-bold text-[10px] animate-pulse whitespace-nowrap">
                    {displayMin}'
                </span>
            </div>
            <div className="text-lg font-black tracking-tighter leading-none text-red-600">
                {hScore} - {aScore}
            </div>
        </div>
      );
  }

  // 3. FINISHED
  if (['FT', 'post', 'FINISHED', 'FULL TIME'].includes(status)) {
      return (
        <div className="flex flex-col items-center min-w-[60px] opacity-70">
            <div className="text-lg font-black tracking-tighter text-slate-800 leading-none mb-1">
                {hScore} - {aScore}
            </div>
            <span className="text-slate-500 font-bold text-[10px]">FT</span>
        </div>
      );
  }

  // 4. UPCOMING
  return (
    <div className="flex flex-col items-center min-w-[60px]">
       <span className="text-[8px] font-black text-slate-400 uppercase tracking-tight mb-0.5">
         {new Date(matchDate).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
       </span>
       <div className="bg-slate-100 px-2 py-1 rounded text-[10px] font-black text-slate-500 border border-slate-200">
         {new Date(matchDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
       </div>
    </div>
  );
}