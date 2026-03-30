'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Video, Mic, Calendar, Radio, Trophy, Activity, PlayCircle, ArrowRight } from 'lucide-react';
import LiveScoreLabel from '@/app/components/LiveScoreLabel'; 
import BettingPromo from '@/app/components/BettingPromo';

export default function LiveMediaClient({ matches }: { matches: any[] }) {
    const [localData, setLocalData] = useState<any>(null);

    useEffect(() => {
        // 1. GET EXACT LOCAL TIMEZONE BOUNDARIES
        const now = new Date();
        const startOfLocalDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
        const endOfLocalDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

        const coveredMatches: any[] = [];
        const liveUncoveredMatches: any[] = [];
        let nextUpcomingMatch any = null;

        matches.forEach(m => {
            const matchTime = new Date(m.match_date).getTime();
            const status = (m.status || '').toUpperCase();
            const isLiveNow = ['LIVE','IN_PLAY','1H','2H','HT','ET','P','PENALTIES'].includes(status);
            const isToday = matchTime >= startOfLocalDay && matchTime <= endOfLocalDay;

            // Only show if it's currently live OR it is scheduled for LOCAL TODAY
            if (isLiveNow || isToday) {
                if (m.livestream_url || m.audio_url) coveredMatches.push(m);
                else liveUncoveredMatches.push(m);
            }

            if (!nextUpcomingMatch && matchTime > now.getTime()) {
                nextUpcomingMatch = m;
            }
        });

        const nextDateText = nextUpcomingMatch 
            ? new Date(nextUpcomingMatch.match_date).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : "a later date";

        setLocalData({ coveredMatches, liveUncoveredMatches, nextDateText });
    }, [matches]);

    // Hydration Skeleton
    if (!localData) return <div className="w-full h-64 animate-pulse bg-white/5 rounded-3xl max-w-5xl mx-auto mt-8 border border-white/10"></div>;

    const { coveredMatches, liveUncoveredMatches, nextDateText } = localData;

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            {coveredMatches.length === 0 && liveUncoveredMatches.length === 0 ? (
                <div className="text-center py-20 bg-white/5 rounded-3xl border border-white/10 p-6 backdrop-blur-sm">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10 shadow-inner">
                        <Calendar className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="font-black text-white text-lg mb-2">No Live Action Right Now</p>
                    <p className="text-xs font-bold text-slate-400">
                        Come back on <span className="text-red-500">{nextDateText}</span> for the next broadcast.
                    </p>
                </div>
            ) : (
                <>
                    {/* FEATURED COVERAGE */}
                    <div>
                        <h2 className="text-xs font-black uppercase text-slate-400 mb-4 flex items-center gap-2 pl-1 tracking-widest">
                            <Video size={14} className="text-blue-500"/> Featured Coverage
                        </h2>
                        
                        {coveredMatches.length === 0 ? (
                            <div className="bg-white/5 border border-white/10 border-dashed rounded-2xl p-6 text-center">
                                 <p className="text-xs font-bold text-slate-400">No Live Coverage scheduled currently.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {coveredMatches.map((match: any) => (
                                    <MatchCard key={match.id} match={match} hasCoverage={true} />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* OTHER LIVE SCORES (2-Column Grid on Mobile) */}
                    <div>
                        <div className="flex items-center gap-2 mb-4 pl-1 mt-4 border-t border-white/10 pt-8">
                            <Activity size={14} className="text-red-500 animate-pulse"/>
                            <h2 className="text-xs font-black uppercase text-slate-400 tracking-widest">Other Live Scores</h2>
                        </div>
                        
                        {liveUncoveredMatches.length === 0 ? (
                            <div className="bg-white/5 border border-white/10 border-dashed rounded-2xl p-6 md:p-10 flex flex-col items-center justify-center text-center">
                                <Calendar size={24} className="text-slate-500 mb-3 opacity-50" />
                                <p className="text-sm font-black text-white mb-1">No matches scheduled for today.</p>
                                <p className="text-xs font-bold text-slate-400 mb-5">Check the full calendar for upcoming fixtures and past results.</p>
                                <Link href="/matches" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-xl transition-colors shadow-lg active:scale-95">
                                    Open Match Center <ArrowRight size={14} />
                                </Link>
                            </div>
                        ) : (
                            /* 🟢 GLOBALLY FORCED 2-COLUMN GRID */
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 opacity-95">
                                {liveUncoveredMatches.map((match: any) => (
                                    <MatchCard key={match.id} match={match} hasCoverage={false} />
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}

            <BettingPromo affiliateLink={null} />
        </div>
    );
}

function MatchCard({ match, hasCoverage }: { match: any, hasCoverage: boolean }) {
    const rawStatus = (match.status || '').toUpperCase();
    const isLive = ['LIVE', 'IN_PLAY', 'IN', '1H', '2H', 'HT', 'HALFTIME', 'ET', 'EXTRA TIME', 'P', 'PENALTIES'].includes(rawStatus);
    const isFinished = ['FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD'].includes(rawStatus);
    const isScheduled = !isLive && !isFinished;

    if (!hasCoverage) {
        // 🟢 COMPACT DARK-MODE CARD STYLED FOR 2-COLUMN GRID
        return (
            <div className="bg-white/5 hover:bg-white/10 transition-colors group flex flex-col h-full rounded-md border border-white/10 shadow-sm overflow-hidden">
                <div className="px-1.5 py-1 bg-black/40 border-b border-white/5 flex items-center gap-1">
                    <Trophy size={8} className="text-slate-400"/>
                    <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest line-clamp-1">{match.league || 'Competition'}</span>
                </div>
                
                <div className="flex items-stretch p-1 flex-1">
                    {/* Time / Status */}
                    <div className="w-[34px] shrink-0 flex flex-col items-center justify-center border-r border-white/10 pr-1.5 mr-1.5 overflow-hidden">
                        {isScheduled ? (
                            <span className="text-[7px] tracking-tighter font-bold text-slate-400 leading-none text-center">
                                {match.match_date ? new Date(match.match_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                            </span>
                        ) : isFinished ? (
                            <span className="text-[8px] font-black text-slate-500 leading-none">FT</span>
                        ) : (
                            <LiveScoreLabel matchId={match.id} espnId={match.espn_id} initialStatus={match.status} displayClock={match.displayClock} variant="badge" />
                        )}
                    </div>

                    {/* Teams & Scores */}
                    <Link href={`/match/${match.id}`} className="flex-1 flex flex-col justify-center gap-0.5 min-w-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 min-w-0 pr-1">
                                {match.home_logo ? <img src={match.home_logo} className="w-3 h-3 object-contain shrink-0" alt=""/> : <div className="w-3 h-3 bg-white/10 rounded-full shrink-0 flex items-center justify-center text-[5px] font-bold text-white">H</div>}
                                <span className="text-[9px] md:text-[10px] font-bold text-white truncate">{match.home_team}</span>
                            </div>
                            {!isScheduled && <span className={`text-[10px] font-black leading-none ${isLive ? 'text-yellow-400' : 'text-white'}`}>{match.home_score}</span>}
                        </div>
                        
                        <div className="flex items-center justify-between mt-0.5">
                            <div className="flex items-center gap-1 min-w-0 pr-1">
                                {match.away_logo ? <img src={match.away_logo} className="w-3 h-3 object-contain shrink-0" alt=""/> : <div className="w-3 h-3 bg-white/10 rounded-full shrink-0 flex items-center justify-center text-[5px] font-bold text-white">A</div>}
                                <span className="text-[9px] md:text-[10px] font-bold text-white truncate">{match.away_team}</span>
                            </div>
                            {!isScheduled && <span className={`text-[10px] font-black leading-none ${isLive ? 'text-yellow-400' : 'text-white'}`}>{match.away_score}</span>}
                        </div>
                    </Link>
                </div>
            </div>
        );
    }

    // 🟢 BEAUTIFIED FEATURED COVERAGE CARD
    return (
        <div className="rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.6)] overflow-hidden relative flex flex-col transition-all duration-500 bg-gradient-to-br from-slate-900 to-[#0a1428] border border-slate-700/80 hover:border-blue-500/50 group">
            {/* Glowing Accent Line */}
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-blue-500 via-purple-500 to-red-500 shadow-[0_0_15px_rgba(59,130,246,0.6)]"></div>
            
            <div className="flex justify-between items-center px-4 py-2.5 border-b border-white/5 bg-black/20">
                 <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-300 uppercase tracking-widest line-clamp-1">
                     <Trophy size={10} className="text-yellow-400"/>
                     {match.league || 'Competition'}
                 </div>
            </div>
            
            <Link href={`/match/${match.id}`} className="block p-5 flex-1 hover:bg-white/5 transition-colors">
                <LiveScoreLabel 
                    matchId={match.id} espnId={match.espn_id} initialStatus={match.status} 
                    homeScore={match.home_score} awayScore={match.away_score} homeTeam={match.home_team} awayTeam={match.away_team} variant="large" 
                />
                
                {(match.livestream_url || match.audio_url) && (
                    <div className="flex gap-3 mb-1 mt-5">
                        {match.livestream_url && (
                            <div className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white py-3 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black transition-all shadow-[0_4px_15px_rgba(220,38,38,0.3)] active:scale-95">
                                <PlayCircle size={16}/> WATCH LIVE
                            </div>
                        )}
                        {match.audio_url && (
                            <div className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white py-3 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black transition-all shadow-[0_4px_15px_rgba(37,99,235,0.3)] active:scale-95">
                                <Mic size={16}/> LIVE RADIO
                            </div>
                        )}
                    </div>
                )}
            </Link>
        </div>
    );
}