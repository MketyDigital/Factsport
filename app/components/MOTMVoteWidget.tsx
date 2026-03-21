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

    // Your worker URL
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
            if (res.ok) {
                const data = await res.json();
                setVoteData(data);
            }
        } catch (e) {}
    };

    const handleVote = async () => {
        if (!selectedPlayer || hasVoted || isVoting) return;
        setIsVoting(true);

        try {
            // 🟢 Send the vote directly to your Cloudflare Worker!
            await fetch(WORKER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ matchId, playerName: selectedPlayer })
            });

            localStorage.setItem(`motm_voted_${matchId}`, 'true');
            setHasVoted(true);
            fetchVotes(); // Refresh bars
        } catch (e) {}
        
        setIsVoting(false);
    };

    if (!lineups || (!lineups.home && !lineups.away)) return null;

    const totalVotes = voteData.reduce((acc, curr) => acc + curr.votes, 0) || 1; 

    return (
        <div className="w-full bg-[#0a1428] rounded-xl p-4 md:p-5 shadow-lg border border-slate-800 mb-4 text-white relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-yellow-500/20 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex items-center gap-2 mb-4 relative z-10">
                <Star size={18} className="text-yellow-400 fill-yellow-400" />
                <h3 className="font-black uppercase tracking-widest text-[11px] md:text-xs">Man of the Match</h3>
            </div>

            {!hasVoted ? (
                <div className="relative z-10 flex flex-col gap-3">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Who is your standout player today?</p>
                    <div className="flex gap-2">
                        <select 
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold p-2.5 text-white outline-none focus:border-yellow-500 transition-colors"
                            value={selectedPlayer}
                            onChange={(e) => setSelectedPlayer(e.target.value)}
                        >
                            <option value="">Select a player...</option>
                            {allStarters.map((p, i) => (
                                <option key={i} value={p.name}>{p.name}</option>
                            ))}
                        </select>
                        <button 
                            onClick={handleVote}
                            disabled={!selectedPlayer || isVoting}
                            className="bg-yellow-500 hover:bg-yellow-400 text-black font-black text-[10px] uppercase tracking-widest px-4 py-2.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isVoting ? '...' : 'Vote'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="relative z-10 flex flex-col gap-3 animate-in fade-in duration-500">
                    <div className="flex items-center gap-1.5 mb-1">
                        <CheckCircle size={14} className="text-green-400" />
                        <span className="text-[10px] text-green-400 font-black uppercase tracking-widest">Vote Casted</span>
                    </div>
                    
                    {voteData.slice(0, 3).map((vote, idx) => {
                        const percentage = ((vote.votes / totalVotes) * 100).toFixed(0);
                        return (
                            <div key={idx} className="w-full">
                                <div className="flex justify-between text-[10px] font-bold mb-1">
                                    <span className="text-slate-200 truncate pr-2">{vote.player_name}</span>
                                    <span className="text-yellow-400">{percentage}%</span>
                                </div>
                                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-yellow-500 transition-all duration-1000 ease-out"
                                        style={{ width: `${percentage}%` }}
                                    ></div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}