export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { createClient } from '@/app/lib/supabase/server';
import Link from "next/link";
import { ChevronRight, Calendar } from "lucide-react";

async function getMatches(leagueFilter: string | null) {
  const supabase = createClient();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1); 

  let query = supabase
    .from('matches')
    .select('*')
    .gte('match_date', yesterday.toISOString())
    .order('match_date', { ascending: true }); 

  if (leagueFilter && leagueFilter !== 'All') {
    query = query.ilike('league', `%${leagueFilter}%`);
  }

  const { data } = await query.limit(100);
  return data || [];
}

async function getNews() {
  const supabase = createClient();
  const { data } = await supabase.from('news').select('*').limit(3);
  return data || [];
}

export default async function Home({ searchParams }: { searchParams: { league?: string } }) {
  const selectedLeague = searchParams.league || 'All';
  const matches = await getMatches(selectedLeague);
  const news = await getNews();

  // ✅ SORTING: Live -> Upcoming -> Finished
  const liveMatches = matches.filter(m => m.status === 'LIVE');
  const upcomingMatches = matches.filter(m => m.status === 'SCHEDULED' || m.status === 'UPCOMING');
  const finishedMatches = matches.filter(m => m.status === 'FINISHED' || m.status === 'FT');

  // Sort upcoming by time (soonest first)
  upcomingMatches.sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime());
  
  // Sort finished by time (most recent first)
  finishedMatches.sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime());

  const displayMatches = [...liveMatches, ...upcomingMatches, ...finishedMatches];

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 font-sans pb-20">
      
      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 bg-[#0a1428] text-white border-b border-white/10 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="relative flex items-center justify-center w-8 h-8">
               <div className="absolute w-full h-full bg-gradient-to-r from-red-600 to-blue-800 clip-hexagon"></div>
               <span className="relative font-bold italic text-white text-[10px]">FS</span>
            </div>
            <span className="text-xl font-black tracking-tighter text-white">FactSport</span>
          </div>
          <div className="flex items-center space-x-3">
            <Link href="/matches" className="text-[10px] font-bold text-slate-300">Matches</Link>
            <Link href="/login" className="px-3 py-1 text-[10px] font-bold bg-white/10 rounded-full">Login</Link>
          </div>
        </div>
      </nav>

      {/* TABS */}
      <div className="bg-white border-b border-slate-200 sticky top-14 z-40 overflow-x-auto scrollbar-hide">
        <div className="flex px-4 py-2 space-x-2 min-w-max">
          {['All', 'Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Champions League'].map((league) => (
             <Link 
               key={league} 
               href={`/?league=${league}`}
               className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                 selectedLeague === league ? 'bg-blue-900 text-white shadow' : 'bg-slate-50 text-slate-500 border border-slate-100'
               }`}
             >
               {league === 'Premier League' ? 'EPL' : league}
             </Link>
          ))}
        </div>
      </div>

      {/* NEWS */}
      <div className="p-4 space-y-3">
         {news.length > 0 && (
             news.map((item: any) => (
                 <div key={item.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                     <h4 className="text-xs font-bold">{item.title}</h4>
                 </div>
             ))
         )}
      </div>

      {/* MATCH LIST */}
      <main className="px-4 space-y-3">
        <h3 className="text-xs font-black uppercase text-slate-400 flex items-center gap-2 mb-2">
            <Calendar size={12} /> {selectedLeague} Matches
        </h3>

        {displayMatches.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">No matches found.</div>
        ) : (
            displayMatches.map((match: any) => (
                <Link href={`/match/${match.id}`} key={match.id}>
                    <div className={`bg-white rounded-xl p-3 shadow-sm border border-slate-100 flex items-center justify-between active:scale-[0.99] transition-transform mb-3 ${match.status.includes('FT') || match.status === 'FINISHED' ? 'bg-slate-50 opacity-80' : ''}`}>
                        <div className="flex items-center gap-3">
                             {/* Status/Time */}
                            <div className="flex flex-col items-center justify-center w-10 border-r border-slate-100 pr-3">
                                {match.status === 'LIVE' ? (
                                    <span className="text-[10px] font-black text-red-600 animate-pulse">LIVE</span>
                                ) : (match.status === 'FINISHED' || match.status === 'FT') ? (
                                    <span className="text-[10px] font-bold text-slate-400">FT</span>
                                ) : (
                                    <span className="text-[10px] font-bold text-slate-800">
                                        {new Date(match.match_date).toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'})}
                                    </span>
                                )}
                            </div>
                            
                            {/* Teams */}
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 w-40">
                                    <span className={`text-[10px] font-bold w-4 text-right ${match.status === 'LIVE' ? 'text-red-600' : 'text-slate-500'}`}>
                                        {(match.status === 'LIVE' || match.status === 'FINISHED' || match.status === 'FT') ? match.home_score : '-'}
                                    </span>
                                    <span className="text-xs font-bold text-slate-800 truncate">{match.home_team}</span>
                                </div>
                                <div className="flex items-center gap-2 w-40">
                                    <span className={`text-[10px] font-bold w-4 text-right ${match.status === 'LIVE' ? 'text-red-600' : 'text-slate-500'}`}>
                                        {(match.status === 'LIVE' || match.status === 'FINISHED' || match.status === 'FT') ? match.away_score : '-'}
                                    </span>
                                    <span className="text-xs font-bold text-slate-800 truncate">{match.away_team}</span>
                                </div>
                            </div>
                        </div>

                        <ChevronRight size={16} className="text-slate-300" />
                    </div>
                </Link>
            ))
        )}
      </main>
    </div>
  );
}