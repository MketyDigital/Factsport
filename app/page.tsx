export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 60; 

import { createClient } from '@/app/lib/supabase/server';
import Link from "next/link";
import { Zap, Trophy, Activity, Ticket, ArrowRight, PlayCircle, Video, ExternalLink, Youtube, Newspaper, Radio, Award } from "lucide-react";
import LiveScoreLabel from '@/app/components/LiveScoreLabel';
import NewsArtwork from '@/app/components/NewsArtwork';
import HeadlinesSlider from '@/app/components/HeadlinesSlider';
import FreeTipsBanner from '@/app/components/FreeTipsBanner';

// 🟢 CONFIG: Your Default 1xBet Link
const DEFAULT_AFFILIATE_LINK = "https://refpa58144.com/L?tag=d_1181253m_1599c_&site=1181253&ad=1599"; 

export const metadata = {
  title: 'FactSport | Live Scores, News & Predictions',
  description: 'The #1 Platform for sports predictions, live scores, and breaking news.',
};

async function getHomepageData(leagueFilter: string) {
  const supabase = createClient();
  const startDate = new Date(); startDate.setDate(startDate.getDate() - 1); 
  const endDate = new Date(); endDate.setDate(endDate.getDate() + 3); 

  // 1. Try to fetch UPCOMING/LIVE matches first
  let matchQuery = supabase.from('matches').select('*')
    .gte('match_date', startDate.toISOString())
    .lte('match_date', endDate.toISOString())
    .ilike('league', `%${leagueFilter}%`) // Strict League Filter
    .order('match_date', { ascending: true });

  const [matchesRes, newsRes, highlightsRes] = await Promise.all([
    matchQuery,
    supabase.from('news').select('*').order('created_at', { ascending: false }).limit(20),
    supabase.from('matches').select('*').not('video_url', 'is', null).order('match_date', { ascending: false }).limit(10)
  ]);

  let matches = matchesRes.data || [];

  // 2. FALLBACK: If no upcoming matches, fetch LAST FINISHED (Latest Results)
  if (matches.length === 0) {
      const { data: finishedMatches } = await supabase.from('matches').select('*')
        .ilike('league', `%${leagueFilter}%`)
        .in('status', ['FT', 'FINISHED', 'post'])
        .order('match_date', { ascending: false }) // Get latest first
        .limit(10); // Show last 10 results
      
      if (finishedMatches) matches = finishedMatches;
  }

  return { matches, news: newsRes.data || [], highlights: highlightsRes.data || [] };
}

export default async function Home({ searchParams }: { searchParams: { league?: string } }) {
  const resolvedParams = await searchParams;
  // ✅ CHANGED: Default is now 'Premier League', not 'All'
  const selectedLeague = resolvedParams.league || 'Premier League';
  
  const { matches, news, highlights } = await getHomepageData(selectedLeague);

  // Sorting
  const breakingNews = news.filter(n => n.is_breaking); 
  const rawTicker = breakingNews.length > 0 ? breakingNews : news.slice(0, 5);
  const tickerNews = [...rawTicker, ...rawTicker, ...rawTicker, ...rawTicker]; 

  const headlines = news.filter(n => n.is_headline).slice(0, 5);
  const finalHeadlines = headlines.length > 0 ? headlines : news.slice(0, 3);
  const latestNews = news.filter(n => !finalHeadlines.some(h => h.id === n.id) && !n.is_breaking).slice(0, 5);

  // Display Logic: If mixed list, sort nicely. If fallback (all finished), they are already sorted.
  const displayMatches = matches; 

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 font-sans pb-0 overflow-x-hidden">
      
      {/* CSS FOR SEAMLESS TICKER */}
      <style>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); } 
        }
        .animate-scroll {
          display: flex;
          width: max-content;
          animation: scroll 60s linear infinite;
        }
        .ticker-item {
          white-space: nowrap; 
          display: flex;
          align-items: center;
        }
      `}</style>

      {/* 1. SEAMLESS TV TICKER */}
      {tickerNews.length > 0 && (
        <div className="bg-yellow-400 text-black text-[10px] font-black h-9 overflow-hidden relative flex items-center shadow-md z-40 border-b border-yellow-500">
            <div className="absolute left-0 h-full bg-yellow-500 px-3 flex items-center z-20 shadow-[4px_0_10px_rgba(0,0,0,0.1)] border-r border-yellow-600 whitespace-nowrap">
                <Activity size={12} className="mr-1 animate-pulse text-red-600" /> BREAKING
            </div>
            <div className="w-full overflow-hidden flex pl-24"> 
                <div className="animate-scroll flex items-center">
                    {tickerNews.map((n, i) => ( 
                        <div key={`${n.id}-${i}`} className="ticker-item flex items-center mx-6">
                            <Link href={`/news/${n.slug}`} className="uppercase tracking-wide hover:underline hover:text-red-700 transition">
                                🚨 {n.title}
                            </Link>
                            <span className="text-yellow-700/50 ml-6">•</span>
                        </div> 
                    ))}
                </div>
            </div>
        </div>
      )}

      {/* 2. AUTO-SLIDER */}
      {finalHeadlines.length > 0 && <div className="mt-4 px-4"><HeadlinesSlider headlines={finalHeadlines} /></div>}

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
                        <NewsArtwork image={item.image_url} team1Logo={item.team_1_logo} team2Logo={item.team_2_logo} title={item.title} className="w-full h-full" />
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
            {/* ✅ CHANGED: Bigger Button & New Text */}
            <Link href="/matches" className="text-[10px] font-black bg-[#0a1428] text-white px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-md active:scale-95 transition">
                Go to All Fixtures <ArrowRight size={10} />
            </Link>
        </div>
        
        {/* ✅ CHANGED: Removed 'All' tab, kept only specific leagues */}
        <div className="bg-white border-y border-slate-200 sticky top-14 z-30 overflow-x-auto scrollbar-hide py-2 shadow-sm">
            <div className="flex px-4 space-x-2 min-w-max">
            {['Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Champions League'].map((league) => (
                <Link key={league} href={`/?league=${league}`} scroll={false} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all ${selectedLeague === league ? 'bg-[#0a1428] text-white shadow-md' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>{league === 'Premier League' ? 'EPL' : league}</Link>
            ))}
            </div>
        </div>
        
        <div className="px-4 py-4 space-y-3">
             {displayMatches.length > 0 ? displayMatches.map((match) => (
                  <div key={match.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden mb-3">
                      <div className="bg-slate-50 px-3 py-1.5 flex justify-between items-center border-b border-slate-100">
                           <div className="flex items-center gap-2">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider max-w-[120px] truncate">{match.league || 'Football Match'}</span>
                           </div>
                           <div className="flex items-center gap-2">
                                {match.livestream_url && <span className="flex items-center gap-1 text-[8px] font-black text-red-600 animate-pulse bg-red-50 px-1.5 py-0.5 rounded border border-red-100"><Video size={8}/> WATCH LIVE</span>}
                                {match.audio_url && <span className="flex items-center gap-1 text-[8px] font-black text-blue-600 animate-pulse bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100"><Radio size={8}/> RADIO</span>}
                           </div>
                      </div>
                      
                      <Link href={`/match/${match.id}`}>
                          <div className="p-4 flex justify-between items-center active:bg-slate-50 transition">
                              <div className="flex-1 flex items-center gap-3 overflow-hidden">
                                  <div className="w-8 h-8 flex items-center justify-center shrink-0">{match.home_logo ? <img src={match.home_logo} className="w-full h-full object-contain" /> : <div className="w-6 h-6 bg-slate-200 rounded-full"></div>}</div>
                                  <span className="text-xs font-bold text-slate-800 truncate">{match.home_team}</span>
                              </div>
                              <div className="px-4 min-w-[80px] flex justify-center border-x border-slate-50">
                                  <LiveScoreLabel matchId={match.id} initialStatus={match.status} homeScore={match.home_score} awayScore={match.away_score} matchDate={match.match_date} />
                              </div>
                              <div className="flex-1 flex items-center gap-3 flex-row-reverse text-right overflow-hidden">
                                  <div className="w-8 h-8 flex items-center justify-center shrink-0">{match.away_logo ? <img src={match.away_logo} className="w-full h-full object-contain" /> : <div className="w-6 h-6 bg-slate-200 rounded-full"></div>}</div>
                                  <span className="text-xs font-bold text-slate-800 truncate">{match.away_team}</span>
                              </div>
                          </div>
                      </Link>

                      <div className="px-3 py-2 border-t border-slate-100 grid grid-cols-2 gap-3 bg-slate-50/50">
                          <Link href={`/match/${match.id}`} className="flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:border-blue-200 rounded-lg py-2 shadow-sm text-[10px] font-bold text-slate-700 active:scale-95 transition"><Zap size={12} className="text-blue-500" /> Predict</Link>
                          {match.booking_code ? (
                              <button className="flex items-center justify-center gap-1.5 bg-[#1A1A1A] text-yellow-400 rounded-lg py-2 shadow-sm text-[10px] font-bold active:scale-95 transition">
                                  <Ticket size={12} /> {match.booking_code}
                              </button>
                          ) : (
                              <a 
                                href={match.affiliate_link || DEFAULT_AFFILIATE_LINK} 
                                target="_blank"
                                className="flex items-center justify-center gap-1.5 bg-green-100 text-green-700 border border-green-200 rounded-lg py-2 shadow-sm text-[10px] font-bold active:scale-95 transition"
                              >
                                  <ExternalLink size={12} /> Bet Now
                              </a>
                          )}
                      </div>
                  </div>
              )) : (
                <div className="text-center py-10 opacity-50">
                   <p className="text-xs font-bold">No recent matches found.</p>
                </div>
              )}
        </div>
      </section>

      {/* 🟢 FREE TIPS BANNER */}
      <div className="px-4">
        <FreeTipsBanner />
      </div>

      {/* 6. VIP REWARD */}
      <div className="mx-4 mb-4 mt-6">
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

{/* 🚀 QUICK ACTION LINKS (Clean Buttons Only) */}
      <div className="grid grid-cols-4 gap-3 px-4 py-6">
          {/* Predict */}
          <Link href="/matches" className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition hover:shadow-md">
              <Trophy className="text-yellow-500" size={20} />
              <span className="text-[10px] font-bold text-slate-700">Predict</span>
          </Link>

          {/* Leaders */}
          <Link href="/leaderboard" className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition hover:shadow-md">
              <Award className="text-yellow-500" size={20} />
              <span className="text-[10px] font-bold text-slate-700">Leaders</span>
          </Link>

          {/* News */}
          <Link href="/news" className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition hover:shadow-md">
              <Newspaper className="text-blue-500" size={20} />
              <span className="text-[10px] font-bold text-slate-700">News</span>
          </Link>

          {/* YouTube */}
          <a href="https://youtube.com/@factsportlive" target="_blank" className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition hover:shadow-md">
              <Youtube className="text-red-600" size={20} />
              <span className="text-[10px] font-bold text-slate-700">YouTube</span>
          </a>
      </div>
  );
}