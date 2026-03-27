'use client';
import { useState, useEffect, useRef } from 'react';
import Link from "next/link";
import { Video, Radio } from "lucide-react";
import MatchTime from '@/app/components/MatchTime';
import { useSmartInterval } from '@/app/hooks/useSmartInterval'; 
import { fetchLiveMatchDeduplicated } from '@/app/utils/liveFetcher';

const LIVE_STATUSES = ['LIVE', 'IN_PLAY', 'IN', '1H', '2H', 'HT', 'HALFTIME', 'ET', 'EXTRA TIME', 'P', 'PENALTIES'];
const SCHEDULED_STATUSES = ['SCHEDULED', 'PRE', 'UPCOMING', 'TBD', 'DELAYED'];
const FINISHED_STATUSES = ['FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD'];

export default function HeroMatchCards({ heroMatches }: { heroMatches: any[] }) {
    const [liveMatches, setLiveMatches] = useState(heroMatches);
    const isFetching = useRef(false);

    useEffect(() => {
        setLiveMatches(prev => {
            const prevIds = prev.map(p => p.id).join(',');
            const newIds = heroMatches.map(n => n.id).join(',');
            if (prevIds !== newIds) return heroMatches;
            return prev;
        });
    }, [heroMatches]);

    const fetchUpdates = async () => {
        if (isFetching.current) return;
        isFetching.current = true;

        try {
            const updated = await Promise.all(liveMatches.map(async (m) => {
                if (FINISHED_STATUSES.includes((m.status || '').toUpperCase())) return m;
                try {
                    let data;
                    if (m.espn_id) {
                        data = await fetchLiveMatchDeduplicated(m.espn_id);
                    } else {
                        const res = await fetch(`/api/match-data?id=${m.id}`, { cache: 'no-store' });
                        data = await res.json();
                    }

                    if (data && !data.error) {
                        return { ...m, status: data.status, home_score: data.home_score, away_score: data.away_score, displayClock: data.displayClock };
                    }
                } catch(e) { }
                return m;
            }));
            
            if (JSON.stringify(updated) !== JSON.stringify(liveMatches)) {
                setLiveMatches(updated);
            }
        } finally {
            isFetching.current = false;
        }
    };

    // 🟢 FIX: Ensure we instantly fetch on mount so we don't stare at stale Next.js cache for 10 seconds
    useEffect(() => {
        fetchUpdates();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const hasActiveMatches = liveMatches.some(m => 
        LIVE_STATUSES.includes((m.status || '').toUpperCase()) || 
        SCHEDULED_STATUSES.includes((m.status || '').toUpperCase())
    );

    useSmartInterval(fetchUpdates, hasActiveMatches ? 10000 : null);

    if (!liveMatches || liveMatches.length === 0) return null;

    const isSingle = liveMatches.length === 1;

    return (
        <div className={`px-4 mb-5 grid gap-3 ${isSingle ? 'grid-cols-1' : 'grid-cols-2'}`}>
             {liveMatches.map((match) => {
                const rawStatus = (match.status || '').toUpperCase();
                const isLive = LIVE_STATUSES.includes(rawStatus);
                const isScheduled = SCHEDULED_STATUSES.includes(rawStatus);

                return (
                    <Link 
                        key={match.id} 
                        href={`/match/${match.id}`} 
                        className="block relative z-10 w-full"
                    >
                        <div className="bg-[#0a1428] rounded-xl p-2.5 shadow-xl border border-slate-700 relative overflow-hidden group hover:shadow-2xl transition-all duration-300 h-full">
                            
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[7px] font-black px-3 py-[2px] rounded-b-sm z-20 uppercase tracking-widest shadow-md whitespace-nowrap">
                                Top Match
                            </div>

                            {match.home_fanart || match.home_stadium ? (
                                <>
                                    <img src={match.home_fanart || match.home_stadium} className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-60 group-hover:scale-105 transition duration-700 ease-out mix-blend-overlay" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a1428] via-[#0a1428]/60 to-transparent"></div>
                                </>
                            ) : (
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-900 to-[#0a1428] opacity-80"></div>
                            )}

                            <div className="relative z-10">
                                {isLive && (
                                    <div className="absolute top-0 right-0 bg-red-600 text-white text-[7px] font-black px-2 py-0.5 rounded-bl-md animate-pulse flex items-center gap-1 shadow-lg">
                                        <span className="w-1 h-1 bg-white rounded-full"></span> LIVE
                                    </div>
                                )}
                                {(match.livestream_url || match.audio_url) && (
                                    <div className="absolute top-0 left-0 bg-black/60 backdrop-blur-md text-white text-[7px] font-bold px-2 py-0.5 rounded-br-md border border-white/10 flex items-center gap-1">
                                         {match.livestream_url ? <Video size={8} className="text-red-500" /> : <Radio size={8} className="text-blue-400" />}
                                         {match.livestream_url ? 'WATCH' : 'AUDIO'}
                                    </div>
                                )}
                                
                                <div className="flex justify-between items-center mt-6 gap-1">
                                    <div className="flex flex-col items-center flex-1 min-w-0 w-[35%]">
                                        {match.home_logo ? <img src={match.home_logo} className="w-6 h-6 object-contain mb-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"/> : <div className="w-6 h-6 bg-white/10 rounded-full mb-1 flex items-center justify-center text-[9px] font-bold text-white">H</div>}
                                        <span className="text-[8px] font-bold text-center leading-tight text-white drop-shadow-md w-full truncate">{match.home_team}</span>
                                    </div>
                                    
                                    <div className="flex flex-col items-center justify-center shrink-0 z-10 w-[30%]">
                                        <div className="text-sm font-black tabular-nums tracking-wider bg-black/50 px-1.5 py-0.5 rounded-md backdrop-blur-md border border-white/10 shadow-inner text-white whitespace-nowrap flex items-center justify-center">
                                            {isScheduled ? <span className="text-[8px] opacity-60">VS</span> : `${match.home_score}-${match.away_score}`}
                                        </div>
                                        <div className="mt-1 w-full flex justify-center">
                                            <span className="text-[7px] font-black text-blue-300 uppercase tracking-widest text-center drop-shadow-md bg-blue-900/30 px-1.5 py-0.5 rounded whitespace-nowrap">
                                                {isScheduled 
                                                    ? <MatchTime date={match.match_date} />
                                                    : (rawStatus === 'HT' || rawStatus === 'HALFTIME' ? 'HT' : match.displayClock || 'ON GOING')
                                                }
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-center flex-1 min-w-0 w-[35%]">
                                        {match.away_logo ? <img src={match.away_logo} className="w-6 h-6 object-contain mb-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"/> : <div className="w-6 h-6 bg-white/10 rounded-full mb-1 flex items-center justify-center text-[9px] font-bold text-white">A</div>}
                                        <span className="text-[8px] font-bold text-center leading-tight text-white drop-shadow-md w-full truncate">{match.away_team}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Link>
                );
             })}
        </div>
    );
}