'use client';
import { createClient } from '@/app/lib/supabase/client';
import { useEffect, useState } from 'react';

export default function MatchHeaderClient({ matchId, initialData, initialGoals = [] }: any) {
  const [data, setData] = useState(initialData);
  const [goals, setGoals] = useState(initialGoals);
  const [minute, setMinute] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    const calculateMinute = () => {
        const start = new Date(data.match_date).getTime();
        const now = new Date().getTime();
        const diffMins = Math.floor((now - start) / 60000);
        return diffMins > 0 ? diffMins : 0;
    };
    setMinute(calculateMinute());

    const channel = supabase.channel(`match-header-${matchId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, async (payload) => {
          setData((prev:any) => ({ ...prev, status: payload.new.status, home_score: payload.new.home_score, away_score: payload.new.away_score }));
          const { data: fresh } = await supabase.from('matches').select('*').eq('id', matchId).single();
          if (fresh && fresh.match_events) setGoals(fresh.match_events); 
      }).subscribe();

    const interval = setInterval(async () => {
        if (['LIVE', '1H', '2H', 'in'].includes(data.status)) setMinute(prev => prev + 1);
    }, 30000);

    return () => { supabase.removeChannel(channel); clearInterval(interval); };
  }, [matchId, data.status]);

  const isLive = ['LIVE', '1H', '2H', 'in'].includes(data.status);
  const displayMin = (data.status === '2H' && minute < 45) ? 45 + minute : minute;

  return (
    <div className="relative z-10 px-4 mt-2">
        {/* Status */}
        <div className="flex justify-center mb-6">
            {isLive ? (
                <span className="bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-full animate-pulse flex items-center gap-1 shadow-lg">
                    <span className="w-1.5 h-1.5 bg-white rounded-full"></span> LIVE {displayMin}'
                </span>
            ) : (
                <span className="bg-white/10 text-slate-300 text-[10px] font-bold px-3 py-1 rounded-full border border-white/10">
                    {data.status === 'HT' ? 'HALF TIME' : (['FT','post','FINISHED'].includes(data.status) ? 'Full Time' : new Date(data.match_date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}))}
                </span>
            )}
        </div>

        {/* Scoreboard */}
        <div className="flex justify-between items-center mb-6">
            <div className="flex flex-col items-center w-1/3">
                <div className="w-16 h-16 bg-white p-3 rounded-2xl shadow-xl mb-3 flex items-center justify-center">
                    {initialData.home_logo ? <img src={initialData.home_logo} className="w-full h-full object-contain" /> : <div className="font-black text-slate-300 text-xl">H</div>}
                </div>
                <h2 className="font-bold text-center text-xs leading-tight opacity-90">{initialData.home_team}</h2>
            </div>
            <div className="flex flex-col items-center w-1/3">
                <div className="text-5xl font-black tracking-tighter flex items-center gap-4 text-white drop-shadow-lg">
                    <span>{data.home_score}</span><span className="text-slate-600 text-2xl">:</span><span>{data.away_score}</span>
                </div>
            </div>
            <div className="flex flex-col items-center w-1/3">
                <div className="w-16 h-16 bg-white p-3 rounded-2xl shadow-xl mb-3 flex items-center justify-center">
                    {initialData.away_logo ? <img src={initialData.away_logo} className="w-full h-full object-contain" /> : <div className="font-black text-slate-300 text-xl">A</div>}
                </div>
                <h2 className="font-bold text-center text-xs leading-tight opacity-90">{initialData.away_team}</h2>
            </div>
        </div>

        {/* 🟢 SCORERS (Centered in Middle) */}
        {goals.length > 0 && (
            <div className="flex flex-col items-center space-y-1.5 mb-4 border-t border-white/10 pt-4 w-full">
                {goals.map((g: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-[10px] text-slate-300 bg-white/5 px-3 py-1 rounded-full">
                        <span className="font-bold text-white">{g.player}</span>
                        <span className="text-green-400 font-mono">({g.time || '⚽'})</span>
                    </div>
                ))}
            </div>
        )}
    </div>
  );
}