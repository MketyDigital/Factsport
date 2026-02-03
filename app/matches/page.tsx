export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { createClient } from '@/app/lib/supabase/server';
import Link from 'next/link';
import { ChevronLeft, BarChart2, Calendar, Zap, Ticket, ExternalLink, Video, Clock } from 'lucide-react';
import LiveScoreLabel from '@/app/components/LiveScoreLabel';
import FreeTipsBanner from '@/app/components/FreeTipsBanner'; 

const DEFAULT_AFFILIATE_LINK = "https://refpa58144.com/L?tag=d_1181253m_1599c_&site=1181253&ad=1599"; 

const PRIORITY_LEAGUES = [
    'Premier League', 'La Liga', 'Bundesliga', 
    'Serie A', 'Ligue 1', 'Champions League'
];

export default async function AllMatchesPage() {
  const supabase = createClient();
  
  // 1. STANDARD FETCH (Wider Window: Yesterday to Next 7 Days)
  // We start with a big window so we usually don't even need the "Gap Filler"
  const startDate = new Date(); startDate.setDate(startDate.getDate() - 2); // Go back 48h for results
  const endDate = new Date(); endDate.setDate(endDate.getDate() + 14); // Look 2 weeks ahead

  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .gte('match_date', startDate.toISOString())
    .lte('match_date', endDate.toISOString())
    .order('match_date', { ascending: true });

  // 2. GROUP BY LEAGUE
  const leagues: { [key: string]: any[] } = {};
  PRIORITY_LEAGUES.forEach(league => { leagues[league] = []; });

  matches?.forEach(match => {
    if (!leagues[match.league]) leagues[match.league] = [];
    leagues[match.league].push(match);
  });

  // 3. GAP FILLING (Only if a league is TOTALLY empty in the 2-week window)
  const missingLeagues = PRIORITY_LEAGUES.filter(l => leagues[l].length === 0);

  if (missingLeagues.length > 0) {
      const gapFillPromises = missingLeagues.map(async (leagueName) => {
          // A. Fetch ALL Future Matches (Limit 20 per league to be safe)
          const { data: nextMatches } = await supabase
              .from('matches')
              .select('*')
              .eq('league', leagueName)
              .gt('match_date', new Date().toISOString()) 
              .order('match_date', { ascending: true })
              .limit(20); 

          if (nextMatches && nextMatches.length > 0) return nextMatches;

          // B. If no future, fetch ALL Recent Results (Limit 20)
          const { data: lastMatches } = await supabase
              .from('matches')
              .select('*')
              .eq('league', leagueName)
              .lt('match_date', new Date().toISOString()) 
              .order('match_date', { ascending: false })
              .limit(20);
              
          return lastMatches || [];
      });

      const filledGroups = await Promise.all(gapFillPromises);
      filledGroups.forEach(group => {
          if (group && group.length > 0) {
              const league = group[0].league;
              if (leagues[league]) leagues[league] = group;
          }
      });
  }

  // Cleanup Empty Leagues
  Object.keys(leagues).forEach(key => {
      if (leagues[key].length === 0) delete leagues[key];
  });

  // Helper: Group matches by DATE inside the league list
  // This puts headers like "Today", "Tomorrow" between matches
  const groupByDate = (matchList: any[]) => {
      const groups: { [date: string]: any[] } = {};
      matchList.forEach(m => {
          const dateObj = new Date(m.match_date);
          const dateKey = dateObj.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); // "Mon, 12 Feb"
          if (!groups[dateKey]) groups[dateKey] = [];
          groups[dateKey].push(m);
      });
      return groups;
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 pb-20 font-sans">
      
      {/* PAGE HEADER */}
      <div className="bg-[#0a1428] text-white p-4 flex items-center gap-4 sticky top-0 z-50 shadow-md">
          <Link href="/" className="p-1 rounded-full hover:bg-white/10 transition"><ChevronLeft /></Link>
          <div>
            <h1 className="font-bold text-lg leading-none">Match Center</h1>
            <p className="text-[10px] text-slate-400 font-medium">All Fixtures & Results</p>
          </div>
      </div>

      <div className="p-3 space-y-6">
        <FreeTipsBanner />
        
        {[...PRIORITY_LEAGUES, ...Object.keys(leagues).filter(k => !PRIORITY_LEAGUES.includes(k))]
            .filter(leagueName => leagues[leagueName]?.length > 0)
            .map((leagueName) => {
                const dateGroups = groupByDate(leagues[leagueName]);
                return (
                <div key={leagueName} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-6">
                    
                    {/* LEAGUE HEADER */}
                    <div className="bg-slate-50 px-4 py-3 flex justify-between items-center border-b border-slate-100">
                        <h2 className="font-black text-sm uppercase text-slate-800 tracking-wider truncate mr-2">{leagueName}</h2>
                        <Link href={`/standings?league=${encodeURIComponent(leagueName)}`} className="flex items-center gap-1.5 text-[10px] font-bold text-blue-700 bg-blue-100/50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition whitespace-nowrap">
                            <BarChart2 size={12} /> Table
                        </Link>
                    </div>

                    {/* MATCHES GROUPED BY DATE */}
                    <div className="divide-y divide-slate-50">
                        {Object.keys(dateGroups).map((dateKey) => (
                            <div key={dateKey}>
                                {/* DATE SUB-HEADER */}
                                <div className="bg-slate-100/50 px-4 py-1.5 border-b border-slate-50">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                        <Calendar size={10}/> {dateKey}
                                    </span>
                                </div>

                                {dateGroups[dateKey].map((match) => (
                                    <div key={match.id} className="block hover:bg-slate-50 transition border-b border-slate-50 last:border-0">
                                        <Link href={`/match/${match.id}`} className="block p-4">
                                            <div className="flex items-center justify-between">
                                                
                                                {/* TEAMS */}
                                                <div className="flex-1 space-y-2">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-6 h-6 flex items-center justify-center shrink-0">
                                                            {match.home_logo ? <img src={match.home_logo} className="w-full h-full object-contain" /> : <div className="w-5 h-5 bg-slate-200 rounded-full"/>}
                                                        </div>
                                                        <span className="text-xs font-bold text-slate-900">{match.home_team}</span>
                                                        {match.status !== 'SCHEDULED' && match.status !== 'PRE' && (
                                                            <span className="ml-auto font-black text-sm">{match.home_score}</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-6 h-6 flex items-center justify-center shrink-0">
                                                            {match.away_logo ? <img src={match.away_logo} className="w-full h-full object-contain" /> : <div className="w-5 h-5 bg-slate-200 rounded-full"/>}
                                                        </div>
                                                        <span className="text-xs font-bold text-slate-900">{match.away_team}</span>
                                                        {match.status !== 'SCHEDULED' && match.status !== 'PRE' && (
                                                            <span className="ml-auto font-black text-sm">{match.away_score}</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* RIGHT SIDE: TIME OR STATUS */}
                                                <div className="flex flex-col items-end justify-center pl-4 border-l border-slate-100 ml-4 w-20 shrink-0">
                                                    {['LIVE', 'HT', 'IN_PLAY'].includes(match.status) ? (
                                                        <div className="flex flex-col items-center">
                                                            <span className="animate-pulse text-red-600 font-black text-xs">LIVE</span>
                                                            <span className="text-[10px] text-red-500 font-bold">
                                                                {match.status === 'HT' ? 'HT' : 'Active'}
                                                            </span>
                                                        </div>
                                                    ) : ['FT', 'FINISHED'].includes(match.status) ? (
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-slate-500 font-black text-xs">FT</span>
                                                            <span className="text-[9px] text-slate-400">{new Date(match.match_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center bg-slate-50 p-1.5 rounded">
                                                            <span className="text-slate-900 font-bold text-xs">
                                                                {new Date(match.match_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                            </span>
                                                            <span className="text-[8px] text-slate-400 uppercase font-bold">Time</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </Link>

                                        {/* ACTION BAR */}
                                        <div className="px-4 pb-3 flex gap-2">
                                            <Link href={`/match/${match.id}`} className="flex-1 bg-slate-100 text-slate-600 rounded-lg py-2 text-[10px] font-bold flex items-center justify-center gap-1 hover:bg-slate-200">
                                                <Zap size={10}/> Predict
                                            </Link>
                                            
                                            {match.booking_code ? (
                                                <button className="flex-1 bg-[#1A1A1A] text-yellow-400 rounded-lg py-2 text-[10px] font-bold flex items-center justify-center gap-1">
                                                    <Ticket size={10}/> {match.booking_code}
                                                </button>
                                            ) : (
                                                <a href={match.affiliate_link || DEFAULT_AFFILIATE_LINK} target="_blank" className="flex-1 bg-green-100 text-green-700 border border-green-200 rounded-lg py-2 text-[10px] font-bold flex items-center justify-center gap-1">
                                                    <ExternalLink size={10}/> Bet Now
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            )})
        }
      </div>
    </div>
  );
}