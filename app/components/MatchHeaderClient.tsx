// @ts-nocheck
'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import ScoreAxisWidget from '@/app/components/ScoreAxisWidget'; 
import { getLeagueAssets } from '@/app/lib/league-assets';
import MatchTime from '@/app/components/MatchTime';
import { MapPin, Trophy, Calendar, Flag, Zap } from 'lucide-react';
import { useMatchLive } from '@/app/providers/MatchLiveProvider'; 

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

export default function MatchHeaderClient({ dbData }: any) {
  const liveData = useMatchLive();
  const hasPremiumWidget = !!dbData?.widget_id;
  
  const [homeFlash, setHomeFlash] = useState(false);
  const [awayFlash, setAwayFlash] = useState(false);
  const prevHomeScore = useRef(liveData?.home_score || 0);
  const prevAwayScore = useRef(liveData?.away_score || 0);

  useEffect(() => {
      if (liveData?.home_score > prevHomeScore.current) {
          setHomeFlash(true); setTimeout(() => setHomeFlash(false), 5000);
      }
      if (liveData?.away_score > prevAwayScore.current) {
          setAwayFlash(true); setTimeout(() => setAwayFlash(false), 5000);
      }
      prevHomeScore.current = liveData?.home_score || 0;
      prevAwayScore.current = liveData?.away_score || 0;
  }, [liveData?.home_score, liveData?.away_score]);

  if (hasPremiumWidget) return <ScoreAxisWidget matchId={dbData.widget_id} />;

  const currentStatus = liveData?.status?.toUpperCase() || '';
  const isHT = ['HT', 'HALFTIME', 'HALF TIME', 'HALF-TIME'].includes(currentStatus);
  const isLive = ['LIVE', 'IN_PLAY', '1H', '2H', 'ET', 'EXTRA TIME', 'P', 'PENALTIES'].includes(currentStatus) || isHT;
  const isFinished = ['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED'].includes(currentStatus);
  const isUpcoming = ['SCHEDULED', 'PRE', 'UPCOMING', 'TBD', 'DELAYED'].includes(currentStatus);
  const leagueData = getLeagueAssets(dbData?.league);

  const homeTeamName = dbData?.home_team || '';
  const awayTeamName = dbData?.away_team || '';
  const homeScore = liveData?.home_score ?? dbData?.home_score ?? null;
  const awayScore = liveData?.away_score ?? dbData?.away_score ?? null;
  const formattedDate = dbData?.match_date ? new Date(dbData.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  
  let refName = null;
  if (liveData?.referees && liveData.referees.length > 0) {
      refName = typeof liveData.referees[0] === 'string' ? liveData.referees[0] : liveData.referees[0].name;
  }

  const homeForm = liveData?.home_form || [];
  const awayForm = liveData?.away_form || [];
  
  const events = liveData?.match_events || liveData?.events || [];
  const homeGoals = events.filter((e: any) => e.type === 'goal' && (e.team === 'home' || (e.player && e.player.toLowerCase().includes(homeTeamName.toLowerCase()))));
  const awayGoals = events.filter((e: any) => e.type === 'goal' && (e.team === 'away' || (e.player && e.player.toLowerCase().includes(awayTeamName.toLowerCase()))));

  const stats = liveData?.stats || { home: {}, away: {} };
  const homePens = stats?.home_penalties;
  const awayPens = stats?.away_penalties;
  const hasPens = homePens !== null && homePens !== undefined;
  const homeHT = stats?.home_ht;
  const awayHT = stats?.away_ht;
  const hasHT = homeHT !== null && homeHT !== undefined;
  const aggregateText = stats?.aggregate;

  return (
    <>
      <div className="relative z-10 w-full overflow-hidden bg-[#0a1428]">
          <div className="absolute inset-0 z-0 pointer-events-none" aria-hidden="true">
              <img src={leagueData.bg} alt="" decoding="async" fetchPriority="high" loading="eager" className="absolute inset-0 w-full h-full object-cover opacity-25" />
              <div className="absolute inset-0 bg-gradient-to-b from-[#0a1428]/60 via-[#0a1428]/50 to-[#0a1428]/90" />
              <div className="fs-match-pitch absolute inset-x-0 bottom-0 flex items-center justify-center overflow-hidden" aria-hidden="true">
                  <svg viewBox="0 0 900 260" preserveAspectRatio="xMidYMid slice" className="h-full w-full" fill="none">
                      <path d="M-40 20h980v310H-40zM450 20v310M450 102a73 73 0 1 0 0 146 73 73 0 0 0 0-146ZM-40 70h145v210H-40zM795 70h145v210H795zM105 112h62v126h-62zM733 112h62v126h-62z" />
                      <circle cx="450" cy="175" r="4" fill="currentColor" />
                  </svg>
              </div>
              <div className="fs-match-light absolute inset-0" />
          </div>

          <div className="relative z-10 px-3 py-5 md:px-6 md:py-8">
              <div className="mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2 md:gap-8">
                  <div className="flex min-w-0 flex-col items-center">
                      <Link href={`/matches?team=${encodeURIComponent(homeTeamName.replace(/['"]/g, ''))}`} className="group flex w-full flex-col items-center rounded-2xl p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 active:scale-[.98]">
                          <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10 p-2 shadow-lg backdrop-blur-sm md:h-20 md:w-20 md:p-3">
                              {dbData?.home_logo && <img src={dbData.home_logo} className="h-full w-full object-contain drop-shadow-md" alt={`${homeTeamName} crest`} />}
                          </div>
                          <h2 className="line-clamp-2 min-h-10 text-center text-sm font-extrabold leading-tight text-white drop-shadow-md md:min-h-12 md:text-lg">{homeTeamName}</h2>
                          {homeForm.length > 0 && (
                              <div className="mt-2 flex items-center gap-1 drop-shadow-md" aria-label="Recent form">
                                  {homeForm.map((f: string, i: number) => (
                                      <span key={i} className={`flex h-4 w-4 items-center justify-center rounded text-[9px] font-black text-white ${f === 'W' ? 'bg-green-600' : f === 'L' ? 'bg-red-600' : 'bg-slate-500'}`}>{f}</span>
                                  ))}
                              </div>
                          )}
                      </Link>
                      {(isFinished || isLive) && homeGoals.length > 0 && (
                          <div className="mt-2 flex max-w-full flex-col items-center gap-1 px-1">
                              {formatGoals(homeGoals).map((txt, i) => (
                                  <span key={i} className="flex max-w-full items-center gap-1 break-words text-center text-[10px] font-semibold leading-tight text-slate-200 drop-shadow-md md:text-xs">
                                      <Zap size={12} className="shrink-0 fill-yellow-400 text-yellow-400"/> {txt}
                                  </span>
                              ))}
                          </div>
                      )}
                  </div>
                  
                  <div className="flex min-w-[112px] flex-col items-center justify-start pt-1 drop-shadow-lg md:min-w-[190px]">
                      {isLive && (
                          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-red-300/30 bg-red-600 px-3 py-1 text-[10px] font-black tracking-wider text-white shadow-[0_0_18px_rgba(220,38,38,0.3)] md:text-xs">
                              <span className="h-2 w-2 animate-pulse rounded-full bg-white"></span> {isHT ? 'HALF TIME' : 'LIVE'} {liveData?.displayClock && !isHT && <span className="text-red-100">{liveData.displayClock}</span>}
                          </div>
                      )}
                      {!isLive && (
                           <span className={`mb-2 rounded-full border px-3 py-1 text-[10px] font-extrabold tracking-wide shadow-md md:text-xs ${isFinished ? 'border-white/10 bg-slate-800/90 text-slate-200' : 'border-white/15 bg-white/15 text-white backdrop-blur'}`}>
                              {isFinished ? 'FULL TIME' : isUpcoming ? <MatchTime date={dbData?.match_date} /> : currentStatus || 'MATCH'}
                           </span>
                      )}

                      {isUpcoming ? (
                           <div className="py-2 text-2xl font-black italic tracking-widest text-white/45 md:text-4xl">VS</div>
                      ) : (
                          <div className="mt-1 flex flex-col items-center">
                              <div className="fs-match-score flex items-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-4 py-1 text-4xl font-black tracking-tight text-white shadow-inner md:gap-4 md:px-7 md:py-2 md:text-6xl" aria-label={`${homeTeamName} ${homeScore ?? 'score unavailable'} to ${awayScore ?? 'score unavailable'} ${awayTeamName}`} aria-live="polite">
                                  <span className={`tabular-nums transition-all duration-300 ${homeFlash ? 'scale-110 text-green-400' : 'text-white'}`}>{homeScore ?? '–'}</span>
                                  <span className="text-2xl font-semibold text-white/35 md:text-4xl">:</span>
                                  <span className={`tabular-nums transition-all duration-300 ${awayFlash ? 'scale-110 text-green-400' : 'text-white'}`}>{awayScore ?? '–'}</span>
                              </div>
                              
                              {hasHT && (
                                  <span className="mt-2 text-[10px] font-bold text-slate-300 drop-shadow-md md:text-xs">
                                      (HT: {homeHT}-{awayHT})
                                  </span>
                              )}
                              {hasPens && (
                                  <span className="mt-2 text-[10px] font-black tracking-widest text-amber-300 drop-shadow-md md:text-xs">
                                      PENS: {homePens}-{awayPens}
                                  </span>
                              )}
                              {aggregateText && (
                                  <span className="mt-2 rounded-full bg-white/10 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-slate-200 md:text-[10px]">
                                      {aggregateText}
                                  </span>
                              )}
                          </div>
                      )}
                  </div>

                  <div className="flex min-w-0 flex-col items-center">
                      <Link href={`/matches?team=${encodeURIComponent(awayTeamName.replace(/['"]/g, ''))}`} className="group flex w-full flex-col items-center rounded-2xl p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 active:scale-[.98]">
                          <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10 p-2 shadow-lg backdrop-blur-sm md:h-20 md:w-20 md:p-3">
                              {dbData?.away_logo && <img src={dbData.away_logo} className="h-full w-full object-contain drop-shadow-md" alt={`${awayTeamName} crest`} />}
                          </div>
                          <h2 className="line-clamp-2 min-h-10 text-center text-sm font-extrabold leading-tight text-white drop-shadow-md md:min-h-12 md:text-lg">{awayTeamName}</h2>
                          {awayForm.length > 0 && (
                              <div className="mt-2 flex items-center gap-1 drop-shadow-md" aria-label="Recent form">
                                  {awayForm.map((f: string, i: number) => (
                                      <span key={i} className={`flex h-4 w-4 items-center justify-center rounded text-[9px] font-black text-white ${f === 'W' ? 'bg-green-600' : f === 'L' ? 'bg-red-600' : 'bg-slate-500'}`}>{f}</span>
                                  ))}
                              </div>
                          )}
                      </Link>
                      {(isFinished || isLive) && awayGoals.length > 0 && (
                          <div className="mt-2 flex max-w-full flex-col items-center gap-1 px-1">
                              {formatGoals(awayGoals).map((txt, i) => (
                                  <span key={i} className="flex max-w-full items-center gap-1 break-words text-center text-[10px] font-semibold leading-tight text-slate-200 drop-shadow-md md:text-xs">
                                      <Zap size={12} className="shrink-0 fill-yellow-400 text-yellow-400"/> {txt}
                                  </span>
                              ))}
                          </div>
                      )}
                  </div>
              </div>
          </div>

          <div className="relative z-10 w-full border-t border-white/10 bg-black/30 px-4 py-3 backdrop-blur-sm">
              <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10px] font-bold uppercase tracking-wide text-slate-200 md:text-xs">
                  {formattedDate && <span className="flex items-center gap-1.5"><Calendar size={13} className="text-blue-300"/> {formattedDate}</span>}
                  {dbData?.venue && <span className="flex items-center gap-1.5"><MapPin size={13} className="text-red-300"/> {dbData.venue}</span>}
                  {dbData?.stage && <span className="flex items-center gap-1.5"><Trophy size={13} className="text-yellow-300"/> {dbData.stage.replace(/_/g, ' ')}</span>}
                  {refName && <span className="flex items-center gap-1.5"><Flag size={13} className="text-slate-300"/> {refName}</span>}
              </div>
          </div>
      </div>
    </>
  );
}
