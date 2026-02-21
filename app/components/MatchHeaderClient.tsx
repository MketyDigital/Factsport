'use client';
import { createClient } from '@/app/lib/supabase/client';
import { useEffect, useState } from 'react';
import ScoreAxisWidget from '@/app/components/ScoreAxisWidget'; 
import { getLeagueAssets } from '@/app/lib/league-assets';

export default function MatchHeaderClient({ matchId, initialData }: any) {
  const [data, setData] = useState(initialData);
  const hasPremiumWidget = !!initialData.widget_id;

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`header-${matchId}`)
      .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'matches', 
          filter: `id=eq.${matchId}` 
      }, (payload) => {
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

  if (hasPremiumWidget) {
      return <ScoreAxisWidget matchId={initialData.widget_id} />;
  }

  const isLive = ['LIVE', 'HT', 'IN_PLAY'].includes(data.status);
  const isFinished = ['FT', 'FINISHED'].includes(data.status);

  // 🟢 FETCH THE UNIFIED BACKGROUND
  const leagueData = getLeagueAssets(initialData.league);

  return (
    <div className="relative z-10 px-4 mt-1 pb-6 pt-2 rounded-b-3xl overflow-hidden bg-slate-900 shadow-2xl">
        
        {/* 🟢 1. UNIFIED STADIUM BACKGROUND (Bottom Layer) */}
        {/* TWEAKED: Removed mix-blend, increased opacity to 80% for vibrancy */}
        <div className="absolute inset-0 z-0 pointer-events-none">
            <img 
                src={leagueData.bg} 
                alt="Stadium Atmosphere" 
                className="absolute inset-0 w-full h-full object-cover opacity-65" 
            />
        </div>

        {/* 🟢 2. COLOR GRADIENTS FOR READABILITY */}
        {/* TWEAKED: Reduced top wash to 40%, adjusted bottom gradient to 50% for crisp text */}
        <div className="absolute inset-0 z-0 pointer-events-none">
            <div className="absolute inset-0 bg-slate-900/40" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/50 to-transparent" />
        </div>

        {/* 🟢 3. ORIGINAL CONTENT LAYER (Top Layer) */}
        <div className="relative z-10">
            {/* Status Indicator */}
            <div className="flex justify-center mb-6">
                {isLive ? (
                    <div className="flex flex-col items-center">
                        <span className="bg-red-600/90 backdrop-blur-sm text-white text-[10px] font-black px-4 py-1.5 rounded-full animate-pulse flex items-center gap-2 shadow-lg shadow-red-900/40 border border-white/10">
                            <span className="w-2 h-2 bg-white rounded-full"></span> 
                            {data.status === 'HT' ? 'HALF TIME' : 'LIVE'}
                        </span>
                        {data.displayClock && <span className="text-red-300 text-[10px] font-mono mt-1 font-bold">{data.displayClock}</span>}
                    </div>
                ) : (
                    <span className={`text-[10px] font-bold px-4 py-1.5 rounded-full border backdrop-blur-md shadow-lg ${isFinished ? 'bg-slate-900/80 text-slate-300 border-slate-700' : 'bg-white/10 text-white border-white/20'}`}>
                        {isFinished ? 'FULL TIME' : new Date(data.match_date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                    </span>
                )}
            </div>

            {/* Teams & Score */}
            <div className="flex justify-between items-start">
                {/* Home Team */}
                <div className="flex flex-col items-center w-[35%] group">
                    <div className="w-20 h-20 bg-white/10 p-4 rounded-2xl mb-3 flex items-center justify-center border border-white/10 shadow-2xl backdrop-blur-md transition-transform group-hover:scale-105">
                        {initialData.home_logo ? <img src={initialData.home_logo} className="w-full h-full object-contain drop-shadow-md" /> : <div className="font-black text-slate-500">H</div>}
                    </div>
                    <h2 className="font-bold text-center text-sm text-white leading-tight w-full line-clamp-2 drop-shadow-md">{initialData.home_team}</h2>
                </div>
                
                {/* Score */}
                <div className="flex flex-col items-center justify-center w-[30%] pt-4">
                    {data.status === 'SCHEDULED' || data.status === 'PRE' ? (
                         <div className="text-4xl font-black text-white/20">VS</div>
                    ) : (
                        <div className="text-6xl font-black tracking-tighter text-white flex gap-1 drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]">
                            <span>{data.home_score}</span>
                            <span className="text-white/40">:</span>
                            <span>{data.away_score}</span>
                        </div>
                    )}
                </div>

                {/* Away Team */}
                <div className="flex flex-col items-center w-[35%] group">
                    <div className="w-20 h-20 bg-white/10 p-4 rounded-2xl mb-3 flex items-center justify-center border border-white/10 shadow-2xl backdrop-blur-md transition-transform group-hover:scale-105">
                        {initialData.away_logo ? <img src={initialData.away_logo} className="w-full h-full object-contain drop-shadow-md" /> : <div className="font-black text-slate-500">A</div>}
                    </div>
                    <h2 className="font-bold text-center text-sm text-white leading-tight w-full line-clamp-2 drop-shadow-md">{initialData.away_team}</h2>
                </div>
            </div>
        </div>
    </div>
  );
}