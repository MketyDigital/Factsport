export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { createClient } from '@/app/lib/supabase/server';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import FreeTipsBanner from '@/app/components/FreeTipsBanner'; 
import LeagueMatchGroup from '@/app/components/LeagueMatchGroup'; 
import LeagueNavigator from '@/app/components/LeagueNavigator'; // 🟢 New Import

const PRIORITY_LEAGUES = [
    'Premier League', 'La Liga', 'Bundesliga', 
    'Serie A', 'Ligue 1', 'Champions League'
];

export default async function AllMatchesPage() {
  const supabase = createClient();
   
  // 🟢 FETCH WINDOW: (-7 Days to +14 Days)
  // Ensures we have a good history and a solid future schedule
  const startDate = new Date(); startDate.setDate(startDate.getDate() - 7); 
  const endDate = new Date(); endDate.setDate(endDate.getDate() + 14); 

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

  // 3. GAP FILLING
  const missingLeagues = PRIORITY_LEAGUES.filter(l => leagues[l].length === 0);

  if (missingLeagues.length > 0) {
      const gapFillPromises = missingLeagues.map(async (leagueName) => {
          // A. Fetch Future (Limit 10)
          const { data: nextMatches } = await supabase
              .from('matches').select('*').eq('league', leagueName)
              .gt('match_date', new Date().toISOString()) 
              .order('match_date', { ascending: true }).limit(10); 

          if (nextMatches && nextMatches.length > 0) return nextMatches;

          // B. Fetch Past (Limit 10)
          const { data: lastMatches } = await supabase
              .from('matches').select('*').eq('league', leagueName)
              .lt('match_date', new Date().toISOString()) 
              .order('match_date', { ascending: false }).limit(10);
              
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

  // 🟢 PREPARE ACTIVE LEAGUE LIST FOR NAVIGATOR
  // This combines priority leagues (that have data) with other leagues (like Cups)
  const activeLeagues = [
      ...PRIORITY_LEAGUES.filter(l => leagues[l]?.length > 0),
      ...Object.keys(leagues).filter(k => !PRIORITY_LEAGUES.includes(k))
  ];

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 pb-20 font-sans">
      
      {/* PAGE HEADER */}
      <div className="bg-[#0a1428] text-white p-4 flex items-center gap-4 sticky top-0 z-50 shadow-md">
          <Link href="/" className="p-1 rounded-full hover:bg-white/10 transition"><ChevronLeft /></Link>
          <div>
            <h1 className="font-bold text-lg leading-none">Match Center</h1>
            <p className="text-[10px] text-slate-400 font-medium">Fixtures, Results & Tables</p>
          </div>
      </div>

      {/* 🟢 LEAGUE NAVIGATOR (Sticky Tabs) */}
      <LeagueNavigator leagues={activeLeagues} />

      <div className="p-3 space-y-6">
        <FreeTipsBanner />
        
        {/* RENDER LEAGUE GROUPS */}
        {activeLeagues.map((leagueName) => (
            // 🟢 ID ADDED: Allows the navigator to scroll here
            <div key={leagueName} id={leagueName.replace(/\s+/g, '-')}>
                <LeagueMatchGroup 
                    leagueName={leagueName} 
                    // 🟢 LIMIT ENFORCED: .slice(0, 10) ensures max 10 items per list
                    matches={leagues[leagueName].slice(0, 10)} 
                />
            </div>
        ))}

        {activeLeagues.length === 0 && (
            <div className="text-center py-20 opacity-50">
                <p>No matches found.</p>
            </div>
        )}
      </div>
    </div>
  );
}