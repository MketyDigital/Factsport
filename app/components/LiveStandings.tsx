'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Trophy, ChevronUp, ChevronDown, Minus } from 'lucide-react';

const LEAGUE_MAP: Record<string, string> = {
    'Premier League': 'PL',
    'La Liga': 'PD',
    'Bundesliga': 'BL1',
    'Serie A': 'SA',
    'Ligue 1': 'FL1',
    'Champions League': 'CL'
};

// 🟢 Uses your exact normalizer to guarantee team matching!
const normalizeName = (name: string) => {
    if (!name) return "";
    return name.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
        .replace(/[^a-z0-9 ]/g, '') 
        .replace(/\b(fc|cf|afc|sc|sv|rc|fk|vfl|fsv|tsg|ssc|bayer|rcd|ud|as|us|osc|cfa|aja|ca|bc|ac|sk|de)\b/g, '') 
        .replace(/\s+/g, ' ') 
        .trim();
};

export default function LiveStandings({ leagueName, homeTeam, awayTeam, homeScore, awayScore, status }: any) {
    const [standings, setStandings] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchStandings = async () => {
            const leagueCode = LEAGUE_MAP[leagueName];
            if (!leagueCode) {
                setIsLoading(false);
                return; // Cup matches or unsupported leagues won't show a table
            }

            const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
            const { data } = await supabase
                .from('standings')
                .select('*')
                .eq('league_code', leagueCode)
                .order('position', { ascending: true });

            if (data) setStandings(data);
            setIsLoading(false);
        };
        fetchStandings();
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
                <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Table not available for this competition</div>
            </div>
        );
    }

    // Only apply live math if the match is actively playing. If FT, the DB is already correct.
    const isLive = ['LIVE', 'IN_PLAY', '1H', '2H', 'HT', 'ET', 'P'].includes(status?.toUpperCase());

    // 🟢 THE LIVE MATH ENGINE
    let liveTable = [...standings].map(team => ({ ...team, original_position: team.position }));

    const normHome = normalizeName(homeTeam);
    const normAway = normalizeName(awayTeam);

    if (isLive) {
        const hScore = parseInt(homeScore) || 0;
        const aScore = parseInt(awayScore) || 0;

        const homeRef = liveTable.find(t => normalizeName(t.team_short_name || t.team_name) === normHome || normalizeName(t.team_name).includes(normHome));
        const awayRef = liveTable.find(t => normalizeName(t.team_short_name || t.team_name) === normAway || normalizeName(t.team_name).includes(normAway));

        if (homeRef && awayRef) {
            // Update Played Games
            homeRef.played_games += 1;
            awayRef.played_games += 1;

            // Update Goal Difference
            homeRef.goal_difference += (hScore - aScore);
            awayRef.goal_difference += (aScore - hScore);

            // Update Points & W/D/L
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

    // Re-sort the table based on live points and goal difference
    liveTable.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return b.goal_difference - a.goal_difference;
    });

    // Re-assign live positions
    liveTable.forEach((team, index) => {
        team.live_position = index + 1;
    });

    // Find our teams to slice the table down to a snippet
    const homeIndex = liveTable.findIndex(t => normalizeName(t.team_short_name || t.team_name) === normHome || normalizeName(t.team_name).includes(normHome));
    const awayIndex = liveTable.findIndex(t => normalizeName(t.team_short_name || t.team_name) === normAway || normalizeName(t.team_name).includes(normAway));
    
    let displayTable = liveTable;
    if (liveTable.length > 8 && homeIndex !== -1 && awayIndex !== -1) {
        const minIdx = Math.min(homeIndex, awayIndex);
        const maxIdx = Math.max(homeIndex, awayIndex);
        
        // Snippet Logic: Keep them together if close, otherwise show top of table or a wider range
        if (maxIdx - minIdx > 6) {
             // If teams are far apart (e.g. 1st vs 18th), just show the top 8
             displayTable = liveTable.slice(0, 8); 
        } else {
             // Show their neighborhood
             const start = Math.max(0, minIdx - 2);
             const end = Math.min(liveTable.length, maxIdx + 3);
             displayTable = liveTable.slice(start, end);
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
                        {displayTable.map((team) => {
                            const isPlaying = normalizeName(team.team_short_name || team.team_name) === normHome || normalizeName(team.team_short_name || team.team_name) === normAway;
                            
                            // Calculate if they moved up or down due to the live score
                            const posChange = team.original_position - team.live_position;

                            return (
                                <tr key={team.id} className={`border-b border-slate-50 text-[10px] md:text-xs font-bold transition-colors ${isPlaying ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}>
                                    <td className="p-2.5 text-center flex flex-col items-center justify-center">
                                        <span className={`${isPlaying ? 'text-blue-700 font-black' : 'text-slate-600'}`}>{team.live_position}</span>
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
                            );
                        })}
                    </tbody>
                </table>
            </div>
            
            {liveTable.length > 8 && (
                <div className="bg-slate-50 text-center py-2 border-t border-slate-200">
                    <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Showing live snippet</span>
                </div>
            )}
        </div>
    );
}