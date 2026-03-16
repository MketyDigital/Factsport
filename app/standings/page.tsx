export const runtime = 'edge';
export const revalidate = 300; // Caches for 5 mins to protect your database

import Link from 'next/link';
import { ChevronLeft, BarChart2, AlertTriangle } from 'lucide-react';
import { createClient } from '@supabase/supabase-js'; 

const LEAGUE_MAP: Record<string, string> = {
    'Premier League': 'PL',
    'La Liga': 'PD',
    'Bundesliga': 'BL1',
    'Serie A': 'SA',
    'Ligue 1': 'FL1',
    'Champions League': 'CL'
};

// 🔥 DYNAMIC METADATA ADDED FOR STANDINGS
export async function generateMetadata({ searchParams }: { searchParams: { league?: string } }) {
    const resolvedParams = await searchParams;
    const league = resolvedParams?.league || 'Premier League';
    return {
        title: `${league} Table & Standings | FactSport`,
        description: `Check the latest ${league} table, points, and current team form. Live updates on the title race and relegation battles.`
    }
}

const normalizeName = (name: string) => {
    if (!name) return "";
    return name.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
        .replace(/[^a-z0-9 ]/g, '') 
        .replace(/\b(fc|cf|afc|sc|sv|rc|fk|vfl|fsv|tsg|ssc|bayer|rcd|ud|as|us|osc|cfa|aja|ca|bc|ac|sk|de)\b/g, '') 
        .replace(/\s+/g, ' ') 
        .trim();
};

async function getStandings(leagueName: string) {
    const leagueCode = LEAGUE_MAP[leagueName] || 'PL'; 
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

    try {
        const { data: dbStandings, error: standingsError } = await supabase
            .from('standings')
            .select('*')
            .eq('league_code', leagueCode)
            .order('position', { ascending: true });

        if (standingsError || !dbStandings || dbStandings.length === 0) {
            return { error: 'No standings data available yet.', data: [] };
        }

        const { data: dbMatches } = await supabase
            .from('matches')
            .select('home_team, away_team, home_score, away_score')
            .eq('league', leagueName)
            .in('status', ['FT', 'FINISHED', 'AWARDED', 'AET', 'PEN'])
            .order('match_date', { ascending: false });

        const teamForms: Record<string, string[]> = {};

        if (dbMatches) {
            dbMatches.forEach((m: any) => {
                const home = normalizeName(m.home_team);
                const away = normalizeName(m.away_team);
                const homeScore = m.home_score;
                const awayScore = m.away_score;

                if (!teamForms[home]) teamForms[home] = [];
                if (!teamForms[away]) teamForms[away] = [];

                if (teamForms[home].length < 5 && homeScore !== null && awayScore !== null) {
                    if (homeScore > awayScore) teamForms[home].push('W');
                    else if (homeScore === awayScore) teamForms[home].push('D');
                    else teamForms[home].push('L');
                }

                if (teamForms[away].length < 5 && homeScore !== null && awayScore !== null) {
                    if (awayScore > homeScore) teamForms[away].push('W');
                    else if (awayScore === homeScore) teamForms[away].push('D');
                    else teamForms[away].push('L');
                }
            });
        }

        const formattedStandings = dbStandings.map((dbEntry: any) => {
            const normalizedTeamName = normalizeName(dbEntry.team_short_name || dbEntry.team_name);
            const customForm = teamForms[normalizedTeamName] || []; 
            
            return {
                position: dbEntry.position,
                team: {
                    id: dbEntry.team_id,
                    name: dbEntry.team_name,
                    shortName: dbEntry.team_short_name || dbEntry.team_name,
                    crest: dbEntry.team_crest
                },
                playedGames: dbEntry.played_games,
                won: dbEntry.won,
                draw: dbEntry.draw,
                lost: dbEntry.lost,
                goalDifference: dbEntry.goal_difference,
                points: dbEntry.points,
                form: customForm.reverse().join(',') 
            };
        });

        return { error: null, data: formattedStandings };

    } catch (error: any) {
        return { error: `Database Error: ${error.message}`, data: [] }; 
    }
}

export default async function StandingsPage({ searchParams }: { searchParams: { league: string } }) {
    const resolvedParams = await searchParams;
    const currentLeague = resolvedParams?.league || 'Premier League';
    
    const validLeague = LEAGUE_MAP[currentLeague] ? currentLeague : 'Premier League';
    const { error, data: standings } = await getStandings(validLeague);
    const totalTeams = standings.length;

    const hasFormData = standings.some((entry: any) => entry.form && entry.form.length > 0);
    const ALL_LEAGUES = Object.keys(LEAGUE_MAP);

    return (
        <div className="min-h-screen bg-[#F0F2F5] text-slate-900 pb-20 font-sans">
            <div className="bg-[#0a1428] text-white p-3 md:p-4 flex items-center gap-3 md:gap-4 sticky top-0 z-50 shadow-lg">
                <Link href="/matches" className="p-1.5 bg-white/10 rounded-full hover:bg-white/20 transition backdrop-blur-sm">
                    <ChevronLeft size={20}/>
                </Link>
                <h1 className="font-bold text-base md:text-lg uppercase tracking-wider flex items-center gap-2">
                    <BarChart2 className="text-blue-500" size={18} /> Standings
                </h1>
            </div>

            <div className="bg-white border-b border-slate-200 sticky top-[52px] md:top-[60px] z-40 overflow-x-auto scrollbar-hide shadow-sm">
                <div className="flex px-2 md:px-4 py-2.5 md:py-3 space-x-1.5 md:space-x-2 min-w-max">
                    {ALL_LEAGUES.map((league) => (
                        <Link 
                            key={league} 
                            href={`/standings?league=${encodeURIComponent(league)}`} 
                            scroll={false} 
                            className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-all ${validLeague === league ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'}`}
                        >
                            {league === 'Premier League' ? 'EPL' : league}
                        </Link>
                    ))}
                </div>
            </div>

            <div className="p-1.5 md:p-4 max-w-5xl mx-auto mt-2">
                
                {error && (
                    <div className="bg-red-50 border-2 border-red-500 text-red-700 p-4 rounded-xl mb-4 shadow-sm flex flex-col items-center text-center">
                        <AlertTriangle size={32} className="mb-2 text-red-500" />
                        <h3 className="font-black uppercase tracking-widest text-sm mb-1">Data Unavailable</h3>
                        <p className="text-xs font-bold">{error}</p>
                    </div>
                )}

                <div className="bg-white rounded-xl md:rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 p-2.5 md:p-4 border-b border-slate-200 flex justify-between items-center">
                         <h2 className="font-black text-slate-700 uppercase tracking-widest text-[10px] md:text-sm">{validLeague} Table</h2>
                    </div>
                    
                    <div className="overflow-x-auto scrollbar-hide">
                        <table className={`w-full text-[10px] md:text-xs ${hasFormData ? 'min-w-[340px] md:min-w-[550px]' : 'min-w-[280px] md:min-w-[400px]'}`}>
                            <thead className="bg-[#f8f9fa] border-b-2 border-slate-200 text-slate-500 font-black uppercase tracking-widest text-[8px] md:text-[9px]">
                                <tr>
                                    <th className="py-2 md:py-3 px-1 md:px-2 text-center w-6 md:w-8">#</th>
                                    <th className="py-2 md:py-3 px-1 md:px-2 text-left">Club</th>
                                    <th className="py-2 md:py-3 px-0.5 md:px-1 text-center w-5 md:w-6" title="Played">P</th>
                                    <th className="py-2 md:py-3 px-0.5 md:px-1 text-center w-5 md:w-6" title="Won">W</th>
                                    <th className="py-2 md:py-3 px-0.5 md:px-1 text-center w-5 md:w-6" title="Drawn">D</th>
                                    <th className="py-2 md:py-3 px-0.5 md:px-1 text-center w-5 md:w-6" title="Lost">L</th>
                                    <th className="py-2 md:py-3 px-0.5 md:px-1 text-center w-6 md:w-8" title="Goal Difference">GD</th>
                                    <th className="py-2 md:py-3 px-1 md:px-2 text-center w-8 md:w-10 text-slate-800" title="Points">Pts</th>
                                    {hasFormData && <th className="py-2 md:py-3 px-1 md:px-2 text-center w-16 md:w-24">Form</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {standings.map((entry: any, index: number) => {
                                    const isUCL = index < 4 && validLeague !== 'Champions League';
                                    const isRelegation = index >= totalTeams - 3 && validLeague !== 'Champions League';

                                    const rawForm = String(entry.form || '');
                                    const formArray = rawForm ? (rawForm.includes(',') ? rawForm.split(',') : rawForm.split('')) : [];
                                    
                                    const teamName = entry.team.shortName || entry.team.name;
                                    
                                    const safeUrlName = teamName.replace(/['"]/g, '');

                                    return (
                                        <tr key={entry.team.id} className={`hover:bg-slate-50 transition-colors ${isUCL ? 'bg-blue-50/20' : ''} ${isRelegation ? 'bg-red-50/20' : ''}`}>
                                            <td className="py-2 md:py-2.5 px-1 md:px-2 relative text-center font-bold text-slate-500">
                                                {isUCL && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r-sm"></div>}
                                                {isRelegation && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 rounded-r-sm"></div>}
                                                {entry.position}
                                            </td>
                                            
                                            <td className="py-2 md:py-2.5 px-1 md:px-2 font-black text-slate-800">
                                                <Link 
                                                    href={`/matches?team=${encodeURIComponent(safeUrlName)}`}
                                                    className="flex items-center gap-1.5 md:gap-2 hover:text-blue-600 transition-colors group cursor-pointer"
                                                >
                                                    {entry.team.crest ? (
                                                        <img src={entry.team.crest} className="w-3.5 h-3.5 md:w-5 md:h-5 object-contain drop-shadow-sm group-hover:scale-110 transition-transform" alt="" />
                                                    ) : (
                                                        <div className="w-3.5 h-3.5 md:w-5 md:h-5 bg-slate-200 rounded-full"></div>
                                                    )}
                                                    <span className="truncate max-w-[90px] md:max-w-[200px]">{teamName}</span>
                                                </Link>
                                            </td>

                                            <td className="py-2 md:py-2.5 px-0.5 md:px-1 text-center text-slate-500 font-medium">{entry.playedGames}</td>
                                            <td className="py-2 md:py-2.5 px-0.5 md:px-1 text-center text-slate-500">{entry.won}</td>
                                            <td className="py-2 md:py-2.5 px-0.5 md:px-1 text-center text-slate-500">{entry.draw}</td>
                                            <td className="py-2 md:py-2.5 px-0.5 md:px-1 text-center text-slate-500">{entry.lost}</td>
                                            <td className="py-2 md:py-2.5 px-0.5 md:px-1 text-center font-bold text-slate-600">{entry.goalDifference > 0 ? `+${entry.goalDifference}` : entry.goalDifference}</td>
                                            <td className="py-2 md:py-2.5 px-1 md:px-2 text-center font-black text-[11px] md:text-sm text-slate-900 bg-slate-50/50">{entry.points}</td>
                                            
                                            {hasFormData && (
                                                <td className="py-2 md:py-2.5 px-1 md:px-2 text-center">
                                                    <div className="flex items-center justify-center gap-0.5">
                                                        {formArray.map((result: string, i: number) => (
                                                            <span key={i} className={`w-3 h-3 md:w-3.5 md:h-3.5 flex items-center justify-center text-[6px] md:text-[7px] font-black text-white rounded-[2px] md:rounded-sm ${result === 'W' ? 'bg-green-500' : result === 'L' ? 'bg-red-500' : 'bg-slate-400'}`}>
                                                                {result}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {standings.length === 0 && !error && (
                        <div className="p-10 md:p-16 text-center text-slate-400 flex flex-col items-center">
                            <BarChart2 size={32} className="mb-2 md:mb-3 opacity-20" />
                            <span className="font-bold uppercase tracking-widest text-[9px] md:text-[10px]">Table currently unavailable</span>
                        </div>
                    )}
                </div>
                
                {standings.length > 0 && validLeague !== 'Champions League' && (
                    <div className="flex justify-center gap-3 md:gap-4 mt-3 md:mt-4 text-[8px] md:text-[9px] font-bold uppercase tracking-widest text-slate-500">
                        <div className="flex items-center gap-1 md:gap-1.5"><span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-blue-500"></span> Champions League</div>
                        <div className="flex items-center gap-1 md:gap-1.5"><span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-red-500"></span> Relegation</div>
                    </div>
                )}
            </div>
        </div>
    );
}