export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { createClient } from '@/app/lib/supabase/server';
import Link from 'next/link';
import { ChevronLeft, BarChart2, Clock, Zap, Ticket, Calendar } from 'lucide-react';

export default async function AllMatchesPage() {
  const supabase = createClient();
  
  // 1. Fetch matches for a wider window (e.g., last 24h to next 48h)
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 1);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 2);

  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .gte('match_date', startDate.toISOString())
    .lte('match_date', endDate.toISOString())
    .order('match_date', { ascending: true }); // Base sort

  // 2. Group by League
  const leagues: { [key: string]: any[] } = {};
  matches?.forEach(match => {
    if (!leagues[match.league]) leagues[match.league] = [];
    leagues[match.league].push(match);
  });

  // 3. Sorting Helper (Live -> Upcoming -> Finished)
  const sortMatches = (leagueMatches: any[]) => {
    const live = leagueMatches.filter(m => m.status === 'LIVE');
    const upcoming = leagueMatches.filter(m => m.status !== 'LIVE' && m.status !== 'FINISHED' && m.status !== 'FT');
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

                    {/* Matches */}
                    <div className="divide-y divide-slate-50">
                        {sortMatches(leagues[leagueName]).map((match) => (
                            <div key={match.id} className="block hover:bg-slate-50 transition-colors">
                                {/* Clickable Match Area */}
                                <Link href={`/match/${match.id}`} className="block p-4">
                                    <div className="flex items-center justify-between">
                                        
                                        {/* Status / Time Column */}
                                        <div className="flex flex-col items-center justify-center w-12 border-r border-slate-100 pr-3 mr-3 shrink-0">
                                            {match.status === 'LIVE' ? (
                                                <div className="text-center">
                                                    <span className="text-[9px] font-black text-red-600 animate-pulse block mb-1">LIVE</span>
                                                    <span className="text-[9px] font-bold text-red-600 block">
                                                        {match.clock ? `${match.clock}'` : 'ON'}
                                                    </span>
                                                </div>
                                            ) : (match.status === 'FINISHED' || match.status === 'FT') ? (
                                                <span className="text-[10px] font-black text-slate-400">FT</span>
                                            ) : (
                                                <div className="text-center">
                                                    <span className="text-[10px] font-bold text-slate-800 block">
                                                        {new Date(match.match_date).toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'})}
                                                    </span>
                                                    <span className="text-[8px] font-bold text-slate-400 uppercase mt-0.5 block">
                                                        {new Date(match.match_date).getDate() === new Date().getDate() ? 'Today' : new Date(match.match_date).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Teams & Scores */}
                                        <div className="flex-1 space-y-2">
                                            {/* Home Team */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-5 h-5 flex items-center justify-center shrink-0">
                                                        {match.home_logo ? <img src={match.home_logo} className="w-full h-full object-contain" /> : <div className="w-4 h-4 bg-slate-200 rounded-full"></div>}
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-800 line-clamp-1">{match.home_team}</span>
                                                </div>
                                                {(match.status === 'LIVE' || match.status === 'FINISHED' || match.status === 'FT') && (
                                                    <span className={`text-xs font-black ${match.status === 'LIVE' ? 'text-red-600' : 'text-slate-900'}`}>{match.home_score}</span>
                                                )}
                                            </div>

                                            {/* Away Team */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-5 h-5 flex items-center justify-center shrink-0">
                                                        {match.away_logo ? <img src={match.away_logo} className="w-full h-full object-contain" /> : <div className="w-4 h-4 bg-slate-200 rounded-full"></div>}
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-800 line-clamp-1">{match.away_team}</span>
                                                </div>
                                                {(match.status === 'LIVE' || match.status === 'FINISHED' || match.status === 'FT') && (
                                                    <span className={`text-xs font-black ${match.status === 'LIVE' ? 'text-red-600' : 'text-slate-900'}`}>{match.away_score}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </Link>

                                {/* Action Buttons Footer */}
                                <div className="px-4 pb-3 pt-0 flex gap-2">
                                    <Link 
                                        href={`/match/${match.id}`} 
                                        className="flex-1 flex items-center justify-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg py-2 text-[10px] font-bold text-slate-600 active:scale-95 transition hover:bg-white hover:border-blue-200 hover:text-blue-600"
                                    >
                                        <Zap size={12} className="text-yellow-500 fill-yellow-500" /> Predict
                                    </Link>
                                    
                                    {match.booking_code ? (
                                        <button className="flex-1 flex items-center justify-center gap-1.5 bg-[#1A1A1A] text-yellow-400 rounded-lg py-2 text-[10px] font-bold active:scale-95 transition">
                                            <Ticket size={12} /> {match.booking_code}
                                        </button>
                                    ) : (
                                        <Link 
                                            href="/vip/upgrade" 
                                            className="flex-1 flex items-center justify-center gap-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg py-2 text-[10px] font-bold active:scale-95 transition hover:bg-green-100"
                                        >
                                            <Ticket size={12} /> Bet Now
                                        </Link>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))
        )}
      </div>
    </div>
  );
}