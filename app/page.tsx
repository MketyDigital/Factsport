export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { createClient } from '@/app/lib/supabase/server';
import Link from "next/link";
import { Zap, Trophy, ChevronRight, Activity, Calendar, Ticket, ArrowRight, Star } from "lucide-react";

async function getHomepageData(leagueFilter: string | null) {
  const supabase = createClient();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1); 

  let matchQuery = supabase
    .from('matches')
    .select('*')
    .gte('match_date', yesterday.toISOString())
    .order('match_date', { ascending: true });

  if (leagueFilter && leagueFilter !== 'All') {
    matchQuery = matchQuery.ilike('league', `%${leagueFilter}%`);
  }

  const newsQuery = supabase
    .from('news')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10); 

  const [matchesRes, newsRes] = await Promise.all([matchQuery, newsQuery]);
  return { matches: matchesRes.data || [], news: newsRes.data || [] };
}

export default async function Home({ searchParams }: { searchParams: { league?: string } }) {
  const selectedLeague = searchParams.league || 'All';
  const { matches, news } = await getHomepageData(selectedLeague);

  // Sorting
  const live = matches.filter(m => m.status === 'LIVE');
  const upcoming = matches.filter(m => m.status === 'SCHEDULED' || m.status === 'UPCOMING');
  const finished = matches.filter(m => m.status === 'FINISHED' || m.status === 'FT');

  upcoming.sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime());
  finished.sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime());

  const displayMatches = [...live, ...upcoming, ...finished];
  const breakingNews = news.filter(n => n.is_breaking); 
  const headlines = news.filter(n => n.image_url && !n.is_breaking).slice(0, 3);
  const latestNews = news.filter(n => !n.is_breaking).slice(3, 8);

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
            <Link href="/login" className="px-3 py-1 text-[10px] font-bold bg-white/10 hover:bg-white/20 rounded-full transition">Login</Link>
            <Link href="/vip/upgrade" className="flex items-center gap-1 px-3 py-1 text-[10px] font-bold bg-red-600 hover:bg-red-700 rounded-full shadow-lg shadow-red-900/50 transition">
                <Trophy size={10} /> VIP
            </Link>
          </div>
        </div>
      </nav>

      {/* TICKER */}
      {breakingNews.length > 0 && (
        <div className="bg-red-700 text-white text-[10px] font-bold py-1.5 overflow-hidden relative flex items-center shadow-md z-40">
            <div className="absolute left-0 h-full bg-red-800 px-3 flex items-center z-10 shadow-r-xl">
            <Activity size={10} className="mr-1 animate-pulse" /> BREAKING
            </div>
            <div className="whitespace-nowrap animate-marquee pl-28 flex space-x-8">
            {breakingNews.map(n => ( <span key={n.id}>🚨 {n.title.toUpperCase()}</span> ))}
            </div>
        </div>
      )}

      {/* SLIDER */}
      <div className="mt-2 px-2">
        <div className="flex overflow-x-auto snap-x snap-mandatory gap-2 pb-2 scrollbar-hide">
            {headlines.length > 0 ? headlines.map((item) => (
                <div key={item.id} className="snap-center shrink-0 w-[90%] md:w-[400px] h-48 relative rounded-2xl overflow-hidden shadow-lg">
                    <img src={item.image_url} className="absolute inset-0 w-full h-full object-cover" alt="News" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
                    <div className="absolute bottom-0 left-0 p-4">
                        <span className="bg-red-600 text-white text-[9px] font-bold px-2 py-0.5 rounded uppercase mb-1 inline-block">Headline</span>
                        <h3 className="text-white font-bold text-sm leading-tight line-clamp-2">{item.title}</h3>
                    </div>
                </div>
            )) : (
                <div className="snap-center shrink-0 w-[90%] h-48 relative rounded-2xl overflow-hidden shadow-lg bg-[#1a2b4b] flex items-center justify-center">
                    <p className="text-white/30 text-xs font-bold">Top Headlines Loading...</p>
                </div>
            )}
        </div>
      </div>

      {/* MATCH TABS */}
      <div className="bg-white border-y border-slate-200 sticky top-14 z-30 overflow-x-auto scrollbar-hide py-2 shadow-sm mt-4">
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

      {/* MATCH LIST */}
      <div className="px-4 py-4 space-y-3">
          {displayMatches.length === 0 ? (
              <div className="text-center py-10 opacity-50 text-xs">No matches found for {selectedLeague}.</div>
          ) : (
              displayMatches.map((match) => (
                  <div key={match.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden mb-3">
                      {/* Match Header (Date & Status) */}
                      <div className="bg-slate-50 px-3 py-1.5 flex justify-between items-center border-b border-slate-100">
                           <div className="flex items-center gap-1">
                              {match.status === 'LIVE' ? (
                                  <span className="text-[9px] font-black text-red-600 animate-pulse flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span> LIVE
                                  </span>
                              ) : (
                                  <span className="text-[9px] font-bold text-slate-500 flex items-center gap-1">
                                      <Calendar size={10} />
                                      {/* ✅ DATE FIX: Shows "Today" or Date */}
                                      {new Date(match.match_date).toDateString() === new Date().toDateString() 
                                        ? `Today, ${new Date(match.match_date).toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'})}`
                                        : new Date(match.match_date).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'})
                                      }
                                  </span>
                              )}
                           </div>
                           <span className="text-[9px] font-bold text-slate-400 uppercase">{match.status === 'FINISHED' ? 'FT' : ''}</span>
                      </div>

                      {/* Match Body */}
                      <Link href={`/match/${match.id}`}>
                          <div className="p-3 flex justify-between items-center active:bg-slate-50 transition">
                              {/* Home */}
                              <div className="flex-1 flex items-center gap-2">
                                  {/* ✅ LOGO FIX */}
                                  <div className="w-6 h-6 flex items-center justify-center">
                                    {match.home_logo ? <img src={match.home_logo} className="w-full h-full object-contain" /> : <div className="w-5 h-5 bg-slate-200 rounded-full"></div>}
                                  </div>
                                  <span className="text-xs font-bold text-slate-800 line-clamp-1">{match.home_team}</span>
                                  {(match.status === 'LIVE' || match.status === 'FINISHED') && (
                                      <span className={`text-xs font-black ml-auto ${match.status === 'LIVE' ? 'text-red-600' : 'text-slate-900'}`}>{match.home_score}</span>
                                  )}
                              </div>

                              <div className="mx-2 text-[10px] text-slate-300">vs</div>

                              {/* Away */}
                              <div className="flex-1 flex items-center gap-2 flex-row-reverse text-right">
                                  {/* ✅ LOGO FIX */}
                                  <div className="w-6 h-6 flex items-center justify-center">
                                    {match.away_logo ? <img src={match.away_logo} className="w-full h-full object-contain" /> : <div className="w-5 h-5 bg-slate-200 rounded-full"></div>}
                                  </div>
                                  <span className="text-xs font-bold text-slate-800 line-clamp-1">{match.away_team}</span>
                                  {(match.status === 'LIVE' || match.status === 'FINISHED') && (
                                      <span className={`text-xs font-black mr-auto ${match.status === 'LIVE' ? 'text-red-600' : 'text-slate-900'}`}>{match.away_score}</span>
                                  )}
                              </div>
                          </div>
                      </Link>

                      <div className="px-3 py-2 border-t border-slate-100 grid grid-cols-2 gap-2 bg-slate-50/50">
                          <Link href={`/match/${match.id}`} className="flex items-center justify-center gap-1 bg-white border border-slate-200 rounded-lg py-1.5 shadow-sm text-[10px] font-bold text-slate-700 active:scale-95 transition">
                              <Zap size={12} className="text-yellow-500 fill-yellow-500" /> Predict
                          </Link>
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

      {/* VIP BANNER */}
      <div className="mx-4 mb-8">
        <div className="rounded-2xl overflow-hidden relative shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a] to-black"></div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500 blur-[60px] opacity-20"></div>
            <div className="relative z-10 p-6 text-center">
                <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-[0_0_15px_rgba(234,179,8,0.4)]">
                    <Star className="text-black fill-black" size={24} />
                </div>
                <h2 className="text-white font-black text-xl uppercase italic tracking-tighter mb-2">
                    Join the <span className="text-yellow-500">Winners Circle</span>
                </h2>
                <Link href="/vip/upgrade" className="inline-flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black font-black text-sm uppercase px-8 py-3 rounded-xl transition shadow-lg active:scale-95">
                    Upgrade <ArrowRight size={16} />
                </Link>
            </div>
        </div>
      </div>
    </div>
  );
}