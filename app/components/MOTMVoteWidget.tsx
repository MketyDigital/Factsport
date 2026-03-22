'use client';
import { useState, useEffect } from 'react';
import { Star, CheckCircle } from 'lucide-react';

export default function MOTMVoteWidget({ matchId, lineups }: { matchId: string, lineups: any }) {
    const [hasVoted, setHasVoted] = useState(false);
    const [voteData, setVoteData] = useState<any[]>([]);
    const [selectedPlayer, setSelectedPlayer] = useState('');
    const [isVoting, setIsVoting] = useState(false);

    const homeStarters = lineups?.home?.filter((p: any) => p.is_starter) || [];
    const awayStarters = lineups?.away?.filter((p: any) => p.is_starter) || [];
    const allStarters = [...homeStarters, ...awayStarters];

    const WORKER_URL = 'https://fse.mkpoikankes.workers.dev/api/motm';

    useEffect(() => {
        if (localStorage.getItem(`motm_voted_${matchId}`)) {
            setHasVoted(true);
        }
        fetchVotes();
    }, [matchId]);

    const fetchVotes = async () => {
        try {
            const res = await fetch(`${WORKER_URL}?matchId=${matchId}`);
            if (res.ok) setVoteData(await res.json());
        } catch (e) {}
    };

    const handleVote = async () => {
        if (!selectedPlayer || hasVoted || isVoting) return;
        setIsVoting(true);

        try {
            await fetch(WORKER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ matchId, playerName: selectedPlayer })
            });

            localStorage.setItem(`motm_voted_${matchId}`, 'true');
            setHasVoted(true);
            fetchVotes(); 
        } catch (e) {}
        setIsVoting(false);
    };

    if (!lineups || (!lineups.home && !lineups.away)) return null;
    const totalVotes = voteData.reduce((acc, curr) => acc + curr.votes, 0) || 1; 

    return (
        // 🟢 ULTRA-SLIM STYLING: Max-width 85%, tiny padding, flex-row alignment
        <div className="w-[90%] md:max-w-md mx-auto bg-[#0a1428] rounded border border-slate-800 mb-3 text-white relative overflow-hidden py-1.5 px-2.5 shadow-sm flex flex-col justify-center">
            
            {!hasVoted ? (
                <div className="relative z-10 flex items-center justify-between gap-1.5 w-full">
                    <div className="flex items-center gap-1 shrink-0">
                        <Star size={10} className="text-yellow-400 fill-yellow-400" />
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-300 hidden sm:inline">MOTM</span>
                    </div>
                    <select 
                        className="flex-1 bg-slate-900 border border-slate-700 rounded text-[8px] font-bold px-1.5 py-1 text-white outline-none focus:border-yellow-500 h-5"
                        value={selectedPlayer}
                        onChange={(e) => setSelectedPlayer(e.target.value)}
                    >
                        <option value="">Select player...</option>
                        {allStarters.map((p, i) => (
                            <option key={i} value={p.name}>{p.name}</option>
                        ))}
                    </select>
                    <button 
                        onClick={handleVote}
                        disabled={!selectedPlayer || isVoting}
                        className="bg-yellow-500 hover:bg-yellow-400 text-black font-black text-[8px] uppercase tracking-widest px-2 rounded disabled:opacity-50 disabled:cursor-not-allowed h-5 shrink-0 flex items-center justify-center"
                    >
                        {isVoting ? '...' : 'Vote'}
                    </button>
                </div>
            ) : (
                <div className="relative z-10 flex flex-col gap-1 w-full">
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-1">
                            <CheckCircle size={8} className="text-green-400" />
                            <span className="text-[7px] text-green-400 font-black uppercase tracking-widest">Vote Cast</span>
                        </div>
                    </div>
                    
                    {/* Very thin progress bars */}
                    <div className="flex flex-col gap-[2px] w-full">
                        {voteData.slice(0, 2).map((vote, idx) => {
                            const percentage = ((vote.votes / totalVotes) * 100).toFixed(0);
                            return (
                                <div key={idx} className="w-full flex items-center justify-between">
                                    <span className="text-slate-300 text-[7px] font-bold w-[35%] truncate pr-1">{vote.player_name}</span>
                                    <div className="flex-1 bg-slate-800 h-1 rounded-full overflow-hidden flex items-center mx-1">
                                        <div className="h-full bg-yellow-500 transition-all duration-1000 ease-out" style={{ width: `${percentage}%` }}></div>
                                    </div>
                                    <span className="text-yellow-400 text-[7px] font-bold w-[12%] text-right">{percentage}%</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}