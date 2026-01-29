export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0; // ✅ FIX: Forces page to rebuild instantly so new News shows up

import { createClient } from '@/app/lib/supabase/server';
import Link from "next/link";
import { Zap, Trophy, Activity, Ticket, ArrowRight, PlayCircle, ShieldCheck } from "lucide-react";
import LiveScoreLabel from '@/app/components/LiveScoreLabel';
import NewsArtwork from '@/app/components/NewsArtwork';
import HeadlinesSlider from '@/app/components/HeadlinesSlider'; // ✅ IMPORT NEW SLIDER

// SEO Metadata
export const metadata = {
  title: 'FactSport | Live Scores, News & Predictions',
  description: 'The #1 Platform for sports predictions, live scores, and breaking news. Join VIP to win monthly prizes.',
};

async function getHomepageData(leagueFilter: string | null) {
  const supabase = createClient();
  const startDate = new Date(); startDate.setDate(startDate.getDate() - 1); 
  const endDate = new Date(); endDate.setDate(endDate.getDate() + 3); 

  // 1. Matches
  let matchQuery = supabase.from('matches')
    .select('*')
    .gte('match_date', startDate.toISOString())
    .lte('match_date', endDate.toISOString())
    .order('match_date', { ascending: true });
    
  if (leagueFilter && leagueFilter !== 'All') {
      matchQuery = matchQuery.ilike('league', `%${leagueFilter}%`);
  }

  // 2. News 
  const newsQuery = supabase.from('news')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20); 

  // 3. Highlights
  const highlightsQuery = supabase.from('matches')
    .select('*')
    .not('video_url', 'is', null)
    .order('match_date', { ascending: false })
    .limit(10);

  const [matchesRes, newsRes, highlightsRes] = await Promise.all([matchQuery, newsQuery, highlightsQuery]);
  return { matches: matchesRes.data || [], news: newsRes.data || [], highlights: highlightsRes.data || [] };
}

export default async function Home({ searchParams }: { searchParams: { league?: string } }) {
  const resolvedParams = await searchParams;
  const selectedLeague = resolvedParams.league || 'All';
  const { matches, news, highlights } = await getHomepageData(selectedLeague);

  // Sorting Logic
  const breakingNews = news.filter(n => n.is_breaking); 
  // If no manually set breaking news, use the latest 3 regular news items
  const tickerNews = breakingNews.length > 0 ? breakingNews : news.slice(0, 5);

  const headlines = news.filter(n => n.is_headline).slice(0, 5);
  // Fallback: If no headlines set, grab top 3 latest
  const finalHeadlines = headlines.length > 0 ? headlines : news.slice(0, 3);
  
  const headlineIds = finalHeadlines.map(h => h.id);
  const latestNews = news.filter(n => !headlineIds.includes(n.id) && !n.is_breaking).slice(0, 5);

  const live = matches.filter(m => m.status === 'LIVE' || m.status === 'in' || m.status === '1H' || m.status === '2H' || m.status === 'HT');
  const upcoming = matches.filter(m => m.status === 'SCHEDULED' || m.status === 'UPCOMING' || m.status === 'PRE');
  const finished = matches.filter(m => m.status === 'FINISHED' || m.status === 'FT' || m.status === 'post');
  
  const displayMatches = [...live, ...upcoming, ...finished];

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 font-sans pb-24 overflow-x-hidden">
      
      {/* ✅ CSS FOR SCROLLING TICKER */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          display: inline-block;
          animation: marquee 20s linear infinite;
        }
      `}</style>

      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 bg-[#0a1428] text-white border-b border-white/10 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="relative flex items-center justify-center w-8 h-8"><div className="absolute w-full h-full bg-gradient-to-r from-red-600 to-blue-800 clip-hexagon"></div><span className="relative font-bold italic text-white text-[10px]">FS</span></div>
            <Link href="/" className="text-xl font-black tracking-tighter text-white">FactSport</Link>
          </div>
          <div className="flex items-center space-x-3">
            <a href="/privacy-policy" className="text-[10px] font-bold text-slate-400 hover:text-white transition uppercase">Privacy Policy</a>
            <Link href="/login" className="px-4 py-1.5 text-[10px] font-bold bg-white/10 hover:bg-white/20 rounded-full transition hidden md:block">Login</Link>
            <Link href="/vip/upgrade" className="flex items-center gap-1 px-4 py-1.5 text-[10px] font-bold bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 rounded-full shadow-lg shadow-red-900/50 transition">
                <Trophy size={11} /> Predict & Win
            </Link>
          </div>
        </div>
      </nav>

      {/* 1. ✅ SCROLLING NEWS TICKER */}
      {tickerNews.length > 0 && (
        <div className="bg-yellow-400 text-black text-[10px] font-black py-2 overflow-hidden relative flex items-center shadow-md z-40 border-b border-yellow-500">
            <div className="absolute left-0 h-full bg-yellow-500 px-3 flex items-center z-10 shadow-r-xl border-r border-yellow-600"><Activity size={12} className="mr-1 animate-pulse text-red-600" /> BREAKING</div>
            <div className="w-full overflow-hidden">
                <div className="whitespace-nowrap animate-marquee">
                    {tickerNews.map((n, i) => ( 
                        <span key={n.id} className="mx-6">
                            <Link href={`/news/${n.slug}`} className="uppercase tracking-wide hover:underline hover:text-red-700 transition">
                                🚨 {n.title}
                            </Link>
                            {i < tickerNews.length - 1 && <span className="ml-6 text-yellow-700">|</span>}
                        </span> 
                    ))}
                </div>
            </div>
        </div>
      )}

      {/* 2. ✅ AUTO-SLIDING HEADLINES */}
      {finalHeadlines.length > 0 && (
        <div className="mt-4 px-4">
            <HeadlinesSlider headlines={finalHeadlines} />
        </div>
      )}

      {/* 3. HIGHLIGHTS */}
      {highlights.length > 0 && (
        <div className="mt-4 px-4">
             <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2"><PlayCircle size={14} className="text-red-600" /> Highlights</h3>
            </div>
            <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-2 scrollbar-hide">
                {highlights.map((item: any) => (
                    <Link href={`/match/${item.id}`} key={item.id} className="snap-center shrink-0 w-[180px] group">
                        <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-md border border-slate-100 mb-2">
                            <div className="absolute inset-0 bg-[#0a1428] flex items-center justify-center gap-4 opacity-80 group-hover:opacity-60 transition">
                                <div className="w-8 h-8 flex items-center justify-center">{item.home_logo ? <img src={item.home_logo} className="w-full h-full object-contain"/> : <span className="text-white text-[10px]">{item.home_team.substring(0,3)}</span>}</div>
                                <span className="text-slate-500 font-bold">VS</span>
                                <div className="w-8 h-8 flex items-center justify-center">{item.away_logo ? <img src={item.away_logo} className="w-full h-full object-contain"/> : <span className="text-white text-[10px]">{item.away_team.substring(0,3)}</span>}</div>
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center"><PlayCircle className="text-white drop-shadow-lg group-hover:scale-110 transition" size={32} /></div>
                        </div>
                        <h4 className="text-[10px] font-bold text-slate-800 leading-tight truncate">{item.home_team} <span className="text-slate-400">vs</span> {item.away_team}</h4>
                    </Link>
                ))}
            </div>
        </div>
      )}

      {/* 4. LATEST NEWS */}
      <div className="px-4 mb-4 mt-6">
        <div className="flex justify-between items-center mb-2">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Latest News</h3>
            <Link href="/news" className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded">View All</Link>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm divide-y divide-slate-50">
            {latestNews.length > 0 ? latestNews.map((item) => (
                <Link href={`/news/${item.slug || '#'}`} key={item.id} className="flex gap-3 items-center p-3 active:bg-slate-50 transition">
                    <div className="w-14 h-14 bg-slate-100 rounded-lg shrink-0 overflow-hidden relative">
                        <NewsArtwork 
                           image={item.image_url} 
                           team1Logo={item.team_1_logo} 
                           team2Logo={item.team_2_logo}
                           title={item.title}
                           className="w-full h-full"
                        />
                    </div>
                    <div>
                        <h4 className="text-xs font-bold leading-tight line-clamp-2 text-slate-800">{item.title}</h4>
                        <span className="text-[9px] text-slate-400 mt-1 block font-medium">{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                </Link>
            )) : <div className="text-center text-[10px] text-slate-400 py-4">No recent updates</div>}
        </div>
      </div>

      {/* 5. MATCH CENTER */}
      <section className="mt-6">
         <div className="px-4 flex justify-between items-center mb-2">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Match Center</h3>
            <Link href="/matches" className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded flex items-center gap-1">View All <ArrowRight size={10} /></Link>
        </div>
        <div className="bg-white border-y border-slate-200 sticky top-14 z-30 overflow-x-auto scrollbar-hide py-2 shadow-sm">
            <div className="flex px-4 space-x-2 min-w-max">
            {['All', 'Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Champions League'].map((league) => (
                <Link 
                  key={league} 
                  href={`/?league=${league}`} 
                  scroll={false} 
                  className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all ${selectedLeague === league ? 'bg-[#0a1428] text-white shadow-md' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}
                >
                  {league === 'Premier League' ? 'EPL' : league}
                </Link>
            ))}
            </div>
        </div>
        <div className="px-4 py-4 space-y-3">
             {displayMatches.map((match) => (
                  <div key={match.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden mb-3">
                      <div className="bg-slate-50 px-3 py-1.5 flex justify-between items-center border-b border-slate-100">
                           <div className="flex items-center gap-1">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider max-w-[150px] truncate">{match.league || 'Football Match'}</span>
                           </div>
                           <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest italic">FactSport Exclusive</span>
                      </div>
                      
                      <Link href={`/match/${match.id}`}>
                          <div className="p-4 flex justify-between items-center active:bg-slate-50 transition">
                              <div className="flex-1 flex items-center gap-3 overflow-hidden">
                                  <div className="w-8 h-8 flex items-center justify-center shrink-0">
                                      {match.home_logo ? <img src={match.home_logo} className="w-full h-full object-contain" /> : <div className="w-6 h-6 bg-slate-200 rounded-full"></div>}
                                  </div>
                                  <span className="text-xs font-bold text-slate-800 truncate">{match.home_team}</span>
                              </div>

                              <div className="px-4 min-w-[80px] flex justify-center border-x border-slate-50">
                                  <LiveScoreLabel 
                                    matchId={match.id}
                                    initialStatus={match.status}
                                    homeScore={match.home_score}
                                    awayScore={match.away_score}
                                    matchDate={match.match_date}
                                  />
                              </div>

                              <div className="flex-1 flex items-center gap-3 flex-row-reverse text-right overflow-hidden">
                                  <div className="w-8 h-8 flex items-center justify-center shrink-0">
                                      {match.away_logo ? <img src={match.away_logo} className="w-full h-full object-contain" /> : <div className="w-6 h-6 bg-slate-200 rounded-full"></div>}
                                  </div>
                                  <span className="text-xs font-bold text-slate-800 truncate">{match.away_team}</span>
                              </div>
                          </div>
                      </Link>

                      <div className="px-3 py-2 border-t border-slate-100 grid grid-cols-2 gap-3 bg-slate-50/50">
                          <Link href={`/match/${match.id}`} className="flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:border-blue-200 rounded-lg py-2 shadow-sm text-[10px] font-bold text-slate-700 active:scale-95 transition"><Zap size={12} className="text-blue-500" /> Predict</Link>
                          {match.booking_code ? (<button className="flex items-center justify-center gap-1.5 bg-[#1A1A1A] text-yellow-400 rounded-lg py-2 shadow-sm text-[10px] font-bold active:scale-95 transition"><Ticket size={12} /> {match.booking_code}</button>) : (<Link href="/vip/upgrade" className="flex items-center justify-center gap-1.5 bg-green-100 text-green-700 border border-green-200 rounded-lg py-2 shadow-sm text-[10px] font-bold active:scale-95 transition"><Ticket size={12} /> Bet Now</Link>)}
                      </div>
                  </div>
              ))}
        </div>
      </section>

      {/* 6. VIP REWARD SECTION */}
      <div className="mx-4 mb-4">
        <div className="rounded-2xl overflow-hidden relative shadow-2xl group cursor-pointer bg-black p-6 text-center">
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500 blur-[60px] opacity-20 group-hover:opacity-30 transition"></div>
            <div className="relative z-10">
                <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-[0_0_15px_rgba(234,179,8,0.4)]">
                    <Trophy className="text-black fill-black" size={24} />
                </div>
                <h2 className="text-white font-black text-xl uppercase italic tracking-tighter mb-2">Monthly <span className="text-yellow-500">Jackpot</span></h2>
                <p className="text-slate-400 text-xs mb-6 px-4">Correctly predict 3 matches to share the ₦500,000 prize pool. Exclusive to VIP members.</p>
                <Link href="/vip/upgrade" className="inline-flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black font-black text-sm uppercase px-8 py-3 rounded-xl transition shadow-lg active:scale-95">Join Winners Circle <ArrowRight size={16} /></Link>
            </div>
        </div>
      </div>

      {/* ✅ CLEAN LEGAL STRIP */}
      <div className="w-full flex items-center justify-center py-6 bg-[#F0F2F5] text-slate-400">
         <a href="/privacy-policy" className="text-[10px] font-bold uppercase hover:text-slate-600 transition flex items-center gap-1">
            <ShieldCheck size={12} /> Privacy Policy
         </a>
      </div>

    </div>
  );
}