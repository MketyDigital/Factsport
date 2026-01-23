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

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 pb-20">
      <div className="bg-[#0a1428] text-white p-4 flex items-center gap-4 sticky top-0 z-50">
          <Link href="/"><ChevronLeft /></Link>
          <h1 className="font-bold text-lg">All Competitions</h1>
      </div>

      <div className="p-4 space-y-6">
        {Object.keys(leagues).map((leagueName) => (
            <div key={leagueName} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                    <h2 className="font-black text-sm uppercase text-slate-800">{leagueName}</h2>
                    <button className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                        <BarChart2 size={12} /> Table
                    </button>
                </div>

                <div className="space-y-3">
                    {leagues[leagueName].map((match) => (
                        <Link href={`/match/${match.id}`} key={match.id} className="block">
                            <div className="flex items-center justify-between">
                                <div className="text-[10px] text-slate-400 font-bold w-12">
                                    {new Date(match.match_date).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                                </div>
                                <div className="flex-1 px-2 border-l border-slate-100">
                                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                                        <span>{match.home_team}</span>
                                        <span>{match.home_score}</span>
                                    </div>
                                    <div className="flex justify-between text-xs font-bold text-slate-700">
                                        <span>{match.away_team}</span>
                                        <span>{match.away_score}</span>
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