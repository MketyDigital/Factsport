'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Activity } from 'lucide-react';
import { useSmartInterval } from '@/app/hooks/useSmartInterval';
import { fetchLiveMatchDeduplicated } from '@/app/utils/liveFetcher';

const LIVE_STATUSES = ['LIVE', 'IN_PLAY', 'IN', '1H', '2H', 'HT', 'HALFTIME', 'ET', 'EXTRA TIME', 'P', 'PENALTIES'];
const FINISHED_STATUSES = ['FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD'];

// 🟢 LIGHTWEIGHT TICKER ITEM
function TickerItem({ initialMatch }: { initialMatch: any }) {
    const [match, setMatch] = useState(initialMatch);
    const isFetching = useRef(false);

    const fetchUpdates = async () => {
        if (isFetching.current || !match.espn_id) return;
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

    // 🟢 Fast 30-second polling for live matches. Safe because of Deduplicator!
    useSmartInterval(fetchUpdates, isLive ? 30000 : null);

    return (
        <div className="flex items-center mx-3 md:mx-4 shrink-0">
            <Link href={`/match/${match.id}`} className="flex items-center group hover:opacity-75 transition-opacity">
                {isLive && <span className="w-1 h-1 bg-red-500 rounded-full animate-pulse mr-1.5 shadow-[0_0_5px_rgba(239,68,68,0.8)]"></span>}
                
                <div className="flex items-center gap-1.5">
                    <span className="text-white font-bold text-[8px] md:text-[9px] uppercase tracking-wider">{match.home_team.substring(0, 3)}</span>
                    
                    {isScheduled ? (
                        <span className="text-slate-400 font-bold text-[7px] md:text-[8px] bg-white/10 px-1 py-0.5 rounded leading-none">
                            {new Date(match.match_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    ) : (
                        <div className="flex items-center gap-1 bg-black/40 px-1.5 py-0.5 rounded shadow-inner leading-none">
                            <span className={`font-black text-[9px] md:text-[10px] ${isLive ? 'text-yellow-400' : 'text-white'}`}>{match.home_score}</span>
                            <span className="text-slate-500 text-[8px]">-</span>
                            <span className={`font-black text-[9px] md:text-[10px] ${isLive ? 'text-yellow-400' : 'text-white'}`}>{match.away_score}</span>
                        </div>
                    )}

                    <span className="text-white font-bold text-[8px] md:text-[9px] uppercase tracking-wider">{match.away_team.substring(0, 3)}</span>
                    
                    {isLive && <span className="text-red-400 font-black text-[7px] md:text-[8px] ml-1 tracking-tighter">{match.displayClock || 'LIVE'}</span>}
                    {isFinished && <span className="text-slate-500 font-black text-[7px] md:text-[8px] ml-1">FT</span>}
                </div>
            </Link>
            <span className="text-white/10 ml-3 md:ml-4 font-black text-[8px]">|</span>
        </div>
    );
}

// 🟢 MAIN TICKER CONTAINER
export default function GoalRushTicker({ allMatches, currentMatchId }: { allMatches: any[], currentMatchId: string }) {
    const [tickerData, setTickerData] = useState<any[]>([]);

    useEffect(() => {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

        let todaysMatches = allMatches.filter(m => {
            if (m.id === currentMatchId) return false; 
            const matchTime = new Date(m.match_date).getTime();
            const isLive = LIVE_STATUSES.includes((m.status || '').toUpperCase());
            return isLive || (matchTime >= startOfDay && matchTime <= endOfDay);
        });

        todaysMatches.sort((a, b) => {
            const aLive = LIVE_STATUSES.includes((a.status || '').toUpperCase());
            const bLive = LIVE_STATUSES.includes((b.status || '').toUpperCase());
            if (aLive && !bLive) return -1;
            if (!aLive && bLive) return 1;
            return new Date(a.match_date).getTime() - new Date(b.match_date).getTime();
        });

        todaysMatches = todaysMatches.slice(0, 15);
        setTickerData([...todaysMatches, ...todaysMatches]);
    }, [allMatches, currentMatchId]);

    if (tickerData.length === 0) return null;

    return (
        // 🟢 h-6 is extremely slim (24px). Zero vertical padding.
        <div className="bg-[#050a14] border-b border-white/10 h-6 md:h-8 flex items-center overflow-hidden relative z-40 shadow-sm m-0 p-0">
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes goal-rush-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
                /* 🟢 Pauses animation instantly when touched or hovered */
                .animate-goal-rush { display: flex; width: max-content; animation: goal-rush-scroll 90s linear infinite; }
                .animate-goal-rush:hover, .animate-goal-rush:active { animation-play-state: paused; }
            `}} />

            {/* Sticky Label */}
            <div className="absolute left-0 h-full bg-gradient-to-r from-blue-700 to-blue-900 px-2 md:px-3 flex items-center z-20 shadow-[2px_0_10px_rgba(0,0,0,0.8)] border-r border-blue-500/50 whitespace-nowrap">
                <Activity size={10} className="mr-1 text-yellow-400 animate-pulse" />
                <span className="text-white font-black text-[7px] md:text-[8px] uppercase tracking-widest italic">Goal Rush</span>
            </div>

            <div className="absolute left-[65px] md:left-[80px] w-6 h-full bg-gradient-to-r from-[#050a14] to-transparent z-10 pointer-events-none"></div>

            {/* Scrolling Content */}
            <div className="w-full h-full overflow-hidden flex pl-[70px] md:pl-[90px] overflow-x-auto scrollbar-hide">
                <div className="animate-goal-rush flex items-center h-full">
                    {tickerData.map((match, i) => (
                        <TickerItem key={`${match.id}-${i}`} initialMatch={match} />
                    ))}
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{__html: `.scrollbar-hide::-webkit-scrollbar { display: none; } .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }`}} />
        </div>
    );
}