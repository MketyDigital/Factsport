import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { ChevronRight, BarChart2 } from 'lucide-react';

const LEAGUE_MAP: Record<string, string> = {
    'Premier League': 'PL',
    'La Liga': 'PD',
    'Bundesliga': 'BL1',
    'Serie A': 'SA',
    'Ligue 1': 'FL1',
    'Champions League': 'CL'
};

export default async function MiniStandings({ leagueName = 'Premier League' }: { leagueName?: string }) {
    if (leagueName === 'Champions League') return null; // UCL format doesn't fit mini well

    const leagueCode = LEAGUE_MAP[leagueName] || 'PL'; 
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

    const { data: dbStandings } = await supabase
        .from('standings')
        .select('team_name, team_short_name, position, played_games, points')
        .eq('league_code', leagueCode)
        .order('position', { ascending: true });

    if (!dbStandings || dbStandings.length === 0) return null;

    const total = dbStandings.length;
    // Get Top 5 and Bottom 3
    const topTeams = dbStandings.slice(0, 5);
    const bottomTeams = dbStandings.slice(Math.max(5, total - 3));

    const renderRow = (team: any, isRelegation: boolean = false) => (
        <div key={team.team_name} className={`flex items-center justify-between py-1.5 px-2 text-[10px] border-b border-slate-100 last:border-0 ${isRelegation ? 'bg-red-50/30' : ''}`}>
            <div className="flex items-center gap-2">
                <span className={`w-4 text-center font-bold ${team.position <= 4 ? 'text-blue-600' : isRelegation ? 'text-red-500' : 'text-slate-400'}`}>{team.position}</span>
                <span className="font-black text-slate-700 truncate max-w-[100px] uppercase">{team.team_short_name || team.team_name}</span>
            </div>
            <div className="flex items-center gap-3 w-16 justify-end">
                <span className="text-slate-400 font-medium">{team.played_games}</span>
                <span className="font-black text-slate-900 w-5 text-right">{team.points}</span>
            </div>
        </div>
    );

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
            <div className="bg-[#0a1428] px-3 py-2 flex justify-between items-center">
                <h3 className="text-[10px] font-black uppercase text-white tracking-widest flex items-center gap-1.5">
                    <BarChart2 size={12} className="text-blue-400"/> {leagueName === 'Premier League' ? 'EPL' : leagueName} Table
                </h3>
            </div>
            <div className="flex-1 p-2 flex flex-col justify-between">
                <div>
                    <div className="flex items-center justify-between px-2 pb-1 border-b-2 border-slate-100 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                        <div className="flex gap-2"><span className="w-4 text-center">#</span><span>Club</span></div>
                        <div className="flex gap-3 w-16 justify-end"><span>P</span><span className="w-5 text-right">Pts</span></div>
                    </div>
                    <div className="mt-1">
                        {topTeams.map(t => renderRow(t))}
                        <div className="py-0.5 text-center text-slate-300 text-[8px] font-black tracking-widest bg-slate-50">•••</div>
                        {bottomTeams.map(t => renderRow(t, true))}
                    </div>
                </div>
                <Link href={`/standings?league=${encodeURIComponent(leagueName)}`} className="block w-full text-center bg-slate-50 border border-slate-200 text-blue-600 font-black text-[9px] uppercase tracking-widest py-2 rounded-lg hover:bg-blue-50 mt-3 transition">
                    Full Table <ChevronRight size={10} className="inline ml-0.5 -mt-0.5" />
                </Link>
            </div>
        </div>
    );
}