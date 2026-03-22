'use client';
import { useEffect, useState, useRef, useMemo } from 'react';
import Link from 'next/link';
import ScoreAxisWidget from '@/app/components/ScoreAxisWidget'; 
import { getLeagueAssets } from '@/app/lib/league-assets';
import MatchTime from '@/app/components/MatchTime';
import { MapPin, Trophy, Calendar, Flag, Zap } from 'lucide-react';

const formatGoals = (goals: any[]) => {
    const grouped: Record<string, string[]> = {};
    goals.forEach(g => {
        let cleanName = (g.player || 'Unknown Player').split('(')[0].trim(); 
        if (cleanName === 'Goal Confirmed') cleanName = 'Unknown Player';

        let cleanTime = g.time?.replace("'", "") || ""; 
        if (g.text === 'Own Goal') cleanTime += ' (OG)';
        if (g.text === 'Penalty Goal') cleanTime += ' (PEN)';

        if (!grouped[cleanName]) grouped[cleanName] = [];
        grouped[cleanName].push(cleanTime);
    });
    return Object.entries(grouped).map(([name, times]) => `${name} ${times.join("', ")}'`);
};

const getSafeEvents = (dataEvs: any, initialEvs: any, dbEvs: any) => {
    let raw = dataEvs || initialEvs || dbEvs || [];
    if (typeof raw === 'string') {
        try { raw = JSON.parse(raw); } catch(e) { raw = []; }
    }
    return Array.isArray(raw) ? raw : [];
};

export default function MatchHeaderClient({ matchId, initialData, dbData }: any) {
  const [data, setData] = useState(initialData);
  const hasPremiumWidget = !!initialData?.widget_id;
  
  const hasFetchedLive = useRef(false);
  const isFetching = useRef(false); 
  const [homeFlash, setHomeFlash] = useState(false);
  const [awayFlash, setAwayFlash] = useState(false);
  const prevHomeScore = useRef(initialData?.home_score || 0);
  const prevAwayScore = useRef(initialData?.away_score || 0);

  useEffect(() => {
      if (!hasFetchedLive.current) setData(initialData);
  }, [initialData]);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;
    
    const isFinishedInitially = ['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED', 'ABD'].includes(initialData?.status);
    if (isFinishedInitially || hasPremiumWidget || !initialData?.espn_id) return;

    const fetchHeaderData = async () => {
      if (isFetching.current || !isMounted || document.visibilityState !== 'visible') return;

      isFetching.current = true;
      try {
          let res = await fetch(`https://fse.mkpoikankes.workers.dev/?espn_id=${initialData.espn_id}&t=${Date.now()}`);
          
          if (res.ok) {
              const payload = await res.json();
              if (payload && !payload.error && isMounted) {
                  hasFetchedLive.current = true; 
                  
                  // 🟢 THE MEMORY SHIELD: Prevents infinite re-renders
                  setData((prev:any) => {
                      const oldClock = prev.displayClock || '';
                      const newClock = payload.displayClock || '';
                      const oldStatus = prev.status || '';
                      const newStatus = payload.status || '';
                      const eventsChanged = (payload.events?.length || 0) !== (prev.events?.length || 0);
                      
                      const noChanges = 
                          prev.home_score === payload.home_score && 
                          prev.away_score === payload.away_score && 
                          oldClock === newClock && 
                          oldStatus === newStatus &&
                          !eventsChanged;

                      // Abort re-render to save RAM!
                      if (noChanges) return prev;

                      if (payload.home_score > prevHomeScore.current) {
                          setHomeFlash(true); setTimeout(() => setHomeFlash(false), 5000);
                      }
                      if (payload.away_score > prevAwayScore.current) {
                          setAwayFlash(true); setTimeout(() => setAwayFlash(false), 5000);
                      }
                      
                      prevHomeScore.current = payload.home_score;
                      prevAwayScore.current = payload.away_score;

                      return { 
                          ...prev, 
                          status: payload.status, 
                          home_score: payload.home_score, 
                          away_score: payload.away_score,
                          displayClock: payload.displayClock,
                          events: payload.events || payload.match_events || prev.events
                      };
                  });

                  if (['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED', 'ABD'].includes(payload.status)) {
                      isFetching.current = false;
                      return; 
                  }
              }
          }
      } catch (error) {
      } finally {
          isFetching.current = false;
      }
      
      if (isMounted) {
          timeoutId = setTimeout(fetchHeaderData, 4000);
      }
    };

    fetchHeaderData();

    return () => {
        isMounted = false;
        clearTimeout(timeoutId);
    };
  }, [initialData?.status, initialData?.espn_id, hasPremiumWidget]);

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
  
  const events = useMemo(() => getSafeEvents(data?.events || data?.match_events, initialData?.events || initialData?.match_events, dbData?.match_events), [data?.events, data?.match_events]);
  const homeGoals = useMemo(() => events.filter((e: any) => e.type === 'goal' && (e.team === 'home' || (e.player && e.player.toLowerCase().includes(homeTeamName.toLowerCase())))), [events, homeTeamName]);
  const awayGoals = useMemo(() => events.filter((e: any) => e.type === 'goal' && (e.team === 'away' || (e.player && e.player.toLowerCase().includes(awayTeamName.toLowerCase())))), [events, awayTeamName]);

  return (
    <div className="relative z-10 w-full overflow-hidden bg-[#0a1428]">
        <div className="absolute inset-0 z-0 pointer-events-none">
            {/* 🟢 GPU FIX: Added decoding="async" and removed mix-blend mode */}
            <img src={leagueData.bg} alt="Stadium" decoding="async" fetchPriority="high" loading="eager" className="absolute inset-0 w-full h-full object-cover opacity-20" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a1428]/60 via-[#0a1428]/50 to-[#0a1428]/90" />
        </div>

        <div className="relative z-10 px-2 py-2 md:py-3">
            <div className="flex justify-between items-start max-w-lg mx-auto">
                <div className="flex flex-col items-center w-[30%]">
                    <Link href={`/matches?team=${encodeURIComponent(homeTeamName.replace(/['"]/g, ''))}`} className="flex flex-col items-center group active:scale-95 transition-transform w-full">
                        <div className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center mb-1 drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]">
                            {dbData?.home_logo && <img src={dbData.home_logo} className="w-full h-full object-contain" alt="" />}
                        </div>
                        <h2 className="font-bold text-center text-[9px] md:text-[11px] text-white leading-tight line-clamp-2 drop-shadow-md">{homeTeamName}</h2>
                        {homeForm.length > 0 && (
                            <div className="flex items-center gap-[2px] mt-1 drop-shadow-md">
                                {homeForm.map((f: string, i: number) => (
                                    <span key={i} className={`w-2 h-2 flex items-center justify-center text-[5px] font-black text-white rounded-sm ${f === 'W' ? 'bg-green-500' : f === 'L' ? 'bg-red-500' : 'bg-slate-400'}`}>{f}</span>
                                ))}
                            </div>
                        )}
                    </Link>
                    {(isFinished || isLive) && homeGoals.length > 0 && (
                        <div className="mt-2 flex flex-col items-center gap-0.5 max-w-full px-1">
                            {formatGoals(homeGoals).map((txt, i) => (
                                <span key={i} className="text-[6.5px] md:text-[7.5px] text-slate-300 font-bold leading-tight flex items-center gap-0.5 text-center drop-shadow-md break-words max-w-full">
                                    <Zap size={6} className="text-yellow-400 fill-yellow-400 shrink-0"/> {txt}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
                
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
                        <div className="text-2xl md:text-3xl font-black tracking-tighter flex gap-1 items-center drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]">
                            <span className={`transition-all duration-300 ${homeFlash ? 'text-green-400 scale-110' : 'text-white'}`}>{data?.home_score ?? 0}</span>
                            <span className="text-white/40 text-xl md:text-2xl pb-1">-</span>
                            <span className={`transition-all duration-300 ${awayFlash ? 'text-green-400 scale-110' : 'text-white'}`}>{data?.away_score ?? 0}</span>
                        </div>
                    )}
                </div>

                <div className="flex flex-col items-center w-[30%]">
                    <Link href={`/matches?team=${encodeURIComponent(awayTeamName.replace(/['"]/g, ''))}`} className="flex flex-col items-center group active:scale-95 transition-transform w-full">
                        <div className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center mb-1 drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]">
                            {dbData?.away_logo && <img src={dbData.away_logo} className="w-full h-full object-contain" alt="" />}
                        </div>
                        <h2 className="font-bold text-center text-[9px] md:text-[11px] text-white leading-tight line-clamp-2 drop-shadow-md">{awayTeamName}</h2>
                        {awayForm.length > 0 && (
                            <div className="flex items-center gap-[2px] mt-1 drop-shadow-md">
                                {awayForm.map((f: string, i: number) => (
                                    <span key={i} className={`w-2 h-2 flex items-center justify-center text-[5px] font-black text-white rounded-sm ${f === 'W' ? 'bg-green-500' : f === 'L' ? 'bg-red-500' : 'bg-slate-400'}`}>{f}</span>
                                ))}
                            </div>
                        )}
                    </Link>
                    {(isFinished || isLive) && awayGoals.length > 0 && (
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

        <div className="relative z-10 w-full bg-black/40 backdrop-blur-sm border-t border-white/5 py-1.5 px-2 flex justify-between items-center drop-shadow-md">
            <div className="flex items-center gap-2 md:gap-4 overflow-x-auto scrollbar-hide text-[7px] md:text-[8px] font-bold text-slate-300 uppercase tracking-widest whitespace-nowrap">
                {formattedDate && <span className="flex items-center gap-1"><Calendar size={9} className="text-blue-400"/> {formattedDate}</span>}
                {initialData?.venue && <span className="flex items-center gap-1"><MapPin size={9} className="text-red-400"/> {initialData.venue}</span>}
                {initialData?.stage && <span className="flex items-center gap-1"><Trophy size={9} className="text-yellow-500"/> {initialData.stage.replace(/_/g, ' ')}</span>}
                {refName && <span className="flex items-center gap-1"><Flag size={9} className="text-slate-400"/> {refName}</span>}
            </div>
        </div>
    </div>
  );
}