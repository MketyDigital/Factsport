'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Zap, Ticket, Trophy } from 'lucide-react';
import MatchTime from './MatchTime';
import LiveScoreLabel from './LiveScoreLabel';
import { useSmartInterval } from '@/app/hooks/useSmartInterval';
import { fetchLiveMatchDeduplicated } from '@/app/utils/liveFetcher';

const LIVE_STATUSES = ['LIVE', 'IN_PLAY', 'IN', '1H', '2H', 'HT', 'HALFTIME', 'ET', 'EXTRA TIME', 'P', 'PENALTIES'];
const FINISHED_STATUSES = ['FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD'];
const DEFAULT_AFFILIATE_LINK = "https://refpa58144.com/L?tag=d_1181253m_1599c_&site=1181253&ad=1599";

export default function CompactMatchRow({ match: initialMatch, disablePolling = false, showLeague = false }: { match: any, disablePolling?: boolean, showLeague?: boolean }) {
    const [match, setMatch] = useState(initialMatch);
    const isFetching = useRef(false);

    const fetchUpdates = async () => {
        if (disablePolling || isFetching.current || !match.espn_id) return;
        if (FINISHED_STATUSES.includes((match.status || '').toUpperCase())) return;

        isFetching.current = true;
        try {
            const data = await fetchLiveMatchDeduplicated(match.espn_id);
            if (data && !data.error) {
                setMatch((prev: any) => ({ ...prev, status: data.status, home_score: data.home_score, away_score: data.away_score, displayClock: data.displayClock }));
            }
        } catch (e) {} finally {
            isFetching.current = false;
        }
    };

    useEffect(() => { setMatch(initialMatch); }, [initialMatch]);

    const status = (match.status || '').toUpperCase();
    const isLive = LIVE_STATUSES.includes(status);
    const isFinished = FINISHED_STATUSES.includes(status);
    const isScheduled = !isLive && !isFinished;

    useSmartInterval(fetchUpdates, isLive && !disablePolling ? 10000 : 60000);

    return (
        <div className="bg-white hover:bg-slate-50 transition-colors group flex flex-col h-full rounded-md border border-slate-100 shadow-sm overflow-hidden">
            {showLeague && match.league && (
                <div className="px-1.5 py-0.5 bg-slate-50/80 border-b border-slate-100 flex items-center gap-1">
                    <Trophy size={8} className="text-slate-400"/>
                    <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest line-clamp-1">{match.league}</span>
                </div>
            )}
            
            <div className="flex items-stretch p-1 flex-1">
                {/* 🟢 FIXED TIME COLUMN: Zero inner margin/padding, 38px pure width */}
                <div className="w-[38px] shrink-0 flex flex-col items-center justify-center border-r border-slate-100 bg-slate-50/30">
                    {isScheduled ? (
                        <span className="text-[8px] font-bold text-slate-500 tracking-tighter text-center w-full whitespace-nowrap"><MatchTime date={match.match_date} /></span>
                    ) : isFinished ? (
                        <span className="text-[8px] font-black text-slate-400">FT</span>
                    ) : (
                        <LiveScoreLabel matchId={match.id} espnId={match.espn_id} initialStatus={match.status} displayClock={match.displayClock} variant="badge" disablePolling={disablePolling} />
                    )}
                </div>

                {/* Teams & Scores (Padding moved here via pl-1) */}
                <Link href={`/match/${match.id}`} className="flex-1 flex flex-col justify-center gap-0.5 min-w-0 pl-1.5 pr-0.5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 min-w-0">
                            {match.home_logo ? <img src={match.home_logo} className="w-3 h-3 object-contain shrink-0" alt=""/> : <div className="w-3 h-3 bg-slate-200 rounded-full shrink-0"/>}
                            <span className={`text-[9px] md:text-[10px] font-bold truncate ${isFinished && match.home_score > match.away_score ? 'text-slate-900' : 'text-slate-600'}`}>{match.home_team}</span>
                        </div>
                        {!isScheduled && <span className={`text-[10px] font-black leading-none ${isFinished && match.home_score > match.away_score ? 'text-slate-900' : 'text-slate-500'}`}>{match.home_score}</span>}
                    </div>
                    
                    <div className="flex items-center justify-between mt-0.5">
                        <div className="flex items-center gap-1 min-w-0">
                            {match.away_logo ? <img src={match.away_logo} className="w-3 h-3 object-contain shrink-0" alt=""/> : <div className="w-3 h-3 bg-slate-200 rounded-full shrink-0"/>}
                            <span className={`text-[9px] md:text-[10px] font-bold truncate ${isFinished && match.away_score > match.home_score ? 'text-slate-900' : 'text-slate-600'}`}>{match.away_team}</span>
                        </div>
                        {!isScheduled && <span className={`text-[10px] font-black leading-none ${isFinished && match.away_score > match.home_score ? 'text-slate-900' : 'text-slate-500'}`}>{match.away_score}</span>}
                    </div>
                </Link>

                {/* Micro Actions */}
                {!isFinished && (
                    <div className="w-[24px] shrink-0 flex flex-col items-center justify-center pl-1 border-l border-slate-100 gap-1">
                        {isScheduled && (
                            <Link href={`/match/${match.id}#predictions`} className="w-full bg-blue-50 rounded flex items-center justify-center text-blue-600 py-1" title="Predict">
                                <Zap size={10} className="fill-blue-600" />
                            </Link>
                        )}
                        <a href={match.booking_code ? '#' : (match.affiliate_link || DEFAULT_AFFILIATE_LINK)} target="_blank" rel="noopener noreferrer" className="w-full bg-green-50 rounded flex items-center justify-center text-green-600 py-1" title="Bet">
                            <Ticket size={10} />
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}