'use client';
import { useEffect, useState, Fragment } from 'react';
import { Trophy, ChevronUp, ChevronDown, Minus, Calendar, MapPin, Activity } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const LEAGUE_MAP: Record<string, string> = {
    'Premier League': 'PL', 'La Liga': 'PD', 'Bundesliga': 'BL1',
    'Serie A': 'SA', 'Ligue 1': 'FL1', 'Champions League': 'CL',
    'World Cup': 'WC', 'Euros': 'EC', 'Copa America': 'CLI', 'AFCON': 'AFCON'
};

const STAGE_DISPLAY: Record<string, string> = {
    'ROUND_OF_32': 'Round of 32',
    'ROUND_OF_16': 'Round of 16',
    'QUARTER_FINALS': 'Quarter-Finals',
    'SEMI_FINALS': 'Semi-Finals',
    'FINAL': 'Grand Final'
};

const stageOrder = ['ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL'];

const normalizeStage = (stage: string) => {
    if (!stage) return '';
    return stage.toUpperCase().replace(/-/g, '_').replace(/ /g, '_');
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

// Remove generateMockMatches completely

export default function LiveStandings({ leagueName, homeTeam, awayTeam, homeScore, awayScore, status, matchGroup, stage }: any) {
    const [standings, setStandings] = useState<any[]>([]);
    const [matches, setMatches] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedStage, setSelectedStage] = useState<string>('');

    useEffect(() => {
        let isMounted = true;
        const fetchStandingsAndMatches = async () => {
            const cleanLeague = leagueName.replace(' Matches', '');
            const leagueCode = LEAGUE_MAP[cleanLeague];
            setIsLoading(true);

            try {
                // Fetch Standings
                let standingsData: any[] = [];
                if (leagueCode) {
                    const res = await fetch(`/api/cache/standings?league=${leagueCode}`);
                    if (res.ok) {
                        standingsData = await res.json();
                    }
                }
                if (isMounted) setStandings(standingsData);

                // Fetch Matches
                const supabase = createClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                );
                
                const { data: dbMatches } = await supabase
                    .from('matches')
                    .select('*')
                    .eq('league', cleanLeague)
                    .order('match_date', { ascending: true });

                if (isMounted && dbMatches) {
                    setMatches(dbMatches);
                }
            } catch (e) {
                console.error("Error fetching standings/matches:", e);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchStandingsAndMatches();
        return () => { isMounted = false; };
    }, [leagueName]);

    // Handle initial knockout stage selection
    useEffect(() => {
        const knockoutMatches = matches.filter(m => stageOrder.includes(normalizeStage(m.stage)));

        if (knockoutMatches.length > 0) {
            const activeOrLive = knockoutMatches.find(m => ['LIVE', '1H', '2H', 'HT', 'ET', 'P', 'IN_PLAY'].includes(m.status));
            if (activeOrLive && activeOrLive.stage) {
                setSelectedStage(normalizeStage(activeOrLive.stage));
            } else {
                const scheduled = knockoutMatches.find(m => m.status === 'SCHEDULED');
                if (scheduled && scheduled.stage) {
                    setSelectedStage(normalizeStage(scheduled.stage));
                } else {
                    setSelectedStage(normalizeStage(knockoutMatches[knockoutMatches.length - 1].stage) || 'FINAL');
                }
            }
        }
    }, [matches, leagueName]);

    if (isLoading) {
        return (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-[200px] flex items-center justify-center">
                <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest animate-pulse">Loading Live Table...</div>
            </div>
        );
    }

    const cleanLeagueName = leagueName.replace(' Matches', '');
    const isCup = ['World Cup', 'Euros', 'Champions League', 'Copa America', 'AFCON'].includes(cleanLeagueName);
    
    // Determine if knockout stage is active
    const knockoutMatches = matches.filter(m => stageOrder.includes(normalizeStage(m.stage)));
    const hasActiveGroupMatches = matches.some(m => !stageOrder.includes(normalizeStage(m.stage)) && ['LIVE', '1H', '2H', 'HT', 'ET', 'P', 'SCHEDULED'].includes(m.status));
    
    const isKnockoutActive = stage ? stageOrder.includes(normalizeStage(stage)) : 
        (isCup && knockoutMatches.length > 0 && !hasActiveGroupMatches);

    // 🏆 KNOCKOUT STAGE RENDERING
    if (isKnockoutActive) {
        const activeStages = stageOrder.filter(s => knockoutMatches.some(m => normalizeStage(m.stage) === s));
        const currentStageToRender = selectedStage || activeStages[0] || 'ROUND_OF_16';
        const stageMatches = knockoutMatches.filter(m => normalizeStage(m.stage) === currentStageToRender);
        const isLive = stageMatches.some(m => ['LIVE', '1H', '2H', 'HT', 'ET', 'P', 'IN_PLAY'].includes(m.status?.toUpperCase()));

        const normHome = normalizeName(homeTeam);
        const normAway = normalizeName(awayTeam);

        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden w-full flex flex-col animate-in fade-in duration-500">
                <div className="bg-[#0a1428] px-4 py-3 flex items-center justify-between">
                    <h3 className="text-white text-[10px] md:text-xs font-black uppercase tracking-widest flex items-center gap-2">
                        <Trophy size={14} className="text-yellow-500" /> Knockout Stages
                    </h3>
                    {isLive && (
                        <span className="bg-red-500/20 border border-red-500/30 text-red-400 text-[8px] font-black px-2 py-0.5 rounded shadow-sm uppercase tracking-widest animate-pulse flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span> Live Updates
                        </span>
                    )}
                </div>

                {/* Sub-tabs for each knockout stage */}
                {activeStages.length > 1 && (
                    <div className="flex px-3 py-2 gap-1.5 overflow-x-auto scrollbar-hide border-b border-slate-100 bg-slate-50/50">
                        {activeStages.map(stg => (
                            <button
                                key={stg}
                                onClick={() => setSelectedStage(stg)}
                                className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                                    currentStageToRender === stg 
                                        ? 'bg-blue-600 text-white shadow-sm' 
                                        : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
                                }`}
                            >
                                {STAGE_DISPLAY[stg] || stg}
                            </button>
                        ))}
                    </div>
                )}

                {/* Match List for selected stage */}
                <div className="divide-y divide-slate-100 max-h-[350px] overflow-y-auto scrollbar-hide">
                    {stageMatches.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                            No Matches Scheduled Yet
                        </div>
                    ) : (
                        stageMatches.map((m: any) => {
                            const isPlaying = normalizeName(m.home_team) === normHome || normalizeName(m.away_team) === normAway ||
                                              normalizeName(m.home_team).includes(normHome) || normalizeName(m.away_team).includes(normAway);
                            const isMatchLive = ['LIVE', '1H', '2H', 'HT', 'ET', 'P', 'IN_PLAY'].includes(m.status?.toUpperCase());

                            return (
                                <div 
                                    key={m.id || m.api_id} 
                                    className={`p-3 transition-colors ${isPlaying ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}
                                >
                                    <div className="flex justify-between items-center text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                                        <span>{m.match_date ? new Date(m.match_date).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}</span>
                                        {isMatchLive ? (
                                            <span className="bg-red-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest animate-pulse flex items-center gap-0.5">
                                                <span className="w-1 h-1 bg-white rounded-full animate-ping"></span> LIVE
                                            </span>
                                        ) : (
                                            <span>{m.status}</span>
                                        )}
                                    </div>
                                    
                                    <div className="space-y-1.5 text-[10px] md:text-xs">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                {m.home_logo ? (
                                                    <img src={m.home_logo} className="w-4 h-4 object-contain" alt="" />
                                                ) : (
                                                    <div className="w-4 h-4 bg-slate-200 rounded-full flex items-center justify-center text-[7px] font-black">H</div>
                                                )}
                                                <span className={`${isPlaying && normalizeName(m.home_team) === normHome ? 'text-blue-700 font-black' : 'text-slate-700'} font-bold truncate max-w-[120px] md:max-w-[160px]`}>
                                                    {m.home_team}
                                                </span>
                                            </div>
                                            <span className={`font-black ${isPlaying && normalizeName(m.home_team) === normHome ? 'text-blue-700' : 'text-slate-900'}`}>{m.home_score}</span>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                {m.away_logo ? (
                                                    <img src={m.away_logo} className="w-4 h-4 object-contain" alt="" />
                                                ) : (
                                                    <div className="w-4 h-4 bg-slate-200 rounded-full flex items-center justify-center text-[7px] font-black">A</div>
                                                )}
                                                <span className={`${isPlaying && normalizeName(m.away_team) === normAway ? 'text-blue-700 font-black' : 'text-slate-700'} font-bold truncate max-w-[120px] md:max-w-[160px]`}>
                                                    {m.away_team}
                                                </span>
                                            </div>
                                            <span className={`font-black ${isPlaying && normalizeName(m.away_team) === normAway ? 'text-blue-700' : 'text-slate-900'}`}>{m.away_score}</span>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center mt-2 pt-1.5 border-t border-slate-100/50 text-[8px] text-slate-400 font-semibold">
                                        <span className="truncate max-w-[120px]">{m.venue || 'Stadium Arena'}</span>
                                        <Link 
                                            href={`/matches?id=${m.api_id || m.id}`}
                                            className="text-blue-600 hover:text-blue-700 font-black uppercase tracking-wider"
                                        >
                                            Details &rarr;
                                        </Link>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        );
    }

    // 🟢 GROUP STAGE / LEAGUE RENDERING
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

    // Sort live table globally
    liveTable.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return b.goal_difference - a.goal_difference;
    });

    liveTable.forEach((team, index) => {
        team.live_position = index + 1;
    });

    // Grouping Standings
    const groupedStandings = liveTable.reduce((acc, team) => {
        const group = team.match_group || 'League';
        if (!acc[group]) acc[group] = [];
        acc[group].push(team);
        return acc;
    }, {} as Record<string, any[]>);

    const groupKeys = Object.keys(groupedStandings).sort();

    // 🟢 Dynamic Group Filtering: Filter to only show the group that the playing teams are in
    let groupKeysToRender = groupKeys;
    if (homeTeam || awayTeam) {
        let detectedGroup = '';
        for (const groupKey of groupKeys) {
            const hasHome = groupedStandings[groupKey].some((t: any) => {
                const tName = normalizeName(t.team_short_name || t.team_name);
                return tName === normHome || tName.includes(normHome);
            });
            const hasAway = groupedStandings[groupKey].some((t: any) => {
                const tName = normalizeName(t.team_short_name || t.team_name);
                return tName === normAway || tName.includes(normAway);
            });
            if (hasHome || hasAway) {
                detectedGroup = groupKey;
                break;
            }
        }
        if (detectedGroup) {
            groupKeysToRender = [detectedGroup];
        }
    } else if (matchGroup) {
        const uppercaseMatchGroup = matchGroup.toUpperCase();
        const found = groupKeys.find(gk => gk.toUpperCase() === uppercaseMatchGroup);
        if (found) {
            groupKeysToRender = [found];
        }
    }

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

            {groupKeysToRender.map((groupKey, groupIdx) => {
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
                                    {displayTable.map((team: any, index: number) => {
                                        const isPlaying = normalizeName(team.team_short_name || team.team_name) === normHome || normalizeName(team.team_short_name || team.team_name) === normAway ||
                                                          normalizeName(team.team_name).includes(normHome) || normalizeName(team.team_name).includes(normAway);
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
            
            {liveTable.length > 8 && groupKeysToRender.includes('League') && (
                <div className="bg-slate-50 text-center py-2 border-t border-slate-200">
                    <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Showing live snippet</span>
                </div>
            )}
        </div>
    );
}