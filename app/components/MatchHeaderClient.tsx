'use client';
import { useEffect, useState, useRef } from 'react';
import ScoreAxisWidget from '@/app/components/ScoreAxisWidget'; 
import { getLeagueAssets } from '@/app/lib/league-assets';
import MatchTime from '@/app/components/MatchTime';

export default function MatchHeaderClient({ matchId, initialData }: any) {
  const [data, setData] = useState(initialData);
  const hasPremiumWidget = !!initialData?.widget_id;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchHeaderData = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
          const res = await fetch(`/api/match-data?id=${matchId}`);
          if (!res.ok) return;
          const payload = await res.json();
          
          if (payload && !payload.error) {
              setData((prev:any) => ({ 
                  ...prev, 
                  status: payload.status, 
                  home_score: payload.home_score, 
                  away_score: payload.away_score,
                  widget_id: payload.widget_id,
                  displayClock: payload.displayClock
              }));

              if (['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED', 'ABD'].includes(payload.status)) {
                  if (intervalRef.current) clearInterval(intervalRef.current);
              }
          }
      } catch (error) {}
    };

    fetchHeaderData();

    if (!['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED', 'ABD'].includes(initialData?.status)) {
        intervalRef.current = setInterval(fetchHeaderData, 5000);
    }

    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') fetchHeaderData();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [matchId, initialData?.status]);

  if (hasPremiumWidget) {
      return <ScoreAxisWidget matchId={initialData.widget_id} />;
  }

  const currentStatus = data?.status?.toUpperCase() || '';
  const isLive = ['LIVE', 'HT', 'IN_PLAY'].includes(currentStatus);
  const isFinished = ['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED'].includes(currentStatus);
  const leagueData = getLeagueAssets(initialData?.league);

  // 🟢 Safe Referee extraction
  let refName = null;
  if (initialData?.referees && initialData.referees.length > 0) {
      refName = typeof initialData.referees[0] === 'string' ? initialData.referees[0] : initialData.referees[0].name;
  }

  return (
    <div className="relative z-10 px-4 mt-1 pb-4 pt-1 rounded-b-2xl md:rounded-b-3xl overflow-hidden bg-slate-900 shadow-2xl">
        
        <div className="absolute inset-0 z-0 pointer-events-none">
            <img 
                src={leagueData.bg} 
                alt="Stadium Atmosphere" 
                className="absolute inset-0 w-full h-full object-cover opacity-80" 
            />
        </div>

        <div className="absolute inset-0 z-0 pointer-events-none">
            <div className="absolute inset-0 bg-slate-900/60" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/50 to-transparent" />
        </div>

        <div className="relative z-10">
            {refName && (
                <div className="flex justify-center mb-1.5">
                    <span className="bg-black/40 backdrop-blur border border-white/5 text-[7px] md:text-[8px] text-slate-300 px-2 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-widest">
                        👨‍⚖️ Official: {refName}
                    </span>
                </div>
            )}

            <div className="flex justify-center mb-3 md:mb-5">
                {isLive ? (
                    <div className="flex flex-col items-center">
                        <span className="bg-red-600/90 backdrop-blur-sm text-white text-[9px] md:text-[10px] font-black px-3 py-1 md:px-4 md:py-1.5 rounded-full animate-pulse flex items-center gap-1.5 shadow-[0_0_15px_rgba(220,38,38,0.5)] border border-white/10">
                            <span className="w-1.5 h-1.5 bg-white rounded-full"></span> 
                            {currentStatus === 'HT' ? 'HALF TIME' : 'LIVE'}
                        </span>
                        {data?.displayClock && <span className="text-red-300 text-[9px] md:text-[10px] font-mono mt-0.5 md:mt-1 font-bold bg-black/30 px-1.5 rounded">{data.displayClock}</span>}
                    </div>
                ) : (
                    <span className={`text-[8px] md:text-[10px] font-bold px-3 py-1 md:px-4 md:py-1.5 rounded-full border backdrop-blur-md shadow-lg flex items-center ${isFinished ? 'bg-slate-900/80 text-slate-300 border-slate-700' : 'bg-white/10 text-white border-white/20'}`}>
                        {isFinished ? 'FULL TIME' : <MatchTime date={data?.match_date} />}
                    </span>
                )}
            </div>

            <div className="flex justify-between items-start">
                <div className="flex flex-col items-center w-[35%] group">
                    <div className="w-14 h-14 md:w-20 md:h-20 bg-gradient-to-b from-white/10 to-transparent p-2 md:p-4 rounded-xl md:rounded-2xl mb-1.5 flex items-center justify-center border border-white/10 shadow-xl backdrop-blur-md transition-transform group-hover:scale-105">
                        {initialData?.home_logo ? <img src={initialData.home_logo} className="w-full h-full object-contain drop-shadow-lg" /> : <div className="font-black text-slate-500 text-xs md:text-base">H</div>}
                    </div>
                    <h2 className="font-bold text-center text-[9px] md:text-sm text-white leading-tight w-full line-clamp-2 drop-shadow-md px-1">{initialData?.home_team || initialData?.home?.name}</h2>
                </div>
                
                <div className="flex flex-col items-center justify-center w-[30%] pt-2 md:pt-4">
                    {currentStatus === 'SCHEDULED' || currentStatus === 'PRE' ? (
                         <div className="text-2xl md:text-4xl font-black text-white/20 italic">VS</div>
                    ) : (
                        <div className="text-4xl md:text-6xl font-black tracking-tighter text-white flex gap-1 drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]">
                            <span>{data?.home_score ?? 0}</span>
                            <span className="text-white/40 mb-1 md:mb-2 text-3xl md:text-5xl">:</span>
                            <span>{data?.away_score ?? 0}</span>
                        </div>
                    )}
                </div>

                <div className="flex flex-col items-center w-[35%] group">
                    <div className="w-14 h-14 md:w-20 md:h-20 bg-gradient-to-b from-white/10 to-transparent p-2 md:p-4 rounded-xl md:rounded-2xl mb-1.5 flex items-center justify-center border border-white/10 shadow-xl backdrop-blur-md transition-transform group-hover:scale-105">
                        {initialData?.away_logo ? <img src={initialData.away_logo} className="w-full h-full object-contain drop-shadow-lg" /> : <div className="font-black text-slate-500 text-xs md:text-base">A</div>}
                    </div>
                    <h2 className="font-bold text-center text-[9px] md:text-sm text-white leading-tight w-full line-clamp-2 drop-shadow-md px-1">{initialData?.away_team || initialData?.away?.name}</h2>
                </div>
            </div>
        </div>
    </div>
  );
}