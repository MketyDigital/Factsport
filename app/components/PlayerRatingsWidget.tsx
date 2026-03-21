'use client';
import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';

export default function PlayerRatingsWidget({ matchId, lineups, status }: { matchId: string, lineups: any, status: string }) {
    const [ratingsData, setRatingsData] = useState<any[]>([]);
    const [userRatings, setUserRatings] = useState<Record<string, number>>({});
    
    const isFinished = ['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED'].includes((status || '').toUpperCase());
    const WORKER_URL = 'https://fse.mkpoikankes.workers.dev/api/ratings';

    useEffect(() => {
        if (isFinished) {
            fetchRatings();
            const saved = localStorage.getItem(`ratings_${matchId}`);
            if (saved) setUserRatings(JSON.parse(saved));
        }
    }, [matchId, isFinished]);

    const fetchRatings = async () => {
        try {
            const res = await fetch(`${WORKER_URL}?matchId=${matchId}`);
            if (res.ok) setRatingsData(await res.json());
        } catch (e) {}
    };

    const handleRate = async (playerName: string, rating: number) => {
        const newRatings = { ...userRatings, [playerName]: rating };
        setUserRatings(newRatings);
        localStorage.setItem(`ratings_${matchId}`, JSON.stringify(newRatings));

        const existing = ratingsData.find(r => r.player_name === playerName);
        if (existing) {
            setRatingsData(ratingsData.map(r => r.player_name === playerName ? { ...r, total_score: r.total_score + rating, vote_count: r.vote_count + 1 } : r));
        } else {
            setRatingsData([...ratingsData, { player_name: playerName, total_score: rating, vote_count: 1 }]);
        }

        try {
            await fetch(WORKER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ matchId, playerName, rating })
            });
        } catch (e) {}
    };

    if (!isFinished || !lineups || (!lineups.home && !lineups.away)) return null;

    const allStarters = [...(lineups.home?.filter((p: any) => p.is_starter) || []), ...(lineups.away?.filter((p: any) => p.is_starter) || [])];

    const getAverage = (playerName: string) => {
        const data = ratingsData.find(r => r.player_name === playerName);
        if (!data || data.vote_count === 0) return '-';
        return (data.total_score / data.vote_count).toFixed(1);
    };

    return (
        <div className="w-full bg-slate-50 rounded-xl p-4 shadow-inner border border-slate-200 mt-6">
            <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">
                <Star size={16} className="text-yellow-500 fill-yellow-500" />
                <h3 className="font-black uppercase tracking-widest text-[11px] md:text-xs text-slate-800">Fan Player Ratings</h3>
            </div>

            <div className="flex flex-col gap-3">
                {allStarters.map((p, i) => {
                    const avg = getAverage(p.name);
                    const isRated = userRatings[p.name] !== undefined;

                    return (
                        <div key={i} className="flex flex-col md:flex-row md:items-center justify-between bg-white p-3 rounded-lg shadow-sm border border-slate-100 gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 font-bold text-[10px] shrink-0">{p.number}</div>
                                <span className="text-xs font-black text-slate-700 truncate">{p.name}</span>
                            </div>

                            <div className="flex items-center gap-3 md:justify-end">
                                {!isRated ? (
                                    <div className="flex gap-1 overflow-x-auto scrollbar-hide py-1">
                                        {[4, 5, 6, 7, 8, 9, 10].map(score => (
                                            <button 
                                                key={score} 
                                                onClick={() => handleRate(p.name, score)}
                                                className="w-7 h-7 shrink-0 rounded-md bg-slate-100 hover:bg-yellow-400 hover:text-white text-[10px] font-black text-slate-500 transition-colors"
                                            >
                                                {score}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Your Vote: <span className="text-yellow-500 font-black">{userRatings[p.name]}</span></span>
                                    </div>
                                )}
                                
                                <div className="w-10 h-10 shrink-0 bg-[#0a1428] rounded-lg flex items-center justify-center shadow-md ml-auto md:ml-2">
                                    <span className="text-white font-black text-sm">{avg}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}