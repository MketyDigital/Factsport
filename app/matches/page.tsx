export const runtime = 'edge';
export const revalidate = 5;

import { createClient } from '@supabase/supabase-js'; 
import Link from 'next/link';
import { ChevronLeft, X, Search } from 'lucide-react';
import FreeTipsBanner from '@/app/components/FreeTipsBanner'; 
import LeagueMatchGroup from '@/app/components/LeagueMatchGroup'; 
import LeagueNavigator from '@/app/components/LeagueNavigator'; 

import { getTeamForm } from '@/app/lib/teamForm';
import { getTeamQueryFilter } from '@/app/lib/teamAliases';

// 🔥 SEO METADATA ADDED
export const metadata = {
  title: 'Football Fixtures, Live Scores & Results | FactSport',
  description: 'View today\'s football fixtures, live scores, and recent match results from the Premier League, Champions League, La Liga, WorldCup and more.',
};

const PRIORITY_LEAGUES = [
    'Premier League', 'La Liga', 'Bundesliga', 
    'Serie A', 'Ligue 1', 'Champions League'
];

const FINISHED_STATUSES = ['FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD'];

export default async function AllMatchesPage({ searchParams }: { searchParams: { team?: string } }) {
  const resolvedParams = await searchParams;
  const teamFilter = resolvedParams?.team || null; 

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
   
  const startDate = new Date(); startDate.setDate(startDate.getDate() - 7); 
  const endDate = new Date(); endDate.setDate(endDate.getDate() + 14); 

  let query = supabase.from('matches').select('*').order('match_date', { ascending: true });
  
  if (teamFilter) {
      const teamStart = new Date(); teamStart.setDate(teamStart.getDate() - 30);
      const teamEnd = new Date(); teamEnd.setDate(teamEnd.getDate() + 30);
      
      const queryFilter = getTeamQueryFilter(teamFilter);

      query = query
        .gte('match_date', teamStart.toISOString())
        .lte('match_date', teamEnd.toISOString())
        .or(queryFilter);
  } else {
      query = query
        .gte('match_date', startDate.toISOString())
        .lte('match_date', endDate.toISOString());
  }

  const { data: matches } = await query;
  const validMatches = matches || [];

  if (teamFilter) {
      const teamFormArray = await getTeamForm(teamFilter);

      return (
        <div className="min-h-screen bg-[#F0F2F5] text-slate-900 pb-20 font-sans">
            <div className="bg-[#0a1428] text-white p-4 flex items-center justify-between sticky top-0 z-50 shadow-md">
                <div className="flex items-center gap-4">
                    <Link href="/" className="p-1 rounded-full hover:bg-white/10 transition"><ChevronLeft /></Link>
                    <div>
                        <h1 className="font-bold text-lg leading-none">Team Center</h1>
                        <p className="text-[10px] text-slate-400 font-medium">Fixtures & Results</p>
                    </div>
                </div>
            </div>

            <div className="p-3 space-y-4">
                <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl p-4 shadow-md flex items-center justify-between text-white">
                    <div>
                        <div className="flex items-center gap-2 mb-1.5">
                            <Search size={16} className="text-blue-200" />
                            <span className="text-xs font-black uppercase tracking-widest">Showing: {teamFilter}</span>
                        </div>
                        {teamFormArray.length > 0 && (
                            <div className="flex items-center gap-1">
                                <span className="text-[8px] uppercase tracking-widest font-bold text-blue-200 mr-1">Form:</span>
                                {teamFormArray.map((result: string, i: number) => (
                                    <span key={i} className={`w-3.5 h-3.5 flex items-center justify-center text-[7px] font-black text-white rounded-sm shadow-sm border border-black/10 ${result === 'W' ? 'bg-green-500' : result === 'L' ? 'bg-red-500' : 'bg-slate-400'}`}>
                                        {result}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                    <Link href="/matches" className="bg-white/20 hover:bg-white/30 p-1.5 rounded-full backdrop-blur-sm transition">
                        <X size={16} />
                    </Link>
                </div>

                <LeagueMatchGroup 
                    leagueName={`${teamFilter} Matches`} 
                    matches={validMatches} 
                />
            </div>
        </div>
      );
  }

  const leagues: { [key: string]: any[] } = {};
  PRIORITY_LEAGUES.forEach(league => { leagues[league] = []; });

  validMatches.forEach(match => {
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