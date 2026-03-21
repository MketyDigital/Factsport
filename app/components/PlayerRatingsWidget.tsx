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
            await fetch(WORKER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matchId, playerName, rating }) });
        } catch (e) {}
    };

    if (!isFinished || !lineups || (!lineups.home && !lineups.away)) return null;

    const allStarters = [...(lineups.home?.filter((p: any) => p.is_starter) || []), ...(lineups.away?.filter((p: any) => p.is_starter) || [])];
    const getAverage = (playerName: string) => {
        const data = ratingsData.find(r => r.player_name === playerName);
        return (!data || data.vote_count === 0) ? '-' : (data.total_score / data.vote_count).toFixed(1);
    };

    return (
        <div className="w-full bg-slate-50 rounded-lg p-2 border border-slate-200 mt-2">
            <div className="flex items-center gap-1.5 mb-2 border-b border-slate-200 pb-1">
                <Star size={10} className="text-yellow-500 fill-yellow-500" />
                <h3 className="font-black uppercase tracking-widest text-[9px] text-slate-500">Fan Ratings</h3>
            </div>

            <div className="grid grid-cols-1 gap-1">
                {allStarters.map((p, i) => {
                    const avg = getAverage(p.name);
                    const isRated = userRatings[p.name] !== undefined;

                    return (
                        <div key={i} className="flex items-center justify-between bg-white px-2 py-1.5 rounded border border-slate-100 h-8">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <span className="text-[9px] font-bold text-slate-400 w-3">{p.number}</span>
                                <span className="text-[10px] font-black text-slate-700 truncate max-w-[100px]">{p.name}</span>
                            </div>

                            <div className="flex items-center gap-2">
                                {!isRated ? (
                                    <div className="flex gap-0.5">
                                        {[6, 7, 8, 9, 10].map(score => (
                                            <button key={score} onClick={() => handleRate(p.name, score)} className="w-5 h-5 rounded bg-slate-100 hover:bg-yellow-400 hover:text-white text-[8px] font-black text-slate-500 transition-colors">
                                                {score}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-[8px] font-bold text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded">You: {userRatings[p.name]}</span>
                                )}
                                <div className="w-6 h-6 bg-[#0a1428] rounded flex items-center justify-center">
                                    <span className="text-white font-black text-[9px]">{avg}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}