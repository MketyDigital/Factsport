'use client';

import React, { useState, useEffect } from 'react';
import { Shield, TrendingUp, Activity } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const LEAGUE_MAP: Record<string, string> = {
    'Premier League': 'PL',
    'La Liga': 'PD',
    'Bundesliga': 'BL1',
    'Serie A': 'SA',
    'Ligue 1': 'FL1',
    'Champions League': 'CL',
    'World Cup': 'WC',
    'Euros': 'EC',
    'Copa America': 'CLI',
    'AFCON': 'AFCON'
};

interface Leader {
    name: string;
    team: string;
    teamCrest?: string;
    value: number;
}

export default function LeagueLeaders({ leagueName }: { leagueName: string }) {
    const [leadersType, setLeadersType] = useState<'goals' | 'assists'>('goals');
    const [activeList, setActiveList] = useState<Leader[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        
        const fetchLeaders = async () => {
            setIsLoading(true);
            try {
                const supabase = createClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                );
                
                const leagueCode = LEAGUE_MAP[leagueName] || 'PL';
                
                const { data, error } = await supabase
                    .from('tournament_scorers')
                    .select('*')
                    .eq('league_code', leagueCode)
                    .order(leadersType, { ascending: false })
                    .limit(5);

                if (isMounted) {
                    if (data && data.length > 0) {
                        const mappedData = data.map((d: any) => ({
                            name: d.player_name,
                            team: d.team_short_name || d.team_name,
                            teamCrest: d.team_crest,
                            value: leadersType === 'goals' ? d.goals : d.assists
                        })).filter((l: Leader) => l.value > 0);
                        setActiveList(mappedData);
                    } else {
                        setActiveList([]);
                    }
                }
            } catch (error) {
                console.error("Error fetching leaders:", error);
                if (isMounted) setActiveList([]);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchLeaders();
        return () => { isMounted = false; };
    }, [leagueName, leadersType]);

    return (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden mt-6">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <TrendingUp size={16} className="text-blue-600" />
                    <h3 className="font-black text-slate-800 uppercase tracking-widest text-[10px] md:text-xs">
                        {leagueName} Stats Leaders
                    </h3>
                </div>
                <div className="flex bg-slate-200/60 rounded-lg p-0.5 border border-slate-200">
                    <button
                        onClick={() => setLeadersType('goals')}
                        className={`px-3 py-1 rounded-md text-[9px] md:text-[10px] font-black uppercase tracking-wider transition ${
                            leadersType === 'goals' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        Goals
                    </button>
                    <button
                        onClick={() => setLeadersType('assists')}
                        className={`px-3 py-1 rounded-md text-[9px] md:text-[10px] font-black uppercase tracking-wider transition ${
                            leadersType === 'assists' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        Assists
                    </button>
                </div>
            </div>

            <div className="divide-y divide-slate-100 min-h-[150px] relative">
                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest animate-pulse flex items-center gap-2">
                            <Activity size={12} /> Loading Stats...
                        </div>
                    </div>
                ) : activeList.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
                        <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                            No Stats Data Available Yet
                        </span>
                    </div>
                ) : (
                    activeList.map((player, index) => (
                        <div key={player.name} className="p-3 md:p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] md:text-xs font-black text-slate-400 w-4 text-center">
                                    #{index + 1}
                                </span>
                                <div>
                                    <h4 className="font-black text-slate-800 text-xs md:text-sm">{player.name}</h4>
                                    <p className="text-[9px] md:text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1 mt-0.5">
                                        <Shield size={10} className="text-slate-400" /> {player.team}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-100 shadow-sm">
                                <span className="font-black text-xs md:text-sm">{player.value}</span>
                                <span className="text-[8px] md:text-[9px] font-bold uppercase tracking-widest text-blue-500">
                                    {leadersType === 'goals' ? 'G' : 'A'}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}