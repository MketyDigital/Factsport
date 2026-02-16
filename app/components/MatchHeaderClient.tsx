'use client';
import { createClient } from '@/app/lib/supabase/client';
import { useEffect, useState } from 'react';
import ScoreAxisWidget from '@/app/components/ScoreAxisWidget'; 

export default function MatchHeaderClient({ matchId, initialData }: any) {
  const [data, setData] = useState(initialData);
  const hasPremiumWidget = !!initialData.widget_id; // 🟢 CHECK FOR WIDGET

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`match-header-${matchId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, (payload) => {
          setData((prev:any) => ({ 
             ...prev, 
             status: payload.new.status, 
             home_score: payload.new.home_score, 
             away_score: payload.new.away_score,
             widget_id: payload.new.widget_id,
             displayClock: payload.new.displayClock
          }));
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [matchId]);

  // 🅰️ SCENARIO A: PREMIUM WIDGET (Admin provided ID)
  if (hasPremiumWidget) {
      return <ScoreAxisWidget matchId={initialData.widget_id} />;
  }

  // 🅱️ SCENARIO B: STATIC HEADER (ESPN Data)
  const isLive = ['LIVE', 'HT', 'IN_PLAY'].includes(data.status);
  const isFinished = ['FT', 'FINISHED'].includes(data.status);

  return (
    <div className="relative z-10 px-4 mt-1 bg-[#0a1428] pb-6 pt-2 rounded-b-3xl">
        <div className="flex justify-center mb-5">
            {isLive ? (
                <div className="flex flex-col items-center">
                    <span className="bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-full animate-pulse flex items-center gap-1 shadow-lg shadow-red-900/20">
                        <span className="w-1.5 h-1.5 bg-white rounded-full"></span> 
                        {data.status === 'HT' ? 'HALF TIME' : 'LIVE'}
                    </span>
                    {data.displayClock && <span className="text-red-400 text-[10px] font-mono mt-1">{data.displayClock}</span>}
                </div>
            ) : (
                <span className={`text-[10px] font-bold px-3 py-1 rounded-full border ${isFinished ? 'bg-slate-700 text-slate-300 border-slate-600' : 'bg-white/10 text-slate-300 border-white/5'}`}>
                    {isFinished ? 'FULL TIME' : new Date(data.match_date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                </span>
            )}
        </div>

        <div className="flex justify-between items-start">
            <div className="flex flex-col items-center w-[35%]">
                <div className="w-16 h-16 bg-white/5 p-3 rounded-2xl mb-3 flex items-center justify-center border border-white/10 shadow-inner">
                    {initialData.home_logo ? <img src={initialData.home_logo} className="w-full h-full object-contain" /> : <div className="font-black text-slate-500">H</div>}
                </div>
                <h2 className="font-bold text-center text-xs text-white leading-tight w-full line-clamp-2">{initialData.home_team}</h2>
            </div>
            
            <div className="flex flex-col items-center justify-center w-[30%] pt-2">
                {data.status === 'SCHEDULED' || data.status === 'PRE' ? (
                     <div className="text-3xl font-black text-slate-600 opacity-50">VS</div>
                ) : (
                    <div className="text-5xl font-black tracking-tighter text-white flex gap-1 drop-shadow-2xl">
                        <span>{data.home_score}</span>
                        <span className="text-slate-600 opacity-50">:</span>
                        <span>{data.away_score}</span>
                    </div>
                )}
            </div>

            <div className="flex flex-col items-center w-[35%]">
                <div className="w-16 h-16 bg-white/5 p-3 rounded-2xl mb-3 flex items-center justify-center border border-white/10 shadow-inner">
                    {initialData.away_logo ? <img src={initialData.away_logo} className="w-full h-full object-contain" /> : <div className="font-black text-slate-500">A</div>}
                </div>
                <h2 className="font-bold text-center text-xs text-white leading-tight w-full line-clamp-2">{initialData.away_team}</h2>
            </div>
        </div>
    </div>
  );
}