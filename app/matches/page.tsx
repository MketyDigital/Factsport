export const runtime = 'edge';
export const revalidate = 3;

import { createClient } from '@/app/lib/supabase/server';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import FreeTipsBanner from '@/app/components/FreeTipsBanner'; 
import LeagueMatchGroup from '@/app/components/LeagueMatchGroup'; 
import LeagueNavigator from '@/app/components/LeagueNavigator'; 

const PRIORITY_LEAGUES = [
    'Premier League', 'La Liga', 'Bundesliga', 
    'Serie A', 'Ligue 1', 'Champions League'
];

// 🟢 BULLETPROOF STATUS ARRAY 
const FINISHED_STATUSES = ['FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD'];

export default async function AllMatchesPage() {
  const supabase = createClient();
   
  const startDate = new Date(); startDate.setDate(startDate.getDate() - 7); 
  const endDate = new Date(); endDate.setDate(endDate.getDate() + 14); 

  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .gte('match_date', startDate.toISOString())
    .lte('match_date', endDate.toISOString())
    .order('match_date', { ascending: true });

  const leagues: { [key: string]: any[] } = {};
  PRIORITY_LEAGUES.forEach(league => { leagues[league] = []; });

  matches?.forEach(match => {
    if (!leagues[match.league]) leagues[match.league] = [];
    leagues[match.league].push(match);
  });

  const leaguesToProcess = Array.from(new Set([...PRIORITY_LEAGUES, ...Object.keys(leagues)]));

  const gapFillPromises = leaguesToProcess.map(async (leagueName) => {
      const currentMatches = leagues[leagueName] || [];
      const currentResults = currentMatches.filter(m => FINISHED_STATUSES.includes((m.status || '').toUpperCase()));
      
      let extraMatches: any[] = [];

      if (currentResults.length < 10) {
          const { data: pastMatches } = await supabase
              .from('matches')
              .select('*')
              .eq('league', leagueName)
              .lt('match_date', new Date().toISOString())
              .order('match_date', { ascending: false })
              .limit(10);
          
          if (pastMatches) extraMatches = [...extraMatches, ...pastMatches];
      }

      if (currentMatches.length === 0 && PRIORITY_LEAGUES.includes(leagueName)) {
          const { data: nextMatches } = await supabase
              .from('matches')
              .select('*')
              .eq('league', leagueName)
              .gt('match_date', new Date().toISOString())
              .order('match_date', { ascending: true })
              .limit(10);

          if (nextMatches) extraMatches = [...extraMatches, ...nextMatches];
      }

      return { leagueName, extraMatches };
  });

  const gapFillData = await Promise.all(gapFillPromises);
  
  gapFillData.forEach(({ leagueName, extraMatches }) => {
      if (extraMatches && extraMatches.length > 0) {
          if (!leagues[leagueName]) leagues[leagueName] = [];
          const existingIds = new Set(leagues[leagueName].map(m => m.id));
          extraMatches.forEach(m => {
              if (!existingIds.has(m.id)) {
                  leagues[leagueName].push(m);
                  existingIds.add(m.id);
              }
          });
      }
  });

  Object.keys(leagues).forEach(key => {
      if (leagues[key].length === 0) delete leagues[key];
  });

  const activeLeagues = [
      ...PRIORITY_LEAGUES.filter(l => leagues[l]?.length > 0),
      ...Object.keys(leagues).filter(k => !PRIORITY_LEAGUES.includes(k))
  ];

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 pb-20 font-sans">
      
      <div className="bg-[#0a1428] text-white p-4 flex items-center gap-4 sticky top-0 z-50 shadow-md">
          <Link href="/" className="p-1 rounded-full hover:bg-white/10 transition"><ChevronLeft /></Link>
          <div>
            <h1 className="font-bold text-lg leading-none">Match Center</h1>
            <p className="text-[10px] text-slate-400 font-medium">Fixtures, Results & Tables</p>
          </div>
      </div>

      <LeagueNavigator leagues={activeLeagues} />

      <div className="p-3 space-y-6">
        <FreeTipsBanner />
        
        {activeLeagues.map((leagueName) => {
            const leagueMatches = leagues[leagueName];
            const leagueBanner = leagueMatches[0]?.league_banner;

            const fixtures = leagueMatches
                .filter(m => !FINISHED_STATUSES.includes((m.status || '').toUpperCase()))
                .sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime())
                .slice(0, 10);

            const results = leagueMatches
                .filter(m => FINISHED_STATUSES.includes((m.status || '').toUpperCase()))
                .sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime())
                .slice(0, 10);

            const smartDisplayList = [...fixtures, ...results];

            return (
                <div key={leagueName} id={leagueName.replace(/\s+/g, '-')}>
                    {leagueBanner ? (
                        <div className="mb-3 rounded-lg overflow-hidden shadow-sm border border-slate-200 bg-white">
                            <img src={leagueBanner} alt={leagueName} className="w-full h-16 object-cover object-center" />
                        </div>
                    ) : (
                         <div className="mb-2 px-2 border-l-4 border-blue-600 pl-2">
                             <h2 className="font-bold text-slate-800 uppercase text-sm tracking-wider">{leagueName}</h2>
                         </div>
                    )}

                    <LeagueMatchGroup 
                        leagueName={leagueName} 
                        matches={smartDisplayList} 
                    />
                </div>
            );
        })}

        {activeLeagues.length === 0 && (
            <div className="text-center py-20 opacity-50">
                <p>No matches found.</p>
            </div>
        )}
      </div>
    </div>
  );
}