export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { createClient } from '@/app/lib/supabase/server';
import Link from "next/link";
import { 
  Zap, Trophy, ChevronRight, Activity, Calendar, 
  Ticket, ArrowRight, PlayCircle, Star 
} from "lucide-react";

// --- DATA FETCHING ---
async function getHomepageData(leagueFilter: string | null) {
  const supabase = createClient();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1); 

  // 1. Fetch Matches (Last 24h + Upcoming)
  let matchQuery = supabase
    .from('matches')
    .select('*')
    .gte('match_date', yesterday.toISOString())
    .order('match_date', { ascending: true });

  if (leagueFilter && leagueFilter !== 'All') {
    matchQuery = matchQuery.ilike('league', `%${leagueFilter}%`);
  }

  // 2. Fetch News (All types)
  const newsQuery = supabase
    .from('news')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10); // Fetch top 10 recent news

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

  // 1. News Segments
  const breakingNews = news.filter(n => n.is_breaking); 
  const headlines = news.filter(n => n.image_url && !n.is_breaking).slice(0, 3); // Big Slider (Top 3 with images)
  const latestNews = news.filter(n => !n.is_breaking).slice(3, 8); // Next 5 for list

  // 2. Match Sorting (Live -> Upcoming -> Finished)
  const live = matches.filter(m => m.status === 'LIVE');
  const upcoming = matches.filter(m => m.status === 'SCHEDULED' || m.status === 'UPCOMING');
  const finished = matches.filter(m => m.status === 'FINISHED' || m.status === 'FT');

  // Time sorts
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
            <Link href="/login" className="px-3 py-1 text-[10px] font-bold bg-white/10 hover:bg-white/20 rounded-full transition">Login</Link>
            <Link href="/vip/upgrade" className="flex items-center gap-1 px-3 py-1 text-[10px] font-bold bg-red-600 hover:bg-red-700 rounded-full shadow-lg shadow-red-900/50 transition">
                <Trophy size={10} /> VIP
            </Link>
          </div>
        </div>
      </nav>

      {/* --- 1. TINY NEWS TICKER --- */}
      {breakingNews.length > 0 && (
        <div className="bg-red-700 text-white text-[10px] font-bold py-1.5 overflow-hidden relative flex items-center shadow-md z-40">
            <div className="absolute left-0 h-full bg-red-800 px-3 flex items-center z-10 shadow-r-xl">
            <Activity size={10} className="mr-1 animate-pulse" /> BREAKING
            </div>
            <div className="whitespace-nowrap animate-marquee pl-28 flex space-x-8">
            {breakingNews.map(n => (
                <span key={n.id}>🚨 {n.title.toUpperCase()}</span>
            ))}
            </div>
        </div>
      )}

      {/* --- 2. BIG SLIDING HEADLINES (3 Slides) --- */}
      <div className="mt-2 px-2">
        <div className="flex overflow-x-auto snap-x snap-mandatory gap-2 pb-2 scrollbar-hide">
            {headlines.length > 0 ? headlines.map((item) => (
                <div key={item.id} className="snap-center shrink-0 w-[90%] md:w-[400px] h-48 relative rounded-2xl overflow-hidden shadow-lg">
                    <img src={item.image_url || 'https://images.unsplash.com/photo-1522778119026-d647f0565c6a'} className="absolute inset-0 w-full h-full object-cover" alt="News" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
                    <div className="absolute bottom-0 left-0 p-4">
                        <span className="bg-red-600 text-white text-[9px] font-bold px-2 py-0.5 rounded uppercase mb-1 inline-block">Headline</span>
                        <h3 className="text-white font-bold text-sm leading-tight line-clamp-2">{item.title}</h3>
                    </div>
                </div>
            )) : (
                // Placeholder if no headlines
                <div className="snap-center shrink-0 w-[90%] h-48 relative rounded-2xl overflow-hidden shadow-lg bg-slate-800">
                    <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs">No Headlines Set</div>
                </div>
            )}
        </div>
      </div>

      {/* --- 3. LATEST NEWS (5 Titles + Thumbs) --- */}
      <div className="px-4 py-2">
        <div className="flex justify-between items-center mb-2">
            <h3 className="text-xs font-black uppercase text-slate-400">Latest Updates</h3>
            <Link href="/news" className="text-[10px] text-blue-600 font-bold">View All</Link>
        </div>
        <div className="space-y-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
            {latestNews.length > 0 ? latestNews.map((item) => (
                <div key={item.id} className="flex gap-3 items-start border-b border-slate-50 last:border-0 last:pb-0 pb-2">
                    <div className="w-12 h-12 bg-slate-200 rounded-lg shrink-0 overflow-hidden">
                        {item.image_url && <img src={item.image_url} className="w-full h-full object-cover" />}
                    </div>
                    <div>
                        <h4 className="text-xs font-bold leading-tight line-clamp-2">{item.title}</h4>
                        <span className="text-[9px] text-slate-400 mt-1 block">{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                </div>
            )) : (
                <div className="text-center text-[10px] text-slate-400 py-2">No updates available</div>
            )}
        </div>
      </div>

      {/* --- 4. MATCH CENTER (Grouped Horizontally) --- */}
      <section className="mt-4">
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

        {/* Vertical Match List */}
        <div className="px-4 py-4 space-y-3">
            {displayMatches.length === 0 ? (
                <div className="text-center py-10 opacity-50 text-xs">No matches found for {selectedLeague}.</div>
            ) : (
                displayMatches.map((match) => (
                    <div key={match.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden mb-3">
                        {/* Match Header (Time & Status) */}
                        <div className="bg-slate-50 px-3 py-1.5 flex justify-between items-center border-b border-slate-100">
                             <div className="flex items-center gap-1">
                                {match.status === 'LIVE' ? (
                                    <span className="text-[9px] font-black text-red-600 animate-pulse flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span> LIVE
                                    </span>
                                ) : (
                                    <span className="text-[9px] font-bold text-slate-500 flex items-center gap-1">
                                        <Calendar size={10} />
                                        {new Date(match.match_date).toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'})}
                                    </span>
                                )}
                             </div>
                             <span className="text-[9px] font-bold text-slate-400 uppercase">{match.status === 'FINISHED' ? 'FT' : ''}</span>
                        </div>

                        {/* Match Body (Teams & Scores) */}
                        <Link href={`/match/${match.id}`}>
                            <div className="p-3 flex justify-between items-center active:bg-slate-50 transition">
                                {/* Home */}
                                <div className="flex-1 flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-800 line-clamp-1">{match.home_team}</span>
                                    {(match.status === 'LIVE' || match.status === 'FINISHED') && (
                                        <span className={`text-xs font-black ml-auto ${match.status === 'LIVE' ? 'text-red-600' : 'text-slate-900'}`}>{match.home_score}</span>
                                    )}
                                </div>

                                {/* Divider */}
                                <div className="mx-3 text-[10px] text-slate-300">vs</div>

                                {/* Away */}
                                <div className="flex-1 flex items-center gap-2 flex-row-reverse text-right">
                                    <span className="text-xs font-bold text-slate-800 line-clamp-1">{match.away_team}</span>
                                    {(match.status === 'LIVE' || match.status === 'FINISHED') && (
                                        <span className={`text-xs font-black mr-auto ${match.status === 'LIVE' ? 'text-red-600' : 'text-slate-900'}`}>{match.away_score}</span>
                                    )}
                                </div>
                            </div>
                        </Link>

                        {/* Match Footer (Actions) */}
                        <div className="px-3 py-2 border-t border-slate-100 grid grid-cols-2 gap-2 bg-slate-50/50">
                            {/* Predict Button */}
                            <Link href={`/match/${match.id}`} className="flex items-center justify-center gap-1 bg-white border border-slate-200 rounded-lg py-1.5 shadow-sm text-[10px] font-bold text-slate-700 active:scale-95 transition">
                                <Zap size={12} className="text-yellow-500 fill-yellow-500" /> Predict
                            </Link>

                            {/* Booking/Betting Button */}
                            {match.booking_code ? (
                                <button className="flex items-center justify-center gap-1 bg-[#1A1A1A] text-yellow-400 rounded-lg py-1.5 shadow-sm text-[10px] font-bold active:scale-95 transition">
                                    <Ticket size={12} /> {match.booking_code}
                                </button>
                            ) : (
                                <Link href="/vip/upgrade" className="flex items-center justify-center gap-1 bg-green-100 text-green-700 border border-green-200 rounded-lg py-1.5 shadow-sm text-[10px] font-bold active:scale-95 transition">
                                    <Ticket size={12} /> Bet Now
                                </Link>
                            )}
                        </div>
                    </div>
                ))
            )}
        </div>
      </section>

      {/* --- 5. JOIN VIP SECTION --- */}
      <div className="mx-4 mb-8">
        <div className="rounded-2xl overflow-hidden relative shadow-2xl">
            {/* Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a] to-black"></div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500 blur-[60px] opacity-20"></div>

            <div className="relative z-10 p-6 text-center">
                <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-[0_0_15px_rgba(234,179,8,0.4)]">
                    <Star className="text-black fill-black" size={24} />
                </div>
                <h2 className="text-white font-black text-xl uppercase italic tracking-tighter mb-2">
                    Join the <span className="text-yellow-500">Winners Circle</span>
                </h2>
                <p className="text-slate-400 text-xs mb-6 px-4">
                    Get access to 98% accurate betting tips, premium analysis, and qualify for the ₦500,000 monthly jackpot.
                </p>
                <Link href="/vip/upgrade" className="inline-flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black font-black text-sm uppercase px-8 py-3 rounded-xl transition shadow-lg active:scale-95">
                    Upgrade to VIP <ArrowRight size={16} />
                </Link>
            </div>
        </div>
      </div>

    </div>
  );
}