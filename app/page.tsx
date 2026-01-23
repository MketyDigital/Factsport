export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { createClient } from '@/app/lib/supabase/server';
import Link from "next/link";
import { 
  Zap, Trophy, Activity, Calendar, Ticket, ArrowRight, Star, Clock, PlayCircle 
} from "lucide-react";

async function getHomepageData(leagueFilter: string | null) {
  const supabase = createClient();
  
  // 1. Matches (Last 24h to +48h)
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 1);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 2);

  let matchQuery = supabase
    .from('matches')
    .select('*')
    .gte('match_date', startDate.toISOString())
    .lte('match_date', endDate.toISOString())
    .order('match_date', { ascending: true });

  if (leagueFilter && leagueFilter !== 'All') {
    matchQuery = matchQuery.ilike('league', `%${leagueFilter}%`);
  }

  // 2. News
  const newsQuery = supabase.from('news').select('*').order('created_at', { ascending: false }).limit(20); 

  // 3. ✅ NEW: Fetch Highlights (Matches with video_url)
  const highlightsQuery = supabase
    .from('matches')
    .select('*')
    .not('video_url', 'is', null) // Only matches with video
    .order('match_date', { ascending: false }) // Newest first
    .limit(10);

  const [matchesRes, newsRes, highlightsRes] = await Promise.all([matchQuery, newsQuery, highlightsQuery]);
  
  return {
    matches: matchesRes.data || [],
    news: newsRes.data || [],
    highlights: highlightsRes.data || []
  };
}

export default async function Home({ searchParams }: { searchParams: { league?: string } }) {
  const selectedLeague = searchParams.league || 'All';
  const { matches, news, highlights } = await getHomepageData(selectedLeague);

  // Logic: Ticker & Headlines
  const breakingNews = news.filter(n => n.is_breaking); 
  const headlines = news.filter(n => n.is_headline && n.image_url).slice(0, 3);
  const headlineIds = headlines.map(h => h.id);
  const latestNews = news.filter(n => !headlineIds.includes(n.id)).slice(0, 6);

  // Match Sorting
  const live = matches.filter(m => m.status === 'LIVE');
  const upcoming = matches.filter(m => m.status === 'SCHEDULED' || m.status === 'UPCOMING');
  const finished = matches.filter(m => m.status === 'FINISHED' || m.status === 'FT');

  upcoming.sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime());
  finished.sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime());

  const displayMatches = [...live, ...upcoming, ...finished];

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 font-sans pb-24">
      
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
            <Link href="/login" className="px-4 py-1.5 text-[10px] font-bold bg-white/10 hover:bg-white/20 rounded-full transition">Login</Link>
            <Link href="/vip/upgrade" className="flex items-center gap-1 px-4 py-1.5 text-[10px] font-bold bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 rounded-full shadow-lg shadow-red-900/50 transition">
                <Trophy size={11} /> VIP
            </Link>
          </div>
        </div>
      </nav>

      {/* TICKER */}
      {breakingNews.length > 0 && (
        <div className="bg-yellow-400 text-black text-[10px] font-black py-2 overflow-hidden relative flex items-center shadow-md z-40">
            <div className="absolute left-0 h-full bg-yellow-500 px-3 flex items-center z-10 shadow-r-xl border-r border-yellow-600">
              <Activity size={12} className="mr-1 animate-pulse text-red-600" /> BREAKING
            </div>
            <div className="whitespace-nowrap animate-marquee pl-28 flex space-x-8">
            {breakingNews.map(n => ( <span key={n.id} className="uppercase tracking-wide">🚨 {n.title}</span> ))}
            </div>
        </div>
      )}

      {/* HEADLINES SLIDER */}
      {headlines.length > 0 && (
        <div className="mt-3 px-3">
            <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-4 scrollbar-hide">
                {headlines.map((item) => (
                    <Link href={`/news/${item.slug || '#'}`} key={item.id} className="snap-center shrink-0 w-[85%] md:w-[400px] h-48 relative rounded-2xl overflow-hidden shadow-lg border border-white/20">
                        <img src={item.image_url} className="absolute inset-0 w-full h-full object-cover" alt="News" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent"></div>
                        <div className="absolute bottom-0 left-0 p-4 w-full">
                            <span className="bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase mb-1.5 inline-block shadow-sm">Top Story</span>
                            <h3 className="text-white font-bold text-base leading-tight line-clamp-2 drop-shadow-md">{item.title}</h3>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
      )}

      {/* ✅ NEW: LATEST HIGHLIGHTS SLIDER */}
      {highlights.length > 0 && (
        <div className="mt-6 px-4">
             <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                    <PlayCircle size={14} className="text-red-600" /> Match Highlights
                </h3>
            </div>
            <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-2 scrollbar-hide">
                {highlights.map((item: any) => (
                    <Link href={`/match/${item.id}`} key={item.id} className="snap-center shrink-0 w-[180px] group">
                        <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-md border border-slate-100 mb-2">
                            {/* Fake Thumbnail using Team Logos */}
                            <div className="absolute inset-0 bg-[#0a1428] flex items-center justify-center gap-4 opacity-80 group-hover:opacity-60 transition">
                                <div className="w-8 h-8 flex items-center justify-center">{item.home_logo ? <img src={item.home_logo} className="w-full h-full object-contain"/> : <span className="text-white text-[10px]">{item.home_team.substring(0,3)}</span>}</div>
                                <span className="text-slate-500 font-bold">VS</span>
                                <div className="w-8 h-8 flex items-center justify-center">{item.away_logo ? <img src={item.away_logo} className="w-full h-full object-contain"/> : <span className="text-white text-[10px]">{item.away_team.substring(0,3)}</span>}</div>
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <PlayCircle className="text-white drop-shadow-lg group-hover:scale-110 transition" size={32} />
                            </div>
                            <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[8px] font-bold px-1.5 py-0.5 rounded">
                                HIGHLIGHTS
                            </div>
                        </div>
                        <h4 className="text-[10px] font-bold text-slate-800 leading-tight truncate">
                            {item.home_team} <span className="text-slate-400">vs</span> {item.away_team}
                        </h4>
                        <p className="text-[9px] text-slate-400">
                           {new Date(item.match_date).toLocaleDateString()}
                        </p>
                    </Link>
                ))}
            </div>
        </div>
      )}

      {/* MATCH CENTER */}
      <section className="mt-6">
         <div className="px-4 flex justify-between items-center mb-2">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Match Center</h3>
            <Link href="/matches" className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded flex items-center gap-1">
                View All <ArrowRight size={10} />
            </Link>
        </div>
        
        {/* League Tabs */}
        <div className="bg-white border-y border-slate-200 sticky top-14 z-30 overflow-x-auto scrollbar-hide py-2 shadow-sm">
            <div className="flex px-4 space-x-2 min-w-max">
            {['All', 'Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Champions League'].map((league) => (
                <Link key={league} href={`/?league=${league}`}
                className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all ${
                    selectedLeague === league ? 'bg-[#0a1428] text-white shadow-md' : 'bg-slate-50 text-slate-500 border border-slate-200'
                }`}>
                {league === 'Premier League' ? 'EPL' : league}
                </Link>
            ))}
            </div>
        </div>

        {/* Match List */}
        <div className="px-4 py-4 space-y-3">
            {displayMatches.length === 0 ? (
                <div className="text-center py-12 opacity-40">
                    <Calendar className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-xs font-bold">No matches for {selectedLeague}</p>
                </div>
            ) : (
                displayMatches.map((match) => (
                    <div key={match.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden mb-3">
                        <div className="bg-slate-50 px-3 py-1.5 flex justify-between items-center border-b border-slate-100">
                             <div className="flex items-center gap-1">
                                {match.status === 'LIVE' ? (
                                    <span className="text-[9px] font-black text-red-600 animate-pulse flex items-center gap-1"><span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span> LIVE</span>
                                ) : (
                                    <span className="text-[9px] font-bold text-slate-500 flex items-center gap-1"><Clock size={10} />{new Date(match.match_date).toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'})}</span>
                                )}
                             </div>
                             {match.league && <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider max-w-[100px] truncate">{match.league}</span>}
                        </div>
                        <Link href={`/match/${match.id}`}>
                            <div className="p-4 flex justify-between items-center active:bg-slate-50 transition">
                                <div className="flex-1 flex items-center gap-3">
                                    <div className="w-8 h-8 flex items-center justify-center shrink-0">{match.home_logo ? <img src={match.home_logo} className="w-full h-full object-contain" /> : <div className="w-6 h-6 bg-slate-200 rounded-full"></div>}</div>
                                    <span className="text-xs font-bold text-slate-800 line-clamp-1">{match.home_team}</span>
                                    {(match.status === 'LIVE' || match.status === 'FINISHED') && <span className={`text-sm font-black ml-auto ${match.status === 'LIVE' ? 'text-red-600' : 'text-slate-900'}`}>{match.home_score}</span>}
                                </div>
                                <div className="mx-2 text-[10px] text-slate-300 font-light">vs</div>
                                <div className="flex-1 flex items-center gap-3 flex-row-reverse text-right">
                                    <div className="w-8 h-8 flex items-center justify-center shrink-0">{match.away_logo ? <img src={match.away_logo} className="w-full h-full object-contain" /> : <div className="w-6 h-6 bg-slate-200 rounded-full"></div>}</div>
                                    <span className="text-xs font-bold text-slate-800 line-clamp-1">{match.away_team}</span>
                                    {(match.status === 'LIVE' || match.status === 'FINISHED') && <span className={`text-sm font-black mr-auto ${match.status === 'LIVE' ? 'text-red-600' : 'text-slate-900'}`}>{match.away_score}</span>}
                                </div>
                            </div>
                        </Link>
                        <div className="px-3 py-2 border-t border-slate-100 grid grid-cols-2 gap-3 bg-slate-50/50">
                            <Link href={`/match/${match.id}`} className="flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:border-blue-200 rounded-lg py-2 shadow-sm text-[10px] font-bold text-slate-700 active:scale-95 transition"><Zap size={12} className="text-blue-500" /> Predict</Link>
                            {match.booking_code ? (
                                <button className="flex items-center justify-center gap-1.5 bg-[#1A1A1A] text-yellow-400 rounded-lg py-2 shadow-sm text-[10px] font-bold active:scale-95 transition"><Ticket size={12} /> {match.booking_code}</button>
                            ) : (
                                <Link href="/vip/upgrade" className="flex items-center justify-center gap-1.5 bg-green-100 text-green-700 border border-green-200 rounded-lg py-2 shadow-sm text-[10px] font-bold active:scale-95 transition"><Ticket size={12} /> Bet Now</Link>
                            )}
                        </div>
                    </div>
                ))
            )}
        </div>
      </section>

      {/* LATEST NEWS (Pushed down) */}
      <div className="px-4 mb-2 mt-4">
        <div className="flex justify-between items-center mb-2">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Latest News</h3>
            <Link href="/news" className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded">View All</Link>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm divide-y divide-slate-50">
            {latestNews.length > 0 ? latestNews.map((item) => (
                <Link href={`/news/${item.slug || '#'}`} key={item.id} className="flex gap-3 items-center p-3 active:bg-slate-50 transition">
                    <div className="w-14 h-14 bg-slate-100 rounded-lg shrink-0 overflow-hidden relative">
                        {item.image_url ? <img src={item.image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><Zap size={20}/></div>}
                    </div>
                    <div>
                        <h4 className="text-xs font-bold leading-tight line-clamp-2 text-slate-800">{item.title}</h4>
                        <span className="text-[9px] text-slate-400 mt-1 block font-medium">{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                </Link>
            )) : <div className="text-center text-[10px] text-slate-400 py-4">No recent updates</div>}
        </div>
      </div>
    </div>
  );
}