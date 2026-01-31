'use client';

import { createClient } from '@/app/lib/supabase/client';
import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react'; // Icon for goals

export default function MatchHeaderClient({ matchId, initialData, initialGoals = [] }: any) {
  const [data, setData] = useState(initialData);
  const [goals, setGoals] = useState(initialGoals); // 🟢 State for Goals
  const [minute, setMinute] = useState(0);

  useEffect(() => {
    const supabase = createClient();

    // 1. Calculate Initial Minute
    const calculateMinute = () => {
        const start = new Date(data.match_date).getTime();
        const now = new Date().getTime();
        const diffMins = Math.floor((now - start) / 60000);
        return diffMins > 0 ? diffMins : 0;
    };
    setMinute(calculateMinute());

    // 2. Realtime Subscription
    const channel = supabase.channel(`match-header-${matchId}`)
      .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'matches', 
          filter: `id=eq.${matchId}` 
      }, async (payload) => {
          // A. Update Score Immediately (Fast Visual)
          setData((prev: any) => ({
              ...prev,
              status: payload.new.status,
              home_score: payload.new.home_score,
              away_score: payload.new.away_score,
          }));

          // B. Fetch New Goal Data (If score changed)
          // We fetch the full row to get the updated 'goals' JSON/Array from your DB
          const { data: fresh } = await supabase.from('matches').select('*').eq('id', matchId).single();
          if (fresh && fresh.goals) {
              // Note: Ensure your DB stores goals in a 'goals' column or parse them here
              // If your 'getExternalData' logic was complex, you might need an API route here.
              // For now, we assume 'fresh.goals' holds the JSON structure.
              setGoals(fresh.goals || []); 
          }
      })
      .subscribe();

    // 3. Timer & Backup Polling (30s)
    const interval = setInterval(async () => {
        if (['LIVE', '1H', '2H', 'in'].includes(data.status)) {
            setMinute(prev => prev + 1);
        }
        
        // Backup Fetch
        const isLive = ['LIVE', '1H', '2H', 'in', 'HT'].includes(data.status);
        if (isLive) {
             const { data: fresh } = await supabase.from('matches').select('*').eq('id', matchId).single();
             if (fresh) {
                 setData((prev:any) => ({ ...prev, ...fresh }));
                 if (fresh.goals) setGoals(fresh.goals);
             }
        }
    }, 30000);

    return () => {
        supabase.removeChannel(channel);
        clearInterval(interval);
    };
  }, [matchId, data.status]);

  // LOGIC FOR DISPLAY
  const isHalfTime = ['HT', 'HALF TIME', 'BREAK', 'Half Time'].includes(data.status);
  const isLive = ['LIVE', '1H', '2H', 'in', 'ET'].includes(data.status) && !isHalfTime;
  const displayMin = (data.status === '2H' && minute < 45) ? 45 + minute : minute;

  // Filter Scorers
  const homeGoals = goals.filter((g: any) => g.team === 'home');
  const awayGoals = goals.filter((g: any) => g.team === 'away');

  return (
    <div className="relative z-10 px-4 mt-2">
        {/* STATUS BADGE */}
        <div className="flex justify-center mb-4">
        {isHalfTime ? (
            <span className="bg-slate-200 text-slate-900 text-[10px] font-black px-4 py-1.5 rounded-full flex items-center gap-1 shadow-lg animate-pulse border border-white/20">
                HALF TIME
            </span>
        ) : isLive ? (
            <span className="bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-full animate-pulse flex items-center gap-1 shadow-lg">
                <span className="w-1.5 h-1.5 bg-white rounded-full"></span> LIVE {displayMin}'
            </span>
        ) : (
            <span className="bg-white/10 text-slate-300 text-[10px] font-bold px-3 py-1 rounded-full border border-white/10 backdrop-blur-md">
                {['FT', 'post', 'FINISHED'].includes(data.status) ? 'Full Time' : new Date(data.match_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </span>
        )}
        </div>

        <div className="flex justify-between items-start">
            
            {/* HOME TEAM */}
            <div className="flex flex-col items-center w-[30%]">
                <div className="w-14 h-14 bg-white p-2.5 rounded-2xl shadow-xl mb-2 flex items-center justify-center">
                    {initialData.home_logo ? <img src={initialData.home_logo} className="w-full h-full object-contain" /> : <div className="font-black text-slate-300 text-xl">{initialData.home_team.substring(0,1)}</div>}
                </div>
                <h2 className="font-bold text-center text-[10px] leading-tight opacity-90 mb-2">{initialData.home_team}</h2>
                
                {/* 🟢 HOME SCORERS */}
                <div className="space-y-1 w-full">
                    {homeGoals.map((g: any, i: number) => (
                        <div key={i} className="text-[9px] text-slate-300 text-center leading-tight">
                            <span className="font-bold text-white">{g.player}</span> <span className="text-green-400">{g.time}'</span>
                            {g.assist && <span className="block text-[8px] text-slate-500">asst. {g.assist}</span>}
                        </div>
                    ))}
                </div>
            </div>

            {/* SCORE DISPLAY */}
            <div className="flex flex-col items-center w-[40%] pt-2">
                <div className={`text-5xl font-black tracking-tighter flex items-center gap-3 drop-shadow-2xl ${isLive ? 'text-red-500 scale-110 transition-transform' : 'text-white'}`}>
                    <span>{data.home_score}</span><span className="text-slate-600 text-2xl">:</span><span>{data.away_score}</span>
                </div>
                {goals.length > 0 && <Activity size={12} className="text-slate-500 mt-2 opacity-50" />}
            </div>

            {/* AWAY TEAM */}
            <div className="flex flex-col items-center w-[30%]">
                <div className="w-14 h-14 bg-white p-2.5 rounded-2xl shadow-xl mb-2 flex items-center justify-center">
                    {initialData.away_logo ? <img src={initialData.away_logo} className="w-full h-full object-contain" /> : <div className="font-black text-slate-300 text-xl">{initialData.away_team.substring(0,1)}</div>}
                </div>
                <h2 className="font-bold text-center text-[10px] leading-tight opacity-90 mb-2">{initialData.away_team}</h2>

                {/* 🟢 AWAY SCORERS */}
                <div className="space-y-1 w-full">
                    {awayGoals.map((g: any, i: number) => (
                        <div key={i} className="text-[9px] text-slate-300 text-center leading-tight">
                            <span className="text-green-400">{g.time}'</span> <span className="font-bold text-white">{g.player}</span>
                            {g.assist && <span className="block text-[8px] text-slate-500">asst. {g.assist}</span>}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
  );
}