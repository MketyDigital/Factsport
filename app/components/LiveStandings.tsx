'use client';
import { useEffect, useState, Fragment } from 'react';
import { Trophy, ChevronUp, ChevronDown, Minus } from 'lucide-react';

const LEAGUE_MAP: Record<string, string> = {
    'Premier League': 'PL', 'La Liga': 'PD', 'Bundesliga': 'BL1',
    'Serie A': 'SA', 'Ligue 1': 'FL1', 'Champions League': 'CL',
    'World Cup': 'WC', 'Euros': 'EC', 'Copa America': 'CLI', 'AFCON': 'AFCON'
};

const normalizeName = (name: string) => {
    if (!name) return "";
    return name.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
        .replace(/[^a-z0-9 ]/g, '') 
        .replace(/\b(fc|cf|afc|sc|sv|rc|fk|vfl|fsv|tsg|ssc|bayer|rcd|ud|as|us|osc|cfa|aja|ca|bc|ac|sk|de)\b/g, '') 
        .replace(/\s+/g, ' ') 
        .trim();
};

export default function LiveStandings({ leagueName, homeTeam, awayTeam, homeScore, awayScore, status, matchGroup }: any) {
    const [standings, setStandings] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const fetchStandings = async () => {
            // Strip out "Matches" if passed from the specific components
            const cleanLeague = leagueName.replace(' Matches', '');
            const leagueCode = LEAGUE_MAP[cleanLeague];
            if (!leagueCode) {
                if (isMounted) setIsLoading(false);
                return;
            }

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
    }, [leagueName]);

    if (isLoading) {
        return (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-[200px] flex items-center justify-center">
                <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest animate-pulse">Loading Live Table...</div>
            </div>
        );
    }

    if (standings.length === 0) {
        return (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-[150px] flex items-center justify-center">
                <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Table not available</div>
            </div>
        );
    }

    const isLive = ['LIVE', 'IN_PLAY', '1H', '2H', 'HT', 'ET', 'P'].includes(status?.toUpperCase());
    let liveTable = [...standings].map(team => ({ ...team, original_position: team.position }));

    const normHome = normalizeName(homeTeam);
    const normAway = normalizeName(awayTeam);

    if (isLive) {
        const hScore = parseInt(homeScore) || 0;
        const aScore = parseInt(awayScore) || 0;

        const homeRef = liveTable.find(t => normalizeName(t.team_short_name || t.team_name) === normHome || normalizeName(t.team_name).includes(normHome));
        const awayRef = liveTable.find(t => normalizeName(t.team_short_name || t.team_name) === normAway || normalizeName(t.team_name).includes(normAway));

        if (homeRef && awayRef) {
            homeRef.played_games += 1;
            awayRef.played_games += 1;
            homeRef.goal_difference += (hScore - aScore);
            awayRef.goal_difference += (aScore - hScore);

            if (hScore > aScore) {
                homeRef.points += 3; homeRef.won += 1; awayRef.lost += 1;
            } else if (aScore > hScore) {
                awayRef.points += 3; awayRef.won += 1; homeRef.lost += 1;
            } else {
                homeRef.points += 1; awayRef.points += 1;
                homeRef.draw += 1; awayRef.draw += 1;
            }
        }
    }

    // Sort live table globally (we will subgroup it for display)
    liveTable.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return b.goal_difference - a.goal_difference;
    });

    liveTable.forEach((team, index) => {
        team.live_position = index + 1;
    });

    // 🟢 GROUP STANDINGS LOGIC
    // If we only want a specific group (e.g. from the Tournament Hub)
    if (matchGroup) {
        liveTable = liveTable.filter(t => t.match_group === matchGroup || t.match_group === matchGroup.toUpperCase());
    }

    const groupedStandings = liveTable.reduce((acc, team) => {
        const group = team.match_group || 'League';
        if (!acc[group]) acc[group] = [];
        acc[group].push(team);
        return acc;
    }, {} as Record<string, any[]>);

    const groupKeys = Object.keys(groupedStandings).sort();

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden w-full flex flex-col animate-in fade-in duration-500">
            <div className="bg-[#0a1428] px-4 py-3 flex items-center justify-between">
                <h3 className="text-white text-[10px] md:text-xs font-black uppercase tracking-widest flex items-center gap-2">
                    <Trophy size={14} className="text-yellow-500" /> As It Stands
                </h3>
                {isLive && (
                    <span className="bg-red-500/20 border border-red-500/30 text-red-400 text-[8px] font-black px-2 py-0.5 rounded shadow-sm uppercase tracking-widest animate-pulse flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span> Live Updates
                    </span>
                )}
            </div>

            {groupKeys.map((groupKey, groupIdx) => {
                let displayTable = groupedStandings[groupKey];
                
                // Only run snippet logic for giant 20-team domestic leagues
                if (groupKey === 'League' && displayTable.length > 8) {
                    const homeIndex = displayTable.findIndex((t: any) => normalizeName(t.team_short_name || t.team_name) === normHome || normalizeName(t.team_name).includes(normHome));
                    const awayIndex = displayTable.findIndex((t: any) => normalizeName(t.team_short_name || t.team_name) === normAway || normalizeName(t.team_name).includes(normAway));

                    if (homeIndex !== -1 && awayIndex !== -1) {
                        const minIdx = Math.min(homeIndex, awayIndex);
                        const maxIdx = Math.max(homeIndex, awayIndex);

                        if (maxIdx - minIdx <= 5) {
                            let start = Math.max(0, minIdx - 1);
                            let end = Math.min(displayTable.length, maxIdx + 2);
                            while (end - start < 6 && start > 0) start--;
                            while (end - start < 6 && end < displayTable.length) end++;
                            displayTable = displayTable.slice(start, end); 
                        } else {
                            const indicesToKeep = new Set<number>();
                            indicesToKeep.add(Math.max(0, minIdx - 1));
                            indicesToKeep.add(minIdx);
                            indicesToKeep.add(Math.min(displayTable.length - 1, minIdx + 1));
                            indicesToKeep.add(Math.max(0, maxIdx - 1));
                            indicesToKeep.add(maxIdx);
                            indicesToKeep.add(Math.min(displayTable.length - 1, maxIdx + 1));
                            const sortedIndices = Array.from(indicesToKeep).sort((a, b) => a - b);
                            displayTable = sortedIndices.map(idx => displayTable[idx]);
                        }
                    } else {
                        displayTable = displayTable.slice(0, 8);
                    }
                }

                return (
                    <div key={groupKey} className={groupIdx > 0 ? "border-t-4 border-slate-100" : ""}>
                        {groupKey !== 'League' && (
                            <div className="bg-slate-100/80 px-3 py-2 border-b border-slate-200">
                                <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{groupKey}</span>
                            </div>
                        )}
                        <div className="overflow-x-auto scrollbar-hide">
                            <table className="w-full text-left border-collapse min-w-[300px]">
                                <thead>
                                    <tr className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                                        <th className="p-2.5 w-8 text-center">#</th>
                                        <th className="p-2.5">Team</th>
                                        <th className="p-2.5 text-center w-6">P</th>
                                        <th className="p-2.5 text-center w-8">GD</th>
                                        <th className="p-2.5 text-center w-8 text-slate-800">Pts</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayTable.map((team, index) => {
                                        const isPlaying = normalizeName(team.team_short_name || team.team_name) === normHome || normalizeName(team.team_short_name || team.team_name) === normAway;
                                        const posChange = team.original_position - team.live_position;
                                        const showGap = index > 0 && (team.live_position - displayTable[index - 1].live_position > 1);

                                        return (
                                            <Fragment key={team.id}>
                                                {showGap && (
                                                    <tr className="bg-slate-50/50 border-b border-slate-100">
                                                        <td colSpan={5} className="py-2 text-center">
                                                            <div className="flex justify-center gap-1.5 opacity-40">
                                                                <span className="w-1 h-1 rounded-full bg-slate-400"></span>
                                                                <span className="w-1 h-1 rounded-full bg-slate-400"></span>
                                                                <span className="w-1 h-1 rounded-full bg-slate-400"></span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                                <tr className={`border-b border-slate-50 text-[10px] md:text-xs font-bold transition-colors ${isPlaying ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}>
                                                    <td className="p-2.5 text-center flex flex-col items-center justify-center">
                                                        <span className={`${isPlaying ? 'text-blue-700 font-black' : 'text-slate-600'}`}>{groupKey === 'League' ? team.live_position : team.position}</span>
                                                        {isLive && isPlaying && posChange > 0 && <span className="text-green-500 text-[8px] flex items-center mt-0.5 font-black"><ChevronUp size={10} strokeWidth={3}/>{posChange}</span>}
                                                        {isLive && isPlaying && posChange < 0 && <span className="text-red-500 text-[8px] flex items-center mt-0.5 font-black"><ChevronDown size={10} strokeWidth={3}/>{Math.abs(posChange)}</span>}
                                                        {isLive && isPlaying && posChange === 0 && <span className="text-slate-300 text-[8px] flex items-center mt-0.5"><Minus size={10}/></span>}
                                                    </td>
                                                    <td className="p-2.5">
                                                        <div className="flex items-center gap-2">
                                                            {team.team_crest ? (
                                                                <img src={team.team_crest} alt="" className="w-4 h-4 object-contain" />
                                                            ) : (
                                                                <div className="w-4 h-4 bg-slate-200 rounded-full"></div>
                                                            )}
                                                            <span className={`${isPlaying ? 'text-blue-700 font-black' : 'text-slate-700'} truncate max-w-[120px] md:max-w-[180px]`}>
                                                                {team.team_short_name || team.team_name}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="p-2.5 text-center text-slate-500">{team.played_games}</td>
                                                    <td className="p-2.5 text-center text-slate-500 font-medium">{(team.goal_difference > 0 ? '+' : '')}{team.goal_difference}</td>
                                                    <td className="p-2.5 text-center font-black text-slate-800">{team.points}</td>
                                                </tr>
                                            </Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })}
            
            {liveTable.length > 8 && groupKeys.includes('League') && (
                <div className="bg-slate-50 text-center py-2 border-t border-slate-200">
                    <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Showing live snippet</span>
                </div>
            )}
        </div>
    );
}