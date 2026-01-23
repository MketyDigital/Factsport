export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { createClient } from '@/app/lib/supabase/server';
import Link from 'next/link';
import { ChevronLeft, BarChart2 } from 'lucide-react';

export default async function AllMatchesPage() {
  const supabase = createClient();
  
  // Fetch ALL matches
  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .order('match_date', { ascending: true })
    .limit(200);

  // Group by League
  const leagues: { [key: string]: any[] } = {};
  matches?.forEach(match => {
    if (!leagues[match.league]) leagues[match.league] = [];
    leagues[match.league].push(match);
  });

  // Function to Sort Matches inside each League
  const sortMatches = (leagueMatches: any[]) => {
    const live = leagueMatches.filter(m => m.status === 'LIVE');
    const upcoming = leagueMatches.filter(m => m.status !== 'LIVE' && m.status !== 'FINISHED' && m.status !== 'FT');
    const finished = leagueMatches.filter(m => m.status === 'FINISHED' || m.status === 'FT');

    upcoming.sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime());
    finished.sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime());

    return [...live, ...upcoming, ...finished];
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 pb-20">
      <div className="bg-[#0a1428] text-white p-4 flex items-center gap-4 sticky top-0 z-50 shadow-md">
          <Link href="/"><ChevronLeft /></Link>
          <h1 className="font-bold text-lg">All Competitions</h1>
      </div>

      <div className="p-4 space-y-6">
        {Object.keys(leagues).map((leagueName) => (
            <div key={leagueName} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                
                {/* League Header + Standings Button */}
                <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                    <h2 className="font-black text-sm uppercase text-slate-800">{leagueName}</h2>
                    
                    {/* Only show Table button if we can map the league */}
                    <Link 
                        href={`/standings?league=${encodeURIComponent(leagueName)}`}
                        className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition"
                    >
                        <BarChart2 size={12} /> Table
                    </Link>
                </div>

                <div className="space-y-3">
                    {sortMatches(leagues[leagueName]).map((match) => (
                        <Link href={`/match/${match.id}`} key={match.id} className="block">
                            <div className={`flex items-center justify-between p-2 rounded-lg ${match.status === 'LIVE' ? 'bg-red-50/50' : ''}`}>
                                {/* Date/Time */}
                                <div className="text-[10px] text-slate-400 font-bold w-12 border-r border-slate-100 mr-2">
                                    {match.status === 'LIVE' ? (
                                        <span className="text-red-600 animate-pulse">LIVE</span>
                                    ) : (match.status === 'FINISHED' || match.status === 'FT') ? (
                                        <span>FT</span>
                                    ) : (
                                        new Date(match.match_date).toLocaleDateString(undefined, {month:'short', day:'numeric'})
                                    )}
                                </div>

                                {/* Score Info */}
                                <div className="flex-1">
                                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                                        <span>{match.home_team}</span>
                                        <span className={`${match.status === 'LIVE' ? 'text-red-600' : 'text-slate-900'}`}>
                                            {(match.status === 'LIVE' || match.status === 'FINISHED' || match.status === 'FT') ? match.home_score : ''}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-xs font-bold text-slate-700">
                                        <span>{match.away_team}</span>
                                        <span className={`${match.status === 'LIVE' ? 'text-red-600' : 'text-slate-900'}`}>
                                            {(match.status === 'LIVE' || match.status === 'FINISHED' || match.status === 'FT') ? match.away_score : ''}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        ))}
      </div>
    </div>
  );
}