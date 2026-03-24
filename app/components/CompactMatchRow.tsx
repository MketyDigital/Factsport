'use client';
import Link from 'next/link';
import { Zap, Ticket, Trophy } from 'lucide-react';
import MatchTime from './MatchTime';
import LiveScoreLabel from './LiveScoreLabel';

const DEFAULT_AFFILIATE_LINK = "https://refpa58144.com/L?tag=d_1181253m_1599c_&site=1181253&ad=1599";

export default function CompactMatchRow({ match, disablePolling = false, showLeague = false }: { match: any, disablePolling?: boolean, showLeague?: boolean }) {
    const rawStatus = (match.status || '').toUpperCase();
    const isLive = ['LIVE', 'IN_PLAY', '1H', '2H', 'HT', 'HALFTIME', 'ET', 'P', 'PENALTIES'].includes(rawStatus);
    const isScheduled = ['SCHEDULED', 'PRE', 'UPCOMING', 'TBD', 'DELAYED'].includes(rawStatus);
    const isFinished = ['FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD'].includes(rawStatus);

    return (
        <div className="bg-white border-b border-slate-100 hover:bg-slate-50 transition-colors group flex flex-col">
            {showLeague && (
                <div className="px-3 py-1.5 bg-slate-50/80 border-b border-slate-100 flex items-center gap-1.5">
                    <Trophy size={10} className="text-slate-400"/>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{match.league}</span>
                </div>
            )}
            <div className="flex items-stretch p-2 md:p-3">
                {/* 🟢 Time / Status Column */}
                <div className="w-[45px] md:w-[50px] shrink-0 flex flex-col items-center justify-center border-r border-slate-100 pr-2 mr-2">
                    {isScheduled ? (
                        <span className="text-[10px] md:text-xs font-bold text-slate-500"><MatchTime date={match.match_date} /></span>
                    ) : isFinished ? (
                        <span className="text-[10px] md:text-xs font-black text-slate-400">FT</span>
                    ) : (
                        <LiveScoreLabel 
                            matchId={match.id} espnId={match.espn_id} initialStatus={match.status} 
                            displayClock={match.displayClock} variant="badge" disablePolling={disablePolling}
                        />
                    )}
                </div>

                {/* 🟢 Teams Column */}
                <Link href={`/match/${match.id}`} className="flex-1 flex flex-col justify-center gap-1.5 min-w-0 py-1">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                            {match.home_logo ? <img src={match.home_logo} className="w-3.5 h-3.5 md:w-4 md:h-4 object-contain shrink-0" alt=""/> : <div className="w-3.5 h-3.5 bg-slate-200 rounded-full shrink-0"/>}
                            <span className={`text-[11px] md:text-[13px] font-bold truncate ${isFinished && match.home_score > match.away_score ? 'text-slate-900' : 'text-slate-700'}`}>{match.home_team}</span>
                        </div>
                        {!isScheduled && <span className={`text-xs md:text-sm font-black ml-2 ${isFinished && match.home_score > match.away_score ? 'text-slate-900' : 'text-slate-500'}`}>{match.home_score}</span>}
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                            {match.away_logo ? <img src={match.away_logo} className="w-3.5 h-3.5 md:w-4 md:h-4 object-contain shrink-0" alt=""/> : <div className="w-3.5 h-3.5 bg-slate-200 rounded-full shrink-0"/>}
                            <span className={`text-[11px] md:text-[13px] font-bold truncate ${isFinished && match.away_score > match.home_score ? 'text-slate-900' : 'text-slate-700'}`}>{match.away_team}</span>
                        </div>
                        {!isScheduled && <span className={`text-xs md:text-sm font-black ml-2 ${isFinished && match.away_score > match.home_score ? 'text-slate-900' : 'text-slate-500'}`}>{match.away_score}</span>}
                    </div>
                </Link>

                {/* 🟢 Micro Actions Column (With Tiny Text!) */}
                {!isFinished && (
                    <div className="w-[45px] md:w-[50px] shrink-0 flex flex-col items-center justify-center pl-2 ml-2 border-l border-slate-100 gap-1.5">
                        {isScheduled && (
                            <Link href={`/match/${match.id}#predictions`} className="w-full bg-blue-50 hover:bg-blue-100 rounded flex flex-col items-center justify-center text-blue-600 transition-colors shadow-sm py-1 pb-1.5" title="Predict">
                                <Zap size={10} className="fill-blue-600 mb-0.5" />
                                <span className="text-[6px] md:text-[7px] font-black uppercase tracking-widest leading-none">Predict</span>
                            </Link>
                        )}
                        <a href={match.booking_code ? '#' : (match.affiliate_link || DEFAULT_AFFILIATE_LINK)} target="_blank" rel="noopener noreferrer" className="w-full bg-green-50 hover:bg-green-100 rounded flex flex-col items-center justify-center text-green-600 transition-colors shadow-sm py-1 pb-1.5" title={match.booking_code ? `Code: ${match.booking_code}` : 'Bet Now'}>
                            <Ticket size={10} className="mb-0.5" />
                            <span className="text-[6px] md:text-[7px] font-black uppercase tracking-widest leading-none">Bet</span>
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}