'use client';
import { useState, useEffect } from 'react';
import { Star, CheckCircle, Lock } from 'lucide-react';
import { useMatchLive } from '@/app/providers/MatchLiveProvider';

export default function MOTMVoteWidget({ matchId, lineups }: { matchId: string, lineups: any }) {
    const [hasVoted, setHasVoted] = useState(false);
    const [voteData, setVoteData] = useState<any[]>([]);
    const [selectedPlayer, setSelectedPlayer] = useState('');
    const [isVoting, setIsVoting] = useState(false);

    const liveData = useMatchLive();
    
    // 🟢 STATUS FOR WORKER CACHE & AUTO-LOCK LOGIC
    const currentStatus = (liveData?.status || '').toUpperCase();
    const matchDateMs = liveData?.match_date ? new Date(liveData.match_date).getTime() : 0;
    const hoursSinceKickoff = matchDateMs ? (Date.now() - matchDateMs) / 3600000 : 0;
    const isVotingClosed = hoursSinceKickoff > 24;

    const homeStarters = lineups?.home?.filter((p: any) => p.is_starter) || [];
    const awayStarters = lineups?.away?.filter((p: any) => p.is_starter) || [];
    const allStarters = [...homeStarters, ...awayStarters];

    // 🟢 UPDATED: Pointing to your main API worker
    const WORKER_URL = 'https://live-api.factsport.com/api/motm';

    useEffect(() => {
        if (localStorage.getItem(`motm_voted_${matchId}`)) {
            setHasVoted(true);
        }
        fetchVotes();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [matchId, currentStatus]); // Added currentStatus so it refreshes if match goes FT

    const fetchVotes = async () => {
        try {
            // 🟢 UPDATED: Passing status to worker and bypassing browser cache
            const res = await fetch(`${WORKER_URL}?matchId=${matchId}&status=${currentStatus}`, { cache: 'no-store' });
            if (res.ok) setVoteData(await res.json());
        } catch (e) {}
    };

    const handleVote = async () => {
        if (!selectedPlayer || hasVoted || isVoting || isVotingClosed) return;
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
        <div className="w-[95%] md:max-w-md mx-auto bg-[#0a1428] rounded-lg border border-slate-800 mb-3 text-white relative overflow-hidden py-2 px-3 shadow-sm flex flex-col justify-center min-h-[40px]">
            
            {!hasVoted && !isVotingClosed ? (
                <div className="relative z-10 flex items-center justify-between gap-2 w-full">
                    <div className="flex items-center gap-1 shrink-0">
                        <Star size={12} className="text-yellow-400 fill-yellow-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-white">vote MOTM</span>
                    </div>
                    
                    <select 
                        className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded text-[9px] font-bold px-2 py-1 text-white outline-none focus:border-yellow-500 h-6"
                        value={selectedPlayer}
                        onChange={(e) => setSelectedPlayer(e.target.value)}
                        disabled={isVotingClosed}
                    >
                        <option value="">Choose player...</option>
                        {allStarters.map((p, i) => (
                            <option key={i} value={p.name}>{p.name}</option>
                        ))}
                    </select>
                    
                    <button 
                        onClick={handleVote}
                        disabled={!selectedPlayer || isVoting || isVotingClosed}
                        className="bg-yellow-500 hover:bg-yellow-400 text-black font-black text-[9px] uppercase tracking-widest px-3 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed h-6 shrink-0 flex items-center justify-center"
                    >
                        {isVoting ? '...' : 'Vote'}
                    </button>
                </div>
            ) : (
                <div className="relative z-10 flex flex-col gap-1.5 w-full animate-in fade-in duration-500">
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-1">
                            {isVotingClosed ? (
                                <Lock size={10} className="text-slate-400" />
                            ) : (
                                <CheckCircle size={10} className="text-green-400" />
                            )}
                            <span className={`text-[8px] md:text-[9px] font-black uppercase tracking-widest ${isVotingClosed ? 'text-slate-400' : 'text-green-400'}`}>
                                {isVotingClosed ? 'Voting Closed (Final Results)' : 'MOTM Vote Cast'}
                            </span>
                        </div>
                    </div>
                    
                    <div className="flex flex-col gap-1 w-full">
                        {voteData.slice(0, 2).map((vote, idx) => {
                            const percentage = ((vote.votes / totalVotes) * 100).toFixed(0);
                            return (
                                <div key={idx} className="w-full flex items-center justify-between">
                                    <span className="text-slate-200 text-[8px] font-bold w-[35%] truncate pr-1">{vote.player_name}</span>
                                    <div className="flex-1 bg-slate-800 h-1.5 rounded-full overflow-hidden flex items-center mx-1">
                                        <div className="h-full bg-yellow-500 transition-all duration-1000 ease-out" style={{ width: `${percentage}%` }}></div>
                                    </div>
                                    <span className="text-yellow-400 text-[8px] font-bold w-[12%] text-right">{percentage}%</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}