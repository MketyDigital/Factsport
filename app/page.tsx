export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { createClient } from '@/app/lib/supabase/server';
import Link from "next/link";
import { 
  Zap, Trophy, ChevronRight, Activity, Calendar, 
  Ticket, ArrowRight, Star, Clock 
} from "lucide-react";

// --- DATA FETCHING ---
async function getHomepageData(leagueFilter: string | null) {
  const supabase = createClient();
  
  // 1. Time Window: Yesterday to +2 Days (48hr view)
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 1); // Yesterday
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 2); // 48 hours from now

  // 2. Fetch Matches
  let matchQuery = supabase
    .from('matches')
    .select('*')
    .gte('match_date', startDate.toISOString())
    .lte('match_date', endDate.toISOString())
    .order('match_date', { ascending: true });

  if (leagueFilter && leagueFilter !== 'All') {
    matchQuery = matchQuery.ilike('league', `%${leagueFilter}%`);
  }

  // 3. Fetch News
  const newsQuery = supabase
    .from('news')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10); 

  const [matchesRes, newsRes] = await Promise.all([matchQuery, newsQuery]);
  
  return {
    matches: matchesRes.data || [],
    news: newsRes.data || []
  };
}

export default async function Home({ searchParams }: { searchParams: { league?: string } }) {
  const selectedLeague = searchParams.league || 'All';
  const { matches, news } = await getHomepageData(selectedLeague);

  // --- DATA PROCESSING ---
  const breakingNews = news.filter(n => n.is_breaking); 
  const headlines = news.filter(n => n.image_url && !n.is_breaking).slice(0, 3);
  const headlineIds = headlines.map(h => h.id);
  const latestNews = news.filter(n => !n.is_breaking && !headlineIds.includes(n.id)).slice(0, 5);

  const live = matches.filter(m => m.status === 'LIVE');
  const upcoming = matches.filter(m => m.status === 'SCHEDULED' || m.status === 'UPCOMING');
  const finished = matches.filter(m => m.status === 'FINISHED' || m.status === 'FT');

  upcoming.sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime());
  finished.sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime());

  const displayMatches = [...live, ...upcoming, ...finished];

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 font-sans pb-24">
      
      {/* --- HEADER (Fixed) --- */}
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

      {/* --- 1. SKY SPORTS STYLE TICKER --- */}
      {breakingNews.length > 0 && (
        <div className="bg-yellow-400 text-black text-[10px] font-black py-2 overflow-hidden relative flex items-center shadow-md z-40">
            <div className="absolute left-0 h-full bg-yellow-500 px-3 flex items-center z-10 shadow-r-xl border-r border-yellow-600">
              <Activity size={12} className="mr-1 animate-pulse text-red-600" /> BREAKING
            </div>
            <div className="whitespace-nowrap animate-marquee pl-28 flex space-x-8">
            {breakingNews.map(n => (
                <span key={n.id} className="uppercase tracking-wide">🚨 {n.title}</span>
            ))}
            </div>
        </div>
      )}

      {/* --- 2. HEADLINES SLIDER --- */}
      <div className="mt-3 px-3">
        <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-4 scrollbar-hide">
            {headlines.length > 0 ? headlines.map((item) => (
                <Link href={`/news/${item.slug}`} key={item.id} className="snap-center shrink-0 w-[85%] md:w-[400px] h-48 relative rounded-2xl overflow-hidden shadow-lg border border-white/20">
                    <img src={item.image_url || '/placeholder-news.jpg'} className="absolute inset-0 w-full h-full object-cover" alt="News" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent"></div>
                    <div className="absolute bottom-0 left-0 p-4 w-full">
                        <span className="bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase mb-1.5 inline-block shadow-sm">Top Story</span>
                        <h3 className="text-white font-bold text-base leading-tight line-clamp-2 drop-shadow-md">{item.title}</h3>
                    </div>
                </Link>
            )) : (
                <div className="snap-center shrink-0 w-[90%] h-48 relative rounded-2xl overflow-hidden shadow-sm bg-slate-200 flex items-center justify-center">
                    <p className="text-slate-400 text-xs font-bold flex items-center gap-2"><Clock size={14}/> Top Stories Loading...</p>
                </div>
            )}
        </div>
      </div>

      {/* --- 3. LATEST NEWS LIST --- */}
      <div className="px-4 mb-2">
        <div className="flex justify-between items-center mb-2">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Latest News</h3>
            <Link href="/news" className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded">View All</Link>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm divide-y divide-slate-50">
            {latestNews.length > 0 ? latestNews.map((item) => (
                <Link href={`/news/${item.slug}`} key={item.id} className="flex gap-3 items-center p-3 active:bg-slate-50 transition">
                    <div className="w-14 h-14 bg-slate-100 rounded-lg shrink-0 overflow-hidden relative">
                        {item.image_url && <img src={item.image_url} className="w-full h-full object-cover" />}
                    </div>
                    <div>
                        <h4 className="text-xs font-bold leading-tight line-clamp-2 text-slate-800">{item.title}</h4>
                        <span className="text-[9px] text-slate-400 mt-1 block font-medium">
                            {new Date(item.created_at).toLocaleDateString()}
                        </span>
                    </div>
                </Link>
            )) : (
                <div className="text-center text-[10px] text-slate-400 py-4">No recent updates</div>
            )}
        </div>
      </div>

      {/* --- 4. MATCH CENTER --- */}
      <section className="mt-6">
        
        {/* ✅ NEW: Match Center Header with "All Matches" Button */}
        <div className="px-4 flex justify-between items-center mb-2">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Match Center</h3>
            <Link href="/matches" className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded flex items-center gap-1">
                View All <ArrowRight size={10} />
            </Link>
        </div>

        {/* Horizontal League Tabs */}
        <div className="bg-white border-y border-slate-200 sticky top-14 z-30 overflow-x-auto scrollbar-hide py-2 shadow-sm">
            <div className="flex px-4 space-x-2 min-w-max">
            {['All', 'Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Champions League'].map((league) => (
                <Link 
                key={league} 
                href={`/?league=${league}`}
                className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all ${
                    selectedLeague === league 
                    ? 'bg-[#0a1428] text-white shadow-md' 
                    : 'bg-slate-50 text-slate-500 border border-slate-200'
                }`}
                >
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
                    <p className="text-[10px]">Check back later or change filters</p>
                </div>
            ) : (
                displayMatches.map((match) => (
                    <div key={match.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden mb-3">
                        
                        {/* Match Header */}
                        <div className="bg-slate-50 px-3 py-1.5 flex justify-between items-center border-b border-slate-100">
                             <div className="flex items-center gap-1">
                                {match.status === 'LIVE' ? (
                                    <span className="text-[9px] font-black text-red-600 animate-pulse flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span> LIVE
                                    </span>
                                ) : (
                                    <span className="text-[9px] font-bold text-slate-500 flex items-center gap-1">
                                        <Clock size={10} />
                                        {new Date(match.match_date).toDateString() === new Date().toDateString() 
                                          ? `Today, ${new Date(match.match_date).toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'})}`
                                          : new Date(match.match_date).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'})
                                        }
                                    </span>
                                )}
                             </div>
                             {match.league && <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider max-w-[100px] truncate">{match.league}</span>}
                        </div>

                        {/* Match Body */}
                        <Link href={`/match/${match.id}`}>
                            <div className="p-4 flex justify-between items-center active:bg-slate-50 transition">
                                {/* Home Team */}
                                <div className="flex-1 flex items-center gap-3">
                                    <div className="w-8 h-8 flex items-center justify-center shrink-0">
                                      {match.home_logo ? <img src={match.home_logo} className="w-full h-full object-contain" /> : <div className="w-6 h-6 bg-slate-200 rounded-full"></div>}
                                    </div>
                                    <span className="text-xs font-bold text-slate-800 line-clamp-1">{match.home_team}</span>
                                    {(match.status === 'LIVE' || match.status === 'FINISHED') && (
                                        <span className={`text-sm font-black ml-auto ${match.status === 'LIVE' ? 'text-red-600' : 'text-slate-900'}`}>{match.home_score}</span>
                                    )}
                                </div>

                                <div className="mx-2 text-[10px] text-slate-300 font-light">vs</div>

                                {/* Away Team */}
                                <div className="flex-1 flex items-center gap-3 flex-row-reverse text-right">
                                    <div className="w-8 h-8 flex items-center justify-center shrink-0">
                                      {match.away_logo ? <img src={match.away_logo} className="w-full h-full object-contain" /> : <div className="w-6 h-6 bg-slate-200 rounded-full"></div>}
                                    </div>
                                    <span className="text-xs font-bold text-slate-800 line-clamp-1">{match.away_team}</span>
                                    {(match.status === 'LIVE' || match.status === 'FINISHED') && (
                                        <span className={`text-sm font-black mr-auto ${match.status === 'LIVE' ? 'text-red-600' : 'text-slate-900'}`}>{match.away_score}</span>
                                    )}
                                </div>
                            </div>
                        </Link>

                        {/* Buttons */}
                        <div className="px-3 py-2 border-t border-slate-100 grid grid-cols-2 gap-3 bg-slate-50/50">
                            <Link href={`/match/${match.id}`} className="flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:border-blue-200 rounded-lg py-2 shadow-sm text-[10px] font-bold text-slate-700 active:scale-95 transition">
                                <Zap size={12} className="text-blue-500" /> Predict
                            </Link>

                            {match.booking_code ? (
                                <button className="flex items-center justify-center gap-1.5 bg-[#1A1A1A] text-yellow-400 rounded-lg py-2 shadow-sm text-[10px] font-bold active:scale-95 transition">
                                    <Ticket size={12} /> {match.booking_code}
                                </button>
                            ) : (
                                <Link href="/vip/upgrade" className="flex items-center justify-center gap-1.5 bg-green-100 text-green-700 border border-green-200 rounded-lg py-2 shadow-sm text-[10px] font-bold active:scale-95 transition">
                                    <Ticket size={12} /> Bet Now
                                </Link>
                            )}
                        </div>
                    </div>
                ))
            )}
        </div>
      </section>

      {/* --- 5. VIP SECTION --- */}
      <div className="mx-4 mb-8">
        <div className="rounded-2xl overflow-hidden relative shadow-2xl group cursor-pointer">
            <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a] to-black"></div>
            <div className="absolute top-0 right-0 w-40 h-40 bg-yellow-500 blur-[80px] opacity-20 group-hover:opacity-30 transition"></div>
            
            <div className="relative z-10 p-6 text-center">
                <div className="w-14 h-14 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(234,179,8,0.5)] group-hover:scale-110 transition-transform">
                    <Trophy className="text-black fill-black" size={28} />
                </div>
                <h2 className="text-white font-black text-xl uppercase italic tracking-tighter mb-2">
                    Monthly <span className="text-yellow-500">Jackpot</span>
                </h2>
                <p className="text-slate-400 text-xs mb-6 px-4 leading-relaxed">
                    Correctly predict 3 matches to share the ₦500,000 prize pool. Exclusive to VIP members.
                </p>
                <Link href="/vip/upgrade" className="inline-flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black font-black text-sm uppercase px-8 py-3.5 rounded-xl transition shadow-lg active:scale-95">
                    Join Winners Circle <ArrowRight size={16} />
                </Link>
            </div>
        </div>
      </div>

    </div>
  );
}