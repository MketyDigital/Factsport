export const runtime = 'edge';
export const revalidate = 300; 

import Link from 'next/link';
import { Metadata } from 'next';
import { ChevronLeft, BarChart2, AlertTriangle } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { listCurrentCompetitionStandings } from '@/lib/adapters/postgres-homepage';
import { serializeJsonLd } from '@/lib/seo/json-ld';
import LeagueLeaders from '@/app/components/LeagueLeaders'; 

const LEAGUE_MAP: Record<string, string> = {
    'Premier League': 'PL',
    'La Liga': 'PD',
    'Bundesliga': 'BL1',
    'Serie A': 'SA',
    'Ligue 1': 'FL1',
    'Champions League': 'CL',
    'World Cup': 'WC',       // 🟢 ADDED TOURNAMENTS
    'Euros': 'EC',
    'Copa America': 'CLI',
    'AFCON': 'AFCON'
};

export async function generateMetadata({ searchParams }: { searchParams: Promise<any> }): Promise<Metadata> {
    const resolvedParams = await searchParams;
    const requestedLeague = typeof resolvedParams?.league === 'string' ? resolvedParams.league : '';
    const league = Object.prototype.hasOwnProperty.call(LEAGUE_MAP, requestedLeague)
      ? requestedLeague : 'Premier League';
    const title = `${league} Table & Standings | FactSport`;
    const description = `Check the latest ${league} table, points, and current team form. Live updates on the title race and relegation battles.`;
    // Reuse the existing branded Media Open Graph renderer, with approved
    // league metadata only. Never fabricate ranks or standings results.
    const payload = JSON.stringify({ type: 'standings', league, label: 'League standings' });
    const bytes = new TextEncoder().encode(payload);
    const raw = Array.from(bytes, byte => String.fromCodePoint(byte)).join('');
    const data = btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://factsport.com';
    const ogImage = `${appUrl}/api/og?data=${data}`;
    
    return {
        title,
        description,
        openGraph: {
            title,
            description,
            type: 'website',
            siteName: 'FactSport',
            images: [{ url: ogImage, width: 1200, height: 630, alt: `${league} standings – FactSport` }],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [ogImage],
        }
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
    let dbStandings: any[] = [];
    let dbMatches: any[] = [];
    try {
        if (process.env.FACTSPORT_COMPETITIONS_BACKEND === 'postgres') {
            dbStandings = await listCurrentCompetitionStandings(leagueCode);
        } else if (process.env.NODE_ENV === 'development') {
            const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
            const [standingsResult, matchesResult] = await Promise.all([
                supabase.from('standings').select('*').eq('league_code', leagueCode)
                    .order('match_group', { ascending: true }).order('position', { ascending: true }),
                supabase.from('matches').select('home_team, away_team, home_score, away_score')
                    .eq('league', leagueName)
                    .in('status', ['FT', 'FINISHED', 'AWARDED', 'AET', 'PEN'])
                    .order('match_date', { ascending: false }),
            ]);
            if (standingsResult.error) throw standingsResult.error;
            dbStandings = standingsResult.data || [];
            dbMatches = matchesResult.data || [];
        } else {
            return { error: 'V2 competition standings are not provisioned.', data: [] };
        }

        if (dbStandings.length === 0) {
            return { error: 'No standings data available yet.', data: [] };
        }

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
            const providerForm = process.env.FACTSPORT_COMPETITIONS_BACKEND === 'postgres'
                ? String(dbEntry.form || '').split(',').filter((result: string) => ['W', 'D', 'L'].includes(result))
                : [];
            const customForm = providerForm.length > 0 ? providerForm : (teamForms[normalizedTeamName] || []);
            
            return {
                position: dbEntry.position,
                match_group: dbEntry.match_group, // 🟢 PASS GROUP
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
                form: providerForm.length > 0 ? providerForm.join(',') : customForm.reverse().join(',') 
            };
        });

        return { error: null, data: formattedStandings };

    } catch {
        return { error: 'Standings are temporarily unavailable.', data: [] };
    }
}

export default async function StandingsPage({ searchParams }: { searchParams: Promise<any> }) {
    const resolvedParams = await searchParams;
    const currentLeague = resolvedParams?.league || 'Premier League';
    
    const validLeague = LEAGUE_MAP[currentLeague] ? currentLeague : 'Premier League';
    const { error, data: standings } = await getStandings(validLeague);

    const hasFormData = standings.some((entry: any) => entry.form && entry.form.length > 0);
    const ALL_LEAGUES = Object.keys(LEAGUE_MAP);

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: `${validLeague} Table & Standings | FactSport`,
        description: `Check the latest ${validLeague} table, points, and current team form.`,
        url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://factsport.com'}/standings?league=${encodeURIComponent(validLeague)}`
    };

    // 🟢 Group the standings if it's a cup
    const groupedStandings = standings.reduce((acc: any, team: any) => {
        const group = team.match_group || 'League';
        if (!acc[group]) acc[group] = [];
        acc[group].push(team);
        return acc;
    }, {});
    const groupKeys = Object.keys(groupedStandings).sort();

    return (
        <div className="min-h-screen bg-[#F0F2F5] text-slate-900 pb-20 font-sans">
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />

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

                <div className="flex flex-col lg:flex-row gap-4 mt-4">
                    <div className="w-full lg:w-2/3 fs-visual-panel overflow-hidden">
                        <div className="bg-slate-50 p-2.5 md:p-4 border-b border-slate-200 flex justify-between items-center">
                             <h2 className="font-black text-slate-700 uppercase tracking-widest text-[10px] md:text-sm">{validLeague} Table</h2>
                        </div>
                        
                        {/* 🟢 DYNAMICALLY RENDERS GROUPS OR LEAGUE */}
                        {groupKeys.map((groupKey, idx) => {
                            const tableGroup = groupedStandings[groupKey];
                            const totalTeams = tableGroup.length;
                            return (
                            <div key={groupKey} className={idx > 0 ? "border-t-4 border-slate-100" : ""}>
                                {groupKey !== 'League' && (
                                    <div className="bg-slate-100/80 px-4 py-2 border-b border-slate-200">
                                        <span className="text-xs font-black text-slate-700 uppercase tracking-widest">{groupKey}</span>
                                    </div>
                                )}
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
                                            {tableGroup.map((entry: any, index: number) => {
                                                const isUCL = index < 4 && validLeague !== 'Champions League' && groupKey === 'League';
                                                const isRelegation = index >= totalTeams - 3 && validLeague !== 'Champions League' && groupKey === 'League';

                                                const rawForm = String(entry.form || '');
                                                const formArray = rawForm ? (rawForm.includes(',') ? rawForm.split(',') : rawForm.split('')) : [];
                                                
                                                const teamName = entry.team.shortName || entry.team.name;
                                                const safeUrlName = teamName.replace(/['"]/g, '');

                                                return (
                                                    <tr key={entry.team.id} className={`hover:bg-slate-50 transition-colors ${isUCL ? 'bg-blue-50/40' : ''} ${isRelegation ? 'bg-rose-50/40' : ''}`}>
                                                        <td className="py-2 md:py-2.5 px-1 md:px-2 relative text-center font-bold text-slate-500">
                                                            {isUCL && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r-sm"></div>}
                                                            {isRelegation && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 rounded-r-sm"></div>}
                                                            <span className={`fs-standings-rank ${isUCL ? 'bg-blue-100 text-blue-700' : isRelegation ? 'bg-rose-100 text-rose-700' : ''}`} aria-label={`Position ${entry.position}`}>{entry.position}</span>
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
                                                    <td className="py-2 md:py-2.5 px-1 md:px-2 text-center"><span className="inline-flex min-w-8 justify-center rounded-lg bg-slate-900 px-2 py-1 text-xs font-black tabular-nums text-white">{entry.points}</span></td>
                                                    
                                                    {hasFormData && (
                                                        <td className="py-2 md:py-2.5 px-1 md:px-2 text-center">
                                                            <div className="flex items-center justify-center gap-0.5">
                                                                {formArray.map((result: string, i: number) => (
                                                                    <span key={i} title={result === 'W' ? 'Win' : result === 'L' ? 'Loss' : 'Draw'} aria-label={result === 'W' ? 'Win' : result === 'L' ? 'Loss' : 'Draw'} className={`w-4 h-4 md:w-5 md:h-5 flex items-center justify-center text-[8px] font-black text-white rounded-md ${result === 'W' ? 'bg-emerald-600' : result === 'L' ? 'bg-rose-600' : 'bg-slate-500'}`}>
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
                        </div>
                        );
                    })}

                    {standings.length === 0 && !error && (
                        <div className="p-10 md:p-16 text-center text-slate-400 flex flex-col items-center">
                            <BarChart2 size={32} className="mb-2 md:mb-3 opacity-20" />
                            <span className="font-bold uppercase tracking-widest text-[9px] md:text-[10px]">Table currently unavailable</span>
                        </div>
                    )}
                </div>

                <div className="w-full lg:w-1/3 flex flex-col gap-4">
                    {standings.length > 0 && validLeague !== 'Champions League' && (
                        <div className="flex justify-center gap-3 md:gap-4 text-[8px] md:text-[9px] font-bold uppercase tracking-widest text-slate-500 bg-white p-3 rounded-xl border border-slate-200">
                            <div className="flex items-center gap-1 md:gap-1.5"><span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-blue-500"></span> Champions League</div>
                            <div className="flex items-center gap-1 md:gap-1.5"><span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-red-500"></span> Relegation</div>
                        </div>
                    )}

                    {standings.length > 0 && (
                        <LeagueLeaders leagueName={validLeague} />
                    )}
                </div>
                </div>

                <div className="mt-8">
                </div>
            </div>
        </div>
    );
}