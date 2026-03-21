'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import ScoreAxisWidget from '@/app/components/ScoreAxisWidget'; 
import { getLeagueAssets } from '@/app/lib/league-assets';
import MatchTime from '@/app/components/MatchTime';
import { MapPin, Trophy, Calendar, Percent, Flag, Zap } from 'lucide-react';

// 🟢 HELPER: Group multiple goals by the same player (e.g., "Saka 14', 45' (PEN)")
const formatGoals = (goals: any[]) => {
    const grouped: Record<string, string[]> = {};
    goals.forEach(g => {
        let cleanName = g.player.split('(')[0].trim(); 
        if (cleanName === 'Goal Confirmed') cleanName = 'Unknown Player';

        let cleanTime = g.time?.replace("'", "") || ""; 
        if (g.text === 'Own Goal') cleanTime += ' (OG)';
        if (g.text === 'Penalty Goal') cleanTime += ' (PEN)';

        if (!grouped[cleanName]) grouped[cleanName] = [];
        grouped[cleanName].push(cleanTime);
    });
    
    return Object.entries(grouped).map(([name, times]) => `${name} ${times.join("', ")}'`);
};

export default function MatchHeaderClient({ matchId, initialData, dbData }: any) {
  const [data, setData] = useState(initialData);
  const hasPremiumWidget = !!initialData?.widget_id;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const hasFetchedLive = useRef(false);

  const [homeFlash, setHomeFlash] = useState(false);
  const [awayFlash, setAwayFlash] = useState(false);
  const prevHomeScore = useRef(initialData?.home_score || 0);
  const prevAwayScore = useRef(initialData?.away_score || 0);

  useEffect(() => {
      if (!hasFetchedLive.current) setData(initialData);
  }, [initialData]);

  useEffect(() => {
    let isMounted = true;
    const fetchHeaderData = async () => {
      if (document.visibilityState !== 'visible' || !isMounted) return;
      try {
          let res;
          if (initialData?.espn_id) {
              res = await fetch(`https://fse.mkpoikankes.workers.dev/?espn_id=${initialData.espn_id}&t=${Date.now()}`);
          } else {
              res = await fetch(`/api/match-data?id=${matchId}&t=${Date.now()}`);
          }
          if (!res.ok) return;
          const payload = await res.json();
          
          if (payload && !payload.error && isMounted) {
              hasFetchedLive.current = true; 
              
              if (payload.home_score > prevHomeScore.current) {
                  setHomeFlash(true); setTimeout(() => setHomeFlash(false), 5000);
              }
              if (payload.away_score > prevAwayScore.current) {
                  setAwayFlash(true); setTimeout(() => setAwayFlash(false), 5000);
              }
              prevHomeScore.current = payload.home_score;
              prevAwayScore.current = payload.away_score;

              setData((prev:any) => ({ 
                  ...prev, 
                  status: payload.status, 
                  home_score: payload.home_score, 
                  away_score: payload.away_score,
                  widget_id: payload.widget_id || prev.widget_id,
                  displayClock: payload.displayClock,
                  events: payload.events || prev.events // 🟢 Safely merge live events
              }));

              if (['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED', 'ABD'].includes(payload.status)) {
                  if (intervalRef.current) clearInterval(intervalRef.current);
              }
          }
      } catch (error) {}
    };

    fetchHeaderData();
    if (!['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED', 'ABD'].includes(initialData?.status)) {
        intervalRef.current = setInterval(fetchHeaderData, 3000);
    }
    const handleVisibilityChange = () => { if (document.visibilityState === 'visible') fetchHeaderData(); };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
        isMounted = false;
        if (intervalRef.current) clearInterval(intervalRef.current);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [matchId, initialData?.status, initialData?.espn_id]);

  if (hasPremiumWidget) return <ScoreAxisWidget matchId={initialData.widget_id} />;

  const currentStatus = data?.status?.toUpperCase() || '';
  const isHT = ['HT', 'HALFTIME', 'HALF TIME', 'HALF-TIME'].includes(currentStatus);
  const isLive = ['LIVE', 'IN_PLAY', '1H', '2H', 'ET', 'EXTRA TIME', 'P', 'PENALTIES'].includes(currentStatus) || isHT;
  const isFinished = ['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED'].includes(currentStatus);
  const isUpcoming = ['SCHEDULED', 'PRE', 'UPCOMING', 'TBD', 'DELAYED'].includes(currentStatus);
  const leagueData = getLeagueAssets(dbData?.league);

  const homeTeamName = dbData?.home_team || initialData?.home?.name || '';
  const awayTeamName = dbData?.away_team || initialData?.away?.name || '';
  const formattedDate = dbData?.match_date ? new Date(dbData.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  
  let refName = null;
  if (initialData?.referees && initialData.referees.length > 0) {
      refName = typeof initialData.referees[0] === 'string' ? initialData.referees[0] : initialData.referees[0].name;
  }

  const homeForm = initialData?.home_form || [];
  const awayForm = initialData?.away_form || [];
  const events = data?.events || initialData?.events || [];
  
  // 🟢 BULLETPROOF FILTER: Checks e.team OR checks if the player string contains the team name
  const homeGoals = events.filter((e: any) => e.type === 'goal' && (e.team === 'home' || e.player?.includes(homeTeamName)));
  const awayGoals = events.filter((e: any) => e.type === 'goal' && (e.team === 'away' || e.player?.includes(awayTeamName)));

  return (
    <div className="relative z-10 w-full overflow-hidden bg-[#0a1428]">
        <div className="absolute inset-0 z-0 pointer-events-none">
            <img src={leagueData.bg} alt="Stadium" className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-screen" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a1428]/60 via-[#0a1428]/50 to-[#0a1428]/90" />
        </div>

        <div className="relative z-10 px-2 py-3 md:py-4">
            <div className="flex justify-between items-start max-w-lg mx-auto">
                
                {/* HOME TEAM */}
                <div className="flex flex-col items-center w-[30%]">
                    <Link href={`/matches?team=${encodeURIComponent(homeTeamName.replace(/['"]/g, ''))}`} className="flex flex-col items-center group active:scale-95 transition-transform w-full">
                        <div className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center mb-1 drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]">
                            {dbData?.home_logo && <img src={dbData.home_logo} className="w-full h-full object-contain" alt="" />}
                        </div>
                        <h2 className="font-bold text-center text-[9px] md:text-[11px] text-white leading-tight line-clamp-2 drop-shadow-md">{homeTeamName}</h2>
                        
                        {homeForm.length > 0 && (
                            <div className="flex items-center gap-[2px] mt-1 drop-shadow-md">
                                {homeForm.map((f: string, i: number) => (
                                    <span key={i} className={`w-2 h-2 md:w-2.5 md:h-2.5 flex items-center justify-center text-[5px] md:text-[6px] font-black text-white rounded-sm ${f === 'W' ? 'bg-green-500' : f === 'L' ? 'bg-red-500' : 'bg-slate-400'}`}>
                                        {f}
                                    </span>
                                ))}
                            </div>
                        )}
                    </Link>

                    {isFinished && homeGoals.length > 0 && (
                        <div className="mt-2 flex flex-col items-center gap-0.5 max-w-full px-1">
                            {formatGoals(homeGoals).map((txt, i) => (
                                <span key={i} className="text-[6.5px] md:text-[7.5px] text-slate-300 font-bold leading-tight flex items-center gap-0.5 text-center drop-shadow-md break-words max-w-full">
                                    <Zap size={6} className="text-yellow-400 fill-yellow-400 shrink-0"/> {txt}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
                
                {/* SCORES */}
                <div className="flex flex-col items-center justify-start pt-2 w-[40%] drop-shadow-lg">
                    {isLive && (
                        <div className="flex items-center gap-1 bg-red-600/90 text-white text-[8px] md:text-[9px] font-black px-2 py-0.5 rounded-sm animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.5)] mb-1">
                            <span className="w-1 h-1 bg-white rounded-full"></span> {isHT ? 'HT' : 'LIVE'} {data?.displayClock && !isHT && <span className="text-red-200 ml-0.5">{data.displayClock}</span>}
                        </div>
                    )}
                    {!isLive && (
                         <span className={`text-[8px] md:text-[9px] font-bold px-2 py-0.5 rounded-sm mb-1 shadow-md ${isFinished ? 'bg-slate-800/80 backdrop-blur text-slate-300' : 'bg-white/20 backdrop-blur text-white'}`}>
                            {isFinished ? 'FT' : <MatchTime date={dbData?.match_date} />}
                         </span>
                    )}

                    {isUpcoming ? (
                         <div className="text-xl md:text-2xl font-black text-white/30 italic">VS</div>
                    ) : (
                        <div className="text-3xl md:text-4xl font-black tracking-tighter flex gap-1 items-center drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]">
                            <span className={`transition-all duration-300 ${homeFlash ? 'text-green-400 scale-110' : 'text-white'}`}>{data?.home_score ?? 0}</span>
                            <span className="text-white/40 text-2xl md:text-3xl pb-1">-</span>
                            <span className={`transition-all duration-300 ${awayFlash ? 'text-green-400 scale-110' : 'text-white'}`}>{data?.away_score ?? 0}</span>
                        </div>
                    )}
                </div>

                {/* AWAY TEAM */}
                <div className="flex flex-col items-center w-[30%]">
                    <Link href={`/matches?team=${encodeURIComponent(awayTeamName.replace(/['"]/g, ''))}`} className="flex flex-col items-center group active:scale-95 transition-transform w-full">
                        <div className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center mb-1 drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]">
                            {dbData?.away_logo && <img src={dbData.away_logo} className="w-full h-full object-contain" alt="" />}
                        </div>
                        <h2 className="font-bold text-center text-[9px] md:text-[11px] text-white leading-tight line-clamp-2 drop-shadow-md">{awayTeamName}</h2>
                        
                        {awayForm.length > 0 && (
                            <div className="flex items-center gap-[2px] mt-1 drop-shadow-md">
                                {awayForm.map((f: string, i: number) => (
                                    <span key={i} className={`w-2 h-2 md:w-2.5 md:h-2.5 flex items-center justify-center text-[5px] md:text-[6px] font-black text-white rounded-sm ${f === 'W' ? 'bg-green-500' : f === 'L' ? 'bg-red-500' : 'bg-slate-400'}`}>
                                        {f}
                                    </span>
                                ))}
                            </div>
                        )}
                    </Link>

                    {isFinished && awayGoals.length > 0 && (
                        <div className="mt-2 flex flex-col items-center gap-0.5 max-w-full px-1">
                            {formatGoals(awayGoals).map((txt, i) => (
                                <span key={i} className="text-[6.5px] md:text-[7.5px] text-slate-300 font-bold leading-tight flex items-center gap-0.5 text-center drop-shadow-md break-words max-w-full">
                                    <Zap size={6} className="text-yellow-400 fill-yellow-400 shrink-0"/> {txt}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>

        <div className="relative z-10 w-full bg-black/40 backdrop-blur-sm border-t border-white/5 py-1.5 px-2 flex justify-center items-center gap-2 md:gap-4 overflow-x-auto scrollbar-hide text-[7px] md:text-[8px] font-bold text-slate-300 uppercase tracking-widest whitespace-nowrap drop-shadow-md">
            {formattedDate && <span className="flex items-center gap-1"><Calendar size={9} className="text-blue-400"/> {formattedDate}</span>}
            {initialData?.venue && <span className="flex items-center gap-1"><MapPin size={9} className="text-red-400"/> {initialData.venue}</span>}
            {initialData?.stage && <span className="flex items-center gap-1"><Trophy size={9} className="text-yellow-500"/> {initialData.stage.replace(/_/g, ' ')}</span>}
            {refName && <span className="flex items-center gap-1"><Flag size={9} className="text-slate-400"/> {refName}</span>}
        </div>
    </div>
  );
}