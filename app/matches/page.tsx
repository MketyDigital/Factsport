export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { createClient } from '@/app/lib/supabase/server';
import Link from 'next/link';
import { ChevronLeft, BarChart2, Calendar } from 'lucide-react';
// ✅ IMPORT THE NEW COMPONENT
import MatchRow from '@/app/components/MatchRow';

export default async function AllMatchesPage() {
  const supabase = createClient();
  
  // 1. Fetch matches (Last 24h to Next 48h)
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 1);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 2);

  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .gte('match_date', startDate.toISOString())
    .lte('match_date', endDate.toISOString())
    .order('match_date', { ascending: true });

  // 2. Group by League
  const leagues: { [key: string]: any[] } = {};
  matches?.forEach(match => {
    if (!leagues[match.league]) leagues[match.league] = [];
    leagues[match.league].push(match);
  });

  // 3. Sorting Helper
  const sortMatches = (leagueMatches: any[]) => {
    const live = leagueMatches.filter(m => m.status === 'LIVE' || m.status === 'in');
    const upcoming = leagueMatches.filter(m => m.status !== 'LIVE' && m.status !== 'in' && m.status !== 'FINISHED' && m.status !== 'FT');
    const finished = leagueMatches.filter(m => m.status === 'FINISHED' || m.status === 'FT');

    upcoming.sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime());
    finished.sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime());

    return [...live, ...upcoming, ...finished];
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 pb-20 font-sans">
      
      {/* Header */}
      <div className="bg-[#0a1428] text-white p-4 flex items-center gap-4 sticky top-0 z-50 shadow-md">
          <Link href="/" className="p-1 rounded-full hover:bg-white/10 transition"><ChevronLeft /></Link>
          <div>
            <h1 className="font-bold text-lg leading-none">Match Center</h1>
            <p className="text-[10px] text-slate-400 font-medium">All Competitions</p>
          </div>
      </div>

      <div className="p-3 space-y-6">
        {Object.keys(leagues).length === 0 ? (
            <div className="text-center py-20 opacity-50">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                <p className="font-bold text-sm">No matches scheduled</p>
            </div>
        ) : (
            Object.keys(leagues).map((leagueName) => (
                <div key={leagueName} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    
                    {/* League Header */}
                    <div className="bg-slate-50 px-4 py-3 flex justify-between items-center border-b border-slate-100">
                        <h2 className="font-black text-xs uppercase text-slate-800 tracking-wider truncate mr-2">{leagueName}</h2>
                        <Link 
                            href={`/standings?league=${encodeURIComponent(leagueName)}`}
                            className="flex items-center gap-1.5 text-[9px] font-bold text-blue-700 bg-blue-100/50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition whitespace-nowrap"
                        >
                            <BarChart2 size={12} /> Table
                        </Link>
                    </div>

                    {/* Matches - NOW USING THE SMART COMPONENT */}
                    <div className="divide-y divide-slate-50">
                        {sortMatches(leagues[leagueName]).map((match) => (
                            <MatchRow key={match.id} match={match} />
                        ))}
                    </div>
                </div>
            ))
        )}
      </div>
    </div>
  );
}