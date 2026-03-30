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
            
            if (JSON.stringify(updated) !== JSON.stringify(liveMatches)) setLiveMatches(updated);
        } finally {
            isFetching.current = false;
        }
    };

    useEffect(() => { fetchUpdates(); }, []);

    const hasActiveMatches = liveMatches.some(m => LIVE_STATUSES.includes((m.status || '').toUpperCase()) || SCHEDULED_STATUSES.includes((m.status || '').toUpperCase()));
    useSmartInterval(fetchUpdates, hasActiveMatches ? 10000 : null);

    if (!liveMatches || liveMatches.length === 0) return null;

    return (
        <div className="w-full overflow-hidden bg-[#0f1c3a]">
            {/* 🟢 Tiny Title, No extra margins */}
            <div className="px-3 pt-2 pb-1">
                <h3 className="text-[9px] md:text-[11px] font-black uppercase tracking-widest text-slate-400">Top Matches</h3>
            </div>

            <div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide px-3 gap-2 pb-2">
                 {liveMatches.map((match) => {
                    const rawStatus = (match.status || '').toUpperCase();
                    const isLive = LIVE_STATUSES.includes(rawStatus);
                    const isScheduled = SCHEDULED_STATUSES.includes(rawStatus);
                    const hasMedia = match.livestream_url || match.audio_url || match.video_url;

                    return (
                        <Link key={match.id} href={`/match/${match.id}`} className="block relative z-10 w-[185px] md:w-[240px] shrink-0 snap-center">
                            <div className="bg-[#14234b] rounded-lg p-2 shadow-md border border-slate-700 relative overflow-hidden group h-[75px]">
                                {match.home_fanart || match.home_stadium ? (
                                    <>
                                        <img src={match.home_fanart || match.home_stadium} className="absolute inset-0 w-full h-full object-cover opacity-20" />
                                        <div className="absolute inset-0 bg-gradient-to-r from-[#14234b]/90 to-transparent"></div>
                                    </>
                                ) : (
                                    <div className="absolute inset-0 bg-gradient-to-r from-[#0a1428] to-[#14234b] opacity-80"></div>
                                )}

                                <div className="relative z-10 h-full flex flex-col justify-between">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-1">
                                            {isLive ? (
                                                <div className="bg-red-600 text-white text-[7px] font-black px-1.5 py-0.5 rounded animate-pulse flex items-center gap-1 shadow-sm">
                                                    <span className="w-1 h-1 bg-white rounded-full"></span> LIVE
                                                </div>
                                            ) : (
                                                <span className="text-[7px] font-bold text-slate-300 uppercase bg-black/30 px-1.5 py-0.5 rounded">{isScheduled ? <MatchTime date={match.match_date} /> : 'FT'}</span>
                                            )}
                                            {hasMedia && (
                                                <div className="bg-blue-600 border border-blue-500 text-white text-[6px] font-bold px-1 py-0.5 rounded flex items-center gap-1 shadow-sm">
                                                    {match.livestream_url || match.video_url ? <Video size={8} /> : <Radio size={8} />}
                                                </div>
                                            )}
                                        </div>
                                        {isLive && <span className="text-[8px] font-black text-red-400">{rawStatus === 'HT' || rawStatus === 'HALFTIME' ? 'HT' : match.displayClock || 'ON GOING'}</span>}
                                    </div>
                                    
                                    <div className="flex justify-between items-center mt-auto gap-0.5">
                                        <div className="flex flex-col items-center w-[35%]">
                                            {match.home_logo ? <img src={match.home_logo} className="w-4 h-4 object-contain mb-0.5"/> : <div className="w-4 h-4 bg-white/10 rounded-full mb-0.5 flex items-center justify-center text-[7px] font-bold text-white">H</div>}
                                            <span className="text-[7px] font-bold text-center text-white truncate w-full">{match.home_team}</span>
                                        </div>
                                        <div className="flex flex-col items-center justify-center w-[30%]">
                                            <div className="text-[9px] font-black tabular-nums bg-black/50 px-1 py-0.5 rounded backdrop-blur-md text-white">
                                                {isScheduled ? <span className="opacity-60 text-[7px]">VS</span> : `${match.home_score}-${match.away_score}`}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-center w-[35%]">
                                            {match.away_logo ? <img src={match.away_logo} className="w-4 h-4 object-contain mb-0.5"/> : <div className="w-4 h-4 bg-white/10 rounded-full mb-0.5 flex items-center justify-center text-[7px] font-bold text-white">A</div>}
                                            <span className="text-[7px] font-bold text-center text-white truncate w-full">{match.away_team}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    );
                 })}
            </div>
            <style dangerouslySetInnerHTML={{__html: `.scrollbar-hide::-webkit-scrollbar { display: none; } .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }`}} />
        </div>
    );
}