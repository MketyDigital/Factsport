export const runtime = 'edge';

import Link from 'next/link';
import { ChevronLeft, BarChart2, AlertTriangle } from 'lucide-react';

// 🟢 Mapped to Football-Data.org League Codes
const LEAGUE_MAP: Record<string, string> = {
    'Premier League': 'PL',
    'La Liga': 'PD',
    'Bundesliga': 'BL1',
    'Serie A': 'SA',
    'Ligue 1': 'FL1',
    'Champions League': 'CL'
};

async function getStandings(leagueName: string) {
    const leagueCode = LEAGUE_MAP[leagueName] || 'PL'; 
    const apiKey = process.env.FOOTBALL_DATA_KEY;

    if (!apiKey) {
        return { error: 'FATAL: Missing FOOTBALL_DATA_KEY.', data: [] };
    }

    try {
        const standingsRes = await fetch(`https://api.football-data.org/v4/competitions/${leagueCode}/standings`, {
            headers: { 'X-Auth-Token': apiKey },
            next: { revalidate: 3600 } 
        });
        
        if (standingsRes.status === 429) return { error: 'API Rate Limit Hit. Wait 60 seconds.', data: [] };
        if (!standingsRes.ok) return { error: `API Error: ${standingsRes.status}`, data: [] };
        
        const standingsJson = await standingsRes.json();
        const standingsData = standingsJson?.standings?.[0]?.table || [];

        // 🟢 THE JEDI MIND TRICK: Fetch all finished matches to calculate form manually!
        try {
            const matchesRes = await fetch(`https://api.football-data.org/v4/competitions/${leagueCode}/matches?status=FINISHED`, {
                headers: { 'X-Auth-Token': apiKey },
                next: { revalidate: 3600 }
            });

            if (matchesRes.ok) {
                const matchesJson = await matchesRes.json();
                const allMatches = matchesJson.matches || [];
                
                allMatches.sort((a: any, b: any) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime());

                const teamForms: Record<number, string[]> = {};

                allMatches.forEach((m: any) => {
                    const homeId = m.homeTeam?.id;
                    const awayId = m.awayTeam?.id;
                    const homeScore = m.score?.fullTime?.home;
                    const awayScore = m.score?.fullTime?.away;

                    if (!teamForms[homeId]) teamForms[homeId] = [];
                    if (!teamForms[awayId]) teamForms[awayId] = [];

                    if (teamForms[homeId].length < 5 && homeScore !== null && awayScore !== null) {
                        if (homeScore > awayScore) teamForms[homeId].push('W');
                        else if (homeScore === awayScore) teamForms[homeId].push('D');
                        else teamForms[homeId].push('L');
                    }

                    if (teamForms[awayId].length < 5 && homeScore !== null && awayScore !== null) {
                        if (awayScore > homeScore) teamForms[awayId].push('W');
                        else if (awayScore === homeScore) teamForms[awayId].push('D');
                        else teamForms[awayId].push('L');
                    }
                });

                standingsData.forEach((entry: any) => {
                    const customForm = teamForms[entry.team.id] || [];
                    entry.form = customForm.reverse().join(','); 
                });
            }
        } catch (matchErr) {
            console.error("Silent fail on custom form calculation:", matchErr);
        }

        return { error: null, data: standingsData };
    } catch (error: any) {
        return { error: `Server Connection Failed: ${error.message}`, data: [] }; 
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
            <div className="bg-[#0a1428] text-white p-4 flex items-center gap-4 sticky top-0 z-50 shadow-lg">
                <Link href="/matches" className="p-1.5 bg-white/10 rounded-full hover:bg-white/20 transition backdrop-blur-sm">
                    <ChevronLeft size={20}/>
                </Link>
                <h1 className="font-bold text-lg uppercase tracking-wider flex items-center gap-2">
                    <BarChart2 className="text-blue-500" size={18} /> Standings
                </h1>
            </div>

            <div className="bg-white border-b border-slate-200 sticky top-[60px] z-40 overflow-x-auto scrollbar-hide shadow-sm">
                <div className="flex px-4 py-3 space-x-2 min-w-max">
                    {ALL_LEAGUES.map((league) => (
                        <Link 
                            key={league} 
                            href={`/standings?league=${encodeURIComponent(league)}`} 
                            scroll={false} 
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${validLeague === league ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'}`}
                        >
                            {league === 'Premier League' ? 'EPL' : league}
                        </Link>
                    ))}
                </div>
            </div>

            <div className="p-2 md:p-4 max-w-5xl mx-auto mt-2">
                
                {error && (
                    <div className="bg-red-50 border-2 border-red-500 text-red-700 p-4 rounded-xl mb-4 shadow-sm flex flex-col items-center text-center">
                        <AlertTriangle size={32} className="mb-2 text-red-500" />
                        <h3 className="font-black uppercase tracking-widest text-sm mb-1">API Connection Failed</h3>
                        <p className="text-xs font-bold">{error}</p>
                    </div>
                )}

                <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 p-3 md:p-4 border-b border-slate-200 flex justify-between items-center">
                         <h2 className="font-black text-slate-700 uppercase tracking-widest text-xs md:text-sm">{validLeague} Table</h2>
                    </div>
                    
                    <div className="overflow-x-auto scrollbar-hide">
                        <table className={`w-full text-xs ${hasFormData ? 'min-w-[550px]' : 'min-w-[400px]'}`}>
                            <thead className="bg-[#f8f9fa] border-b-2 border-slate-200 text-slate-500 font-black uppercase tracking-widest text-[9px]">
                                <tr>
                                    <th className="py-3 px-2 text-center w-8">#</th>
                                    <th className="py-3 px-2 text-left">Club</th>
                                    <th className="py-3 px-1 text-center w-6" title="Played">P</th>
                                    <th className="py-3 px-1 text-center w-6" title="Won">W</th>
                                    <th className="py-3 px-1 text-center w-6" title="Drawn">D</th>
                                    <th className="py-3 px-1 text-center w-6" title="Lost">L</th>
                                    <th className="py-3 px-1 text-center w-8" title="Goal Difference">GD</th>
                                    <th className="py-3 px-2 text-center w-10 text-slate-800" title="Points">Pts</th>
                                    {hasFormData && <th className="py-3 px-2 text-center w-24">Form</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {standings.map((entry: any, index: number) => {
                                    const isUCL = index < 4 && validLeague !== 'Champions League';
                                    const isRelegation = index >= totalTeams - 3 && validLeague !== 'Champions League';

                                    const rawForm = String(entry.form || '');
                                    const formArray = rawForm ? (rawForm.includes(',') ? rawForm.split(',') : rawForm.split('')) : [];
                                    
                                    const teamName = entry.team.shortName || entry.team.name;

                                    return (
                                        <tr key={entry.team.id} className={`hover:bg-slate-50 transition-colors ${isUCL ? 'bg-blue-50/20' : ''} ${isRelegation ? 'bg-red-50/20' : ''}`}>
                                            <td className="py-2.5 px-2 relative text-center font-bold text-slate-500">
                                                {isUCL && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r-sm"></div>}
                                                {isRelegation && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 rounded-r-sm"></div>}
                                                {entry.position}
                                            </td>
                                            
                                            {/* 🟢 THE CLICKABLE TEAM LINK IN THE TABLE */}
                                            <td className="py-2.5 px-2 font-black text-slate-800">
                                                <Link 
                                                    href={`/matches?team=${encodeURIComponent(teamName)}`}
                                                    className="flex items-center gap-2 hover:text-blue-600 transition-colors group cursor-pointer"
                                                >
                                                    {entry.team.crest ? (
                                                        <img src={entry.team.crest} className="w-5 h-5 object-contain drop-shadow-sm group-hover:scale-110 transition-transform" alt="" />
                                                    ) : (
                                                        <div className="w-5 h-5 bg-slate-200 rounded-full"></div>
                                                    )}
                                                    <span className="truncate max-w-[120px] md:max-w-[200px]">{teamName}</span>
                                                </Link>
                                            </td>

                                            <td className="py-2.5 px-1 text-center text-slate-500 font-medium">{entry.playedGames}</td>
                                            <td className="py-2.5 px-1 text-center text-slate-500">{entry.won}</td>
                                            <td className="py-2.5 px-1 text-center text-slate-500">{entry.draw}</td>
                                            <td className="py-2.5 px-1 text-center text-slate-500">{entry.lost}</td>
                                            <td className="py-2.5 px-1 text-center font-bold text-slate-600">{entry.goalDifference > 0 ? `+${entry.goalDifference}` : entry.goalDifference}</td>
                                            <td className="py-2.5 px-2 text-center font-black text-sm text-slate-900 bg-slate-50/50">{entry.points}</td>
                                            
                                            {hasFormData && (
                                                <td className="py-2.5 px-2 text-center">
                                                    <div className="flex items-center justify-center gap-0.5">
                                                        {formArray.map((result: string, i: number) => (
                                                            <span key={i} className={`w-3.5 h-3.5 flex items-center justify-center text-[7px] font-black text-white rounded-sm ${result === 'W' ? 'bg-green-500' : result === 'L' ? 'bg-red-500' : 'bg-slate-400'}`}>
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
                        <div className="p-16 text-center text-slate-400 flex flex-col items-center">
                            <BarChart2 size={40} className="mb-3 opacity-20" />
                            <span className="font-bold uppercase tracking-widest text-[10px]">Table currently unavailable</span>
                        </div>
                    )}
                </div>
                
                {standings.length > 0 && validLeague !== 'Champions League' && (
                    <div className="flex justify-center gap-4 mt-4 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Champions League</div>
                        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500"></span> Relegation</div>
                    </div>
                )}
            </div>
        </div>
    );
}