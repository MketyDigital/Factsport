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
    <div className="relative z-10 px-4 mt-1">
        {/* Status */}
        <div className="flex justify-center mb-2">
            {isLive ? (
                <span className="bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1 shadow-lg">
                    <span className="w-1 h-1 bg-white rounded-full"></span> LIVE {displayMin}'
                </span>
            ) : (
                <span className="bg-white/10 text-slate-300 text-[9px] font-bold px-2 py-0.5 rounded-full border border-white/10">
                    {data.status === 'HT' ? 'HT' : (['FT','post','FINISHED'].includes(data.status) ? 'FT' : new Date(data.match_date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}))}
                </span>
            )}
        </div>

        {/* Scoreboard */}
        <div className="flex justify-between items-center mb-1">
            <div className="flex flex-col items-center w-1/3">
                <div className="w-12 h-12 bg-white p-2 rounded-xl shadow-xl mb-1 flex items-center justify-center">
                    {initialData.home_logo ? <img src={initialData.home_logo} className="w-full h-full object-contain" /> : <div className="font-black text-slate-300">H</div>}
                </div>
                <h2 className="font-bold text-center text-[9px] leading-tight opacity-90 truncate w-full">{initialData.home_team}</h2>
            </div>
            
            <div className="flex flex-col items-center w-1/3">
                <div className="text-4xl font-black tracking-tighter flex items-center gap-3 drop-shadow-2xl text-white">
                    <span>{data.home_score}</span><span className="text-slate-500 text-xl">:</span><span>{data.away_score}</span>
                </div>
            </div>

            <div className="flex flex-col items-center w-1/3">
                <div className="w-12 h-12 bg-white p-2 rounded-xl shadow-xl mb-1 flex items-center justify-center">
                    {initialData.away_logo ? <img src={initialData.away_logo} className="w-full h-full object-contain" /> : <div className="font-black text-slate-300">A</div>}
                </div>
                <h2 className="font-bold text-center text-[9px] leading-tight opacity-90 truncate w-full">{initialData.away_team}</h2>
            </div>
        </div>

        {/* 🟢 SCORERS (Fixed: Tiny, Compact, Centered) */}
        {goals.length > 0 && (
            <div className="flex flex-col items-center space-y-0.5 mt-1 w-full max-w-[200px] mx-auto">
                {goals.map((g: any, i: number) => (
                    <div key={i} className="flex items-center justify-center gap-1.5 w-full">
                        <span className={`text-[9px] font-bold text-right truncate w-1/2 ${g.team === 'home' ? 'text-white' : 'text-slate-500'}`}>
                            {g.team === 'home' ? g.player : ''}
                        </span>
                        <span className="text-[8px] font-mono text-green-400 bg-white/5 px-1 rounded">{g.time || '⚽'}</span>
                        <span className={`text-[9px] font-bold text-left truncate w-1/2 ${g.team === 'away' ? 'text-white' : 'text-slate-500'}`}>
                            {g.team === 'away' ? g.player : ''}
                        </span>
                    </div>
                ))}
            </div>
        )}
    </div>
  );
}