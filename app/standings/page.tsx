export const runtime = 'edge';

import Link from 'next/link';
import { ChevronLeft, BarChart2 } from 'lucide-react';

const LEAGUE_MAP: Record<string, string> = {
    'Premier League': 'eng.1',
    'La Liga': 'esp.1',
    'Bundesliga': 'ger.1',
    'Serie A': 'ita.1',
    'Ligue 1': 'fra.1',
    'Champions League': 'uefa.champions'
};

async function getStandings(leagueName: string) {
    const leagueId = LEAGUE_MAP[leagueName] || 'eng.1'; // Fallback to EPL

    try {
        const res = await fetch(`https://site.api.espn.com/apis/v2/sports/soccer/${leagueId}/standings`, {
            next: { revalidate: 3600 } // Super safe caching: only hits ESPN once per hour per league
        });
        
        if (!res.ok) return null;
        return await res.json();
    } catch (error) {
        console.error("ESPN Standings Fetch Error:", error);
        return null; // Prevents the whole page from crashing if ESPN is down
    }
}

export default async function StandingsPage({ searchParams }: { searchParams: { league: string } }) {
    // Await searchParams in Next.js 15+ compatible way
    const resolvedParams = await searchParams;
    const currentLeague = resolvedParams?.league || 'Premier League';
    
    // If someone passes a weird league name, fallback safely
    const validLeague = LEAGUE_MAP[currentLeague] ? currentLeague : 'Premier League';
    
    const data = await getStandings(validLeague);
    const standings = data?.children?.[0]?.standings?.entries || [];
    const totalTeams = standings.length;

    const ALL_LEAGUES = Object.keys(LEAGUE_MAP);

    return (
        <div className="min-h-screen bg-[#F0F2F5] text-slate-900 pb-20 font-sans">
            {/* Header */}
            <div className="bg-[#0a1428] text-white p-4 flex items-center gap-4 sticky top-0 z-50 shadow-lg">
                <Link href="/matches" className="p-1.5 bg-white/10 rounded-full hover:bg-white/20 transition backdrop-blur-sm">
                    <ChevronLeft size={20}/>
                </Link>
                <h1 className="font-black text-lg uppercase tracking-wider flex items-center gap-2">
                    <BarChart2 className="text-blue-500" size={18} /> Standings
                </h1>
            </div>

            {/* 🔥 NEW: Dynamic League Navigator */}
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

            <div className="p-4 max-w-4xl mx-auto mt-2">
                <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                         <h2 className="font-black text-slate-700 uppercase tracking-widest text-sm">{validLeague} Table</h2>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs min-w-[400px]">
                            <thead className="bg-[#f8f9fa] border-b-2 border-slate-200 text-slate-500 font-black uppercase tracking-widest text-[9px]">
                                <tr>
                                    <th className="py-4 px-3 text-center w-10">Pos</th>
                                    <th className="py-4 px-3 text-left">Club</th>
                                    <th className="py-4 px-2 text-center w-8">Pl</th>
                                    <th className="py-4 px-2 text-center w-8">GD</th>
                                    <th className="py-4 px-3 text-center w-12 text-slate-800">Pts</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {standings.map((entry: any, index: number) => {
                                    const stats = entry.stats;
                                    const played = stats.find((s:any) => s.name === 'gamesPlayed')?.value || 0;
                                    const points = stats.find((s:any) => s.name === 'points')?.value || 0;
                                    const gd = stats.find((s:any) => s.name === 'pointDifferential')?.value || 0;

                                    const isUCL = index < 4 && validLeague !== 'Champions League';
                                    const isRelegation = index >= totalTeams - 3 && validLeague !== 'Champions League';

                                    return (
                                        <tr key={entry.team.id} className={`hover:bg-slate-50 transition-colors ${isUCL ? 'bg-blue-50/20' : ''} ${isRelegation ? 'bg-red-50/20' : ''}`}>
                                            <td className="py-3 px-3 relative text-center font-bold text-slate-500">
                                                {isUCL && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r-sm"></div>}
                                                {isRelegation && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 rounded-r-sm"></div>}
                                                {index + 1}
                                            </td>
                                            <td className="py-3 px-3 font-black text-slate-800 flex items-center gap-3">
                                                {entry.team.logos?.[0]?.href ? (
                                                    <img src={entry.team.logos[0].href} className="w-6 h-6 object-contain drop-shadow-sm" alt="" />
                                                ) : (
                                                    <div className="w-6 h-6 bg-slate-200 rounded-full"></div>
                                                )}
                                                <span className="truncate">{entry.team.shortDisplayName || entry.team.name}</span>
                                            </td>
                                            <td className="py-3 px-2 text-center text-slate-500 font-medium">{played}</td>
                                            <td className="py-3 px-2 text-center font-bold text-slate-600">{gd > 0 ? `+${gd}` : gd}</td>
                                            <td className="py-3 px-3 text-center font-black text-sm text-slate-900 bg-slate-50/50">{points}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {standings.length === 0 && (
                        <div className="p-16 text-center text-slate-400 flex flex-col items-center">
                            <BarChart2 size={40} className="mb-3 opacity-20" />
                            <span className="font-bold uppercase tracking-widest text-[10px]">Table currently unavailable</span>
                            <span className="text-[9px] mt-2">Data will refresh automatically.</span>
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