'use client';
import { useEffect, useState } from 'react';
import { Flame, Target } from 'lucide-react';

const LEAGUE_MAP: Record<string, string> = {
    'Premier League': 'PL', 'La Liga': 'PD', 'Bundesliga': 'BL1',
    'Serie A': 'SA', 'Ligue 1': 'FL1', 'Champions League': 'CL'
};

export default function LeagueLeaders({ leagueName }: { leagueName: string }) {
    const [players, setPlayers] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'goals' | 'assists'>('goals');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const fetchLeaders = async () => {
            setIsLoading(true);
            const leagueCode = LEAGUE_MAP[leagueName] || 'PL';
            const sortColumn = activeTab === 'goals' ? 'goals' : 'assists';
            
            try {
                // 🟢 FETCHES FROM YOUR EDGE CACHE
                const res = await fetch(`/api/cache/leaders?league=${leagueCode}&type=${sortColumn}`);
                if (res.ok) {
                    const data = await res.json();
                    if (isMounted) setPlayers(data);
                }
            } catch (e) {}
            
            if (isMounted) setIsLoading(false);
        };

        fetchLeaders();
        return () => { isMounted = false; };
    }, [leagueName, activeTab]);

    if (isLoading) {
        return <div className="w-full h-[300px] bg-white rounded-2xl border border-slate-200 animate-pulse"></div>;
    }

    if (players.length === 0) return null;

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden w-full mb-6">
            <div className="bg-[#0a1428] px-4 py-3 border-b border-slate-800">
                <h3 className="text-white text-[10px] md:text-xs font-black uppercase tracking-widest flex items-center gap-2">
                    <Flame size={14} className="text-red-500" /> League Leaders
                </h3>
            </div>

            <div className="flex border-b border-slate-100 bg-slate-50">
                <button 
                    onClick={() => setActiveTab('goals')}
                    className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors flex justify-center items-center gap-1.5 ${activeTab === 'goals' ? 'text-blue-600 bg-white border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <Target size={12} /> Top Scorers
                </button>
                <button 
                    onClick={() => setActiveTab('assists')}
                    className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors flex justify-center items-center gap-1.5 ${activeTab === 'assists' ? 'text-blue-600 bg-white border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <img src="/assist-icon.svg" alt="" className="w-3 h-3 opacity-60" onError={(e) => e.currentTarget.style.display='none'} /> Assists
                </button>
            </div>

            <div className="flex flex-col p-2">
                {players.map((player, idx) => (
                    <div key={player.id} className="flex items-center justify-between p-2 md:p-3 hover:bg-slate-50 rounded-xl transition-colors group">
                        <div className="flex items-center gap-3 md:gap-4">
                            <span className={`text-xs md:text-sm font-black w-4 text-center ${idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-slate-400' : idx === 2 ? 'text-amber-700' : 'text-slate-300'}`}>
                                {idx + 1}
                            </span>
                            
                            <div className="flex items-center gap-2 md:gap-3">
                                {player.team_crest ? (
                                    <img src={player.team_crest} alt={player.team_name} className="w-6 h-6 md:w-8 md:h-8 object-contain drop-shadow-sm group-hover:scale-110 transition-transform" />
                                ) : (
                                    <div className="w-6 h-6 md:w-8 md:h-8 bg-slate-100 rounded-full"></div>
                                )}
                                <div className="flex flex-col">
                                    <span className="text-[10px] md:text-xs font-black text-slate-800">{player.player_name}</span>
                                    <span className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[120px]">{player.team_name}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-center justify-center bg-slate-50 group-hover:bg-white border border-slate-100 px-3 py-1.5 rounded-lg shadow-sm">
                            <span className="text-sm md:text-base font-black text-blue-600 leading-none">
                                {activeTab === 'goals' ? player.goals : player.assists}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}