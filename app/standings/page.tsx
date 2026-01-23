// ✅ RUNS ON EDGE
export const runtime = 'edge';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

// Map your database league names to ESPN IDs
const LEAGUE_MAP: Record<string, string> = {
    'Premier League': 'eng.1',
    'English Premier League': 'eng.1',
    'La Liga': 'esp.1',
    'Spanish LALIGA': 'esp.1',
    'Bundesliga': 'ger.1',
    'German Bundesliga': 'ger.1',
    'Serie A': 'ita.1',
    'Italian Serie A': 'ita.1',
    'Ligue 1': 'fra.1',
    'French Ligue 1': 'fra.1',
    'Champions League': 'uefa.champions',
    'UEFA Champions League': 'uefa.champions'
};

async function getStandings(leagueName: string) {
    const leagueId = LEAGUE_MAP[leagueName];
    if (!leagueId) return null;

    const res = await fetch(`https://site.api.espn.com/apis/v2/sports/soccer/${leagueId}/standings`, {
        next: { revalidate: 3600 } // Cache for 1 hour
    });
    
    if (!res.ok) return null;
    return res.json();
}

export default async function StandingsPage({ searchParams }: { searchParams: { league: string } }) {
    const leagueName = searchParams.league || 'Premier League';
    const data = await getStandings(leagueName);
    const standings = data?.children?.[0]?.standings?.entries || [];

    return (
        <div className="min-h-screen bg-[#F0F2F5] text-slate-900 pb-20">
            <div className="bg-[#0a1428] text-white p-4 flex items-center gap-4 sticky top-0 z-50 shadow-md">
                <Link href="/matches"><ChevronLeft /></Link>
                <h1 className="font-bold text-lg">{leagueName} Table</h1>
            </div>

            <div className="p-4">
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    <table className="w-full text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                            <tr>
                                <th className="p-3 text-left w-10">#</th>
                                <th className="p-3 text-left">Team</th>
                                <th className="p-3 text-center">P</th>
                                <th className="p-3 text-center">GD</th>
                                <th className="p-3 text-center font-black text-slate-800">Pts</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {standings.map((entry: any, index: number) => {
                                const stats = entry.stats;
                                const played = stats.find((s:any) => s.name === 'gamesPlayed')?.value;
                                const points = stats.find((s:any) => s.name === 'points')?.value;
                                const gd = stats.find((s:any) => s.name === 'pointDifferential')?.value;

                                return (
                                    <tr key={entry.team.id} className={index < 4 ? 'bg-blue-50/30' : ''}>
                                        <td className="p-3 font-bold text-slate-400">{index + 1}</td>
                                        <td className="p-3 font-bold text-slate-800 flex items-center gap-2">
                                            {entry.team.logos?.[0]?.href && (
                                                <img src={entry.team.logos[0].href} className="w-5 h-5 object-contain" alt="" />
                                            )}
                                            {entry.team.shortDisplayName}
                                        </td>
                                        <td className="p-3 text-center text-slate-500">{played}</td>
                                        <td className="p-3 text-center text-slate-500">{gd > 0 ? `+${gd}` : gd}</td>
                                        <td className="p-3 text-center font-black text-slate-900">{points}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {standings.length === 0 && (
                        <div className="p-8 text-center text-slate-400">
                            Standings not available for this competition.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}