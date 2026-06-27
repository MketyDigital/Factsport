'use client';

import { useEffect, useState } from 'react';

export default function TournamentGroupStandings({ leagueCode }: { leagueCode: string }) {
    const [standings, setStandings] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const fetchStandings = async () => {
            try {
                const res = await fetch(`/api/cache/standings?league=${leagueCode}`);
                if (res.ok) {
                    const data = await res.json();
                    if (isMounted) setStandings(data);
                }
            } catch (e) {}
            if (isMounted) setIsLoading(false);
        };
        fetchStandings();
        return () => { isMounted = false; };
    }, [leagueCode]);

    if (isLoading) return <div className="p-10 text-center text-slate-400 text-xs font-bold uppercase animate-pulse">Loading Standings...</div>;
    if (standings.length === 0) return <div className="p-10 text-center text-slate-400 text-xs font-bold uppercase">Standings Unavailable</div>;

    // Group by league_code (e.g. WC_GROUP_A)
    const groups: Record<string, any[]> = {};
    standings.forEach(s => {
        if (!groups[s.league_code]) groups[s.league_code] = [];
        groups[s.league_code].push(s);
    });

    return (
        <div className="flex flex-col max-h-[600px] overflow-y-auto styled-scrollbar">
            {Object.keys(groups).map(groupKey => {
                const groupName = groupKey.split('_').slice(1).join(' ').replace(/GROUP /i, 'Group ');
                return (
                    <div key={groupKey} className="mb-4">
                        <div className="bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600 border-y border-slate-200 sticky top-0 z-10">
                            {groupName}
                        </div>
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-white border-b border-slate-100 text-[8px] uppercase tracking-widest text-slate-400 font-black">
                                    <th className="py-2 px-2 text-center w-6">#</th>
                                    <th className="py-2 px-1">Team</th>
                                    <th className="py-2 px-1 text-center w-6" title="Played">P</th>
                                    <th className="py-2 px-1 text-center w-6" title="Goal Difference">GD</th>
                                    <th className="py-2 px-2 text-center w-8 text-slate-800" title="Points">Pts</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {groups[groupKey].map((team: any, index: number) => {
                                    const isQualified = index < 2; // Top 2 qualify styling
                                    return (
                                        <tr key={team.id} className={`text-[10px] md:text-xs font-bold ${isQualified ? 'bg-blue-50/30' : 'bg-white'}`}>
                                            <td className="py-2 px-2 text-center relative">
                                                {isQualified && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-500 rounded-r-sm"></div>}
                                                {team.position}
                                            </td>
                                            <td className="py-2 px-1">
                                                <div className="flex items-center gap-1.5">
                                                    {team.team_crest ? <img src={team.team_crest} className="w-3.5 h-3.5 object-contain" /> : <div className="w-3.5 h-3.5 bg-slate-200 rounded-full" />}
                                                    <span className="truncate max-w-[100px]">{team.team_short_name || team.team_name}</span>
                                                </div>
                                            </td>
                                            <td className="py-2 px-1 text-center text-slate-500">{team.played_games}</td>
                                            <td className="py-2 px-1 text-center font-medium text-slate-600">{team.goal_difference > 0 ? `+${team.goal_difference}` : team.goal_difference}</td>
                                            <td className="py-2 px-2 text-center font-black text-slate-800">{team.points}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                );
            })}
        </div>
    );
}