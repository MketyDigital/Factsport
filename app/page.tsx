export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { createClient } from '@/app/lib/supabase/server';
import Link from "next/link";
import { Zap, Activity, ArrowRight, PlayCircle, Video, ExternalLink, Youtube, Newspaper, Radio, TrendingUp, Calendar, BarChart2, Award, Trophy } from "lucide-react";
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

const formatDateLabel = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

// Helper: Group matches by Date for display
const groupByDate = (matchList: any[]) => {
    const groups: { [date: string]: any[] } = {};
    matchList.forEach(m => {
        const dateObj = new Date(m.match_date);
        const dateKey = dateObj.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(m);
    });
    return groups;
};

// 🟢 HELPER: Sort Matches (Live -> Upcoming by Time)
const sortMatches = (matches: any[]) => {
  return matches.sort((a, b) => {
    // 1. STATUS PRIORITY: LIVE/HT is always first
    const liveStatus = ['LIVE', 'HT', 'IN_PLAY'];
    const isLiveA = liveStatus.includes(a.status);
    const isLiveB = liveStatus.includes(b.status);

    if (isLiveA && !isLiveB) return -1; // A comes first
    if (!isLiveA && isLiveB) return 1;  // B comes first

    // 2. IF BOTH LIVE: Sort by ID (Just to keep stable)
    if (isLiveA && isLiveB) return a.id - b.id;

    // 3. IF NEITHER LIVE: Sort by Date (Soonest first)
    return new Date(a.match_date).getTime() - new Date(b.match_date).getTime();
  });
};

// 🟢 SMART MIXER: Ensures variety of leagues (Preserved from your code)
const getDiverseMatches = (allMatches: any[], limit: number) => {
    const live = allMatches.filter(m => ['LIVE', 'HT', 'IN_PLAY'].includes(m.status));
    const scheduled = allMatches.filter(m => !['LIVE', 'HT', 'IN_PLAY'].includes(m.status));

    const leagues: { [key: string]: any[] } = {};
    scheduled.forEach(m => {
        if (!leagues[m.league]) leagues[m.league] = [];
        leagues[m.league].push(m);
    });

    const mixedScheduled: any[] = [];
    const leagueKeys = Object.keys(leagues);
    let hasMore = true;

    while (hasMore && mixedScheduled.length < limit) {
        hasMore = false;
        for (const league of leagueKeys) {
            if (leagues[league].length > 0) {
                mixedScheduled.push(leagues[league].shift());
                hasMore = true;
            }
        }
    }
    // Apply final sort to the mixed result
    return sortMatches([...live, ...mixedScheduled].slice(0, limit));
};

async function getHomepageData(leagueFilter: string | undefined) {
  const supabase = createClient();
   
  let matchQuery = supabase.from('matches').select('*');

  // 🟢 LOGIC 1: LEAGUE FILTER
  if (leagueFilter) {
      const startDate = new Date(); startDate.setDate(startDate.getDate() - 1); 
      const endDate = new Date(); endDate.setDate(endDate.getDate() + 3); 
      matchQuery = matchQuery
        .gte('match_date', startDate.toISOString())
        .lte('match_date', endDate.toISOString())
        .ilike('league', `%${leagueFilter}%`)
        .order('match_date', { ascending: true });
  } 
  // 🟢 LOGIC 2: "FOR YOU"
  else {
      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      const tomorrowEnd = new Date(); 
      tomorrowEnd.setDate(tomorrowEnd.getDate() + 1); 
      tomorrowEnd.setHours(23,59,59,999);
      
      matchQuery = matchQuery
        .or(`status.eq.LIVE,status.eq.IN_PLAY,status.eq.HT,match_date.gte.${todayStart.toISOString()}`)
        .lte('match_date', tomorrowEnd.toISOString()) 
        .order('match_date', { ascending: true })
        .limit(50); 
  }

  // Fetch Data
  const [matchesRes, newsRes, highlightsRes, featuredRes] = await Promise.all([
    matchQuery,
    supabase.from('news').select('*').order('created_at', { ascending: false }).limit(20),
    supabase.from('matches').select('*').not('video_url', 'is', null).order('match_date', { ascending: false }).limit(10),
    // Fetch manually featured matches
    supabase.from('matches').select('*').eq('is_featured', true).order('match_date', { ascending: true }).limit(5)
  ]);

  let matches = matchesRes.data || [];

  // Apply Mixer if no filter
  if (!leagueFilter && matches.length > 0) {
      matches = getDiverseMatches(matches, 20);
  } else {
      // Ensure sorted even if filtered
      matches = sortMatches(matches);
  }

  // Fallback
  if (matches.length === 0 && !leagueFilter) {
      const { data: finishedMatches } = await supabase.from('matches').select('*')
        .in('status', ['FT', 'FINISHED', 'ABD']) 
        .order('match_date', { ascending: false })
        .limit(10);
      if (finishedMatches) matches = finishedMatches;
  }

  return { 
      matches, 
      news: newsRes.data || [], 
      highlights: highlightsRes.data || [], 
      featuredMatches: featuredRes.data || [] 
  };
}

export default async function Home({ searchParams }: { searchParams: { league?: string } }) {
  const resolvedParams = await searchParams;
  const selectedLeague = resolvedParams.league;
   
  const { matches, news, highlights, featuredMatches } = await getHomepageData(selectedLeague);

  const breakingNews = news.filter(n => n.is_breaking); 
  const rawTicker = breakingNews.length > 0 ? breakingNews : news.slice(0, 5);
  const tickerNews = [...rawTicker, ...rawTicker, ...rawTicker, ...rawTicker]; 
  const headlines = news.filter(n => n.is_headline).slice(0, 5);
  const finalHeadlines = headlines.length > 0 ? headlines : news.slice(0, 3);
  const latestNews = news.filter(n => !finalHeadlines.some(h => h.id === n.id) && !n.is_breaking).slice(0, 5);

  // 🟢 SMART HERO LOGIC: Admin Pick -> Big Match Today -> First Upcoming
  let heroMatches: any[] = [];

  // 1. Admin Override
  if (featuredMatches.length > 0) {
      heroMatches = featuredMatches;
  } 
  // 2. Big Match Today (if no admin pick)
  else {
      const today = new Date().toISOString().split('T')[0];
      const bigLeagues = ['Premier League', 'Champions League', 'World Cup', 'La Liga', 'Serie A'];
      const bigMatch = matches.find(m => 
        m.match_date.startsWith(today) && bigLeagues.includes(m.league)
      );
      
      if (bigMatch) {
          heroMatches = [bigMatch];
      } else if (matches.length > 0) {
          // 3. Fallback: Next available match
          heroMatches = [matches[0]];
      }
  }

  // Filter display matches (remove duplicates if hero is shown)
  const displayMatches = matches.filter(m => !heroMatches.some(h => h.id === m.id));
  const groupedMatches = groupByDate(displayMatches);

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 font-sans pb-0 overflow-x-hidden">
      
      <style>{`
        @keyframes scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-scroll { display: flex; width: max-content; animation: scroll 60s linear infinite; }
        .ticker-item { white-space: nowrap; display: flex; align-items: center; }
      `}</style>

      {/* 1. TICKER */}
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
            <Link href="/news" className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition">View All</Link>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm divide-y divide-slate-50">
            {latestNews.length > 0 ? latestNews.map((item) => (
                <Link href={`/news/${item.slug || '#'}`} key={item.id} className="flex gap-3 items-center p-3 active:bg-slate-50 transition group">
                    <div className="w-14 h-14 bg-slate-100 rounded-lg shrink-0 overflow-hidden relative">
                        <NewsArtwork image={item.image_url} team1Logo={item.team_1_logo} team2Logo={item.team_2_logo} title={item.title} className="w-full h-full group-hover:scale-110 transition duration-500" />
                    </div>
                    <div>
                        <h4 className="text-xs font-bold leading-tight line-clamp-2 text-slate-800 group-hover:text-blue-600 transition">{item.title}</h4>
                        <span className="text-[9px] text-slate-400 mt-1 block font-medium">{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                </Link>
            )) : <div className="text-center text-[10px] text-slate-400 py-4">No recent updates</div>}
        </div>
      </div>

      {/* 5. MATCH CENTER */}
      <section className="mt-6">
         <div className="px-4 flex justify-between items-center mb-2">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2"><TrendingUp className="text-red-500" size={14}/> Match Center</h3>
            <Link href="/matches" className="text-[10px] font-black bg-[#0a1428] text-white px-4 py-2 rounded-lg flex items-center gap-1 shadow-md active:scale-95 transition hover:bg-slate-900">
                All Fixtures <ArrowRight size={10} />
            </Link>
        </div>
        
        {/* League Tabs */}
        <div className="bg-white border-y border-slate-200 sticky top-0 z-30 overflow-x-auto scrollbar-hide py-2 shadow-sm mb-4">
            <div className="flex px-4 space-x-2 min-w-max">
            <Link href="/" scroll={false} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all ${!selectedLeague ? 'bg-[#0a1428] text-white shadow-md' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>For You</Link>
            {['Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Champions League'].map((league) => (
                <Link key={league} href={`/?league=${league}`} scroll={false} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all ${selectedLeague === league ? 'bg-[#0a1428] text-white shadow-md' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>{league === 'Premier League' ? 'EPL' : league}</Link>
            ))}
            </div>
        </div>

        {/* HERO SECTION (UPDATED) */}
        {!selectedLeague && heroMatches.length > 0 && (
         <div className="px-4 mb-4 flex gap-2 overflow-x-auto">
             {heroMatches.map((match) => (
                <Link key={match.id} href={`/match/${match.id}`} className={`block relative z-10 ${heroMatches.length > 1 ? 'w-[85%] shrink-0' : 'w-full'}`}>
                    <div className="bg-gradient-to-br from-blue-600 to-blue-900 rounded-2xl p-4 shadow-xl border border-white/10 relative overflow-hidden group hover:scale-[1.01] transition-transform">
                        {['LIVE','HT','IN_PLAY'].includes(match.status) && (
                            <div className="absolute top-3 right-3 bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1 shadow-lg">
                                <span className="w-1.5 h-1.5 bg-white rounded-full"></span> LIVE
                            </div>
                        )}
                        {(match.livestream_url || match.audio_url) && (
                            <div className="absolute top-3 left-3 bg-black/40 backdrop-blur-md text-white text-[8px] font-bold px-2 py-0.5 rounded-full border border-white/10 flex items-center gap-1">
                                 {match.livestream_url ? <Video size={8} /> : <Radio size={8} />}
                                 {match.livestream_url ? 'WATCH' : 'AUDIO'}
                            </div>
                        )}
                        <div className="flex justify-between items-center mt-6">
                            <div className="flex flex-col items-center w-[30%]">
                                {match.home_logo ? <img src={match.home_logo} className="w-10 h-10 object-contain mb-2 drop-shadow-md"/> : <div className="w-10 h-10 bg-white/10 rounded-full mb-2 flex items-center justify-center text-[10px]">H</div>}
                                <span className="text-[10px] font-bold text-center leading-tight text-white line-clamp-1">{match.home_team}</span>
                            </div>
                            <div className="flex flex-col items-center w-[40%]">
                                <div className="text-xl font-black tabular-nums tracking-widest bg-black/30 px-2 py-1 rounded-lg backdrop-blur-md border border-white/5 shadow-inner text-white whitespace-nowrap">
                                    {match.status === 'SCHEDULED' || match.status === 'PRE' ? <span className="text-sm">VS</span> : `${match.home_score}-${match.away_score}`}
                                </div>
                                <span className="text-[8px] font-medium text-blue-200 mt-1 uppercase tracking-wider text-center">
                                    {match.status === 'SCHEDULED' || match.status === 'PRE' 
                                        ? new Date(match.match_date).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})
                                        : (match.status === 'HT' ? 'HT' : match.status)
                                    }
                                </span>
                            </div>
                            <div className="flex flex-col items-center w-[30%]">
                                {match.away_logo ? <img src={match.away_logo} className="w-10 h-10 object-contain mb-2 drop-shadow-md"/> : <div className="w-10 h-10 bg-white/10 rounded-full mb-2 flex items-center justify-center text-[10px]">A</div>}
                                <span className="text-[10px] font-bold text-center leading-tight text-white line-clamp-1">{match.away_team}</span>
                            </div>
                        </div>
                    </div>
                </Link>
             ))}
         </div>
        )}
        
        {/* MATCH LIST */}
        <div className="px-4 py-0 space-y-3">
             <FreeTipsBanner />

             {Object.keys(groupedMatches).length > 0 ? (
                 Object.keys(groupedMatches).map((dateKey) => (
                    <div key={dateKey}>
                        <div className="flex items-center gap-2 mb-3 mt-4 px-1">
                            <Calendar size={12} className="text-slate-400"/>
                            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">{dateKey}</span>
                            <div className="h-px bg-slate-200 flex-1"></div>
                        </div>

                        {groupedMatches[dateKey].map((match) => {
                            const isLive = ['LIVE', 'HT', 'IN_PLAY'].includes(match.status);
                            const isScheduled = match.status === 'SCHEDULED' || match.status === 'PRE';
                            const isFinished = ['FT', 'FINISHED', 'ABD'].includes(match.status);

                            return (
                                <div key={match.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden mb-3 hover:shadow-md transition">
                                    <div className="bg-slate-50 px-3 py-1.5 flex justify-between items-center border-b border-slate-100">
                                         <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider max-w-[100px] truncate">{match.league}</span>
                                            <span className="text-[9px] font-bold text-slate-300">•</span>
                                            <span className="text-[9px] font-bold text-slate-500">{formatDateLabel(match.match_date)}</span>
                                         </div>
                                         {match.livestream_url && <span className="flex items-center gap-1 text-[8px] font-black text-red-600 animate-pulse bg-red-50 px-1.5 py-0.5 rounded border border-red-100"><Video size={8}/> LIVE</span>}
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

                                    {/* BUTTON LOGIC */}
                                    <div className="px-3 py-2 border-t border-slate-100 bg-slate-50/50">
                                        {isScheduled && (
                                            <div className="grid grid-cols-2 gap-3">
                                                <Link href={`/match/${match.id}`} className="flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:border-blue-200 rounded-lg py-2 shadow-sm text-[10px] font-bold text-slate-700 active:scale-95 transition hover:bg-blue-50">
                                                    <Zap size={12} className="text-blue-500" /> Predict
                                                </Link>
                                                <a href={match.affiliate_link || DEFAULT_AFFILIATE_LINK} target="_blank" className="flex items-center justify-center gap-1.5 bg-green-100 text-green-700 border border-green-200 rounded-lg py-2 shadow-sm text-[10px] font-bold active:scale-95 transition hover:bg-green-200">
                                                    <ExternalLink size={12} /> Bet Now
                                                </a>
                                            </div>
                                        )}
                                        {isLive && (
                                            <a href={match.affiliate_link || DEFAULT_AFFILIATE_LINK} target="_blank" className="w-full flex items-center justify-center gap-1.5 bg-green-100 text-green-700 border border-green-200 rounded-lg py-2 shadow-sm text-[10px] font-bold active:scale-95 transition hover:bg-green-200">
                                                <ExternalLink size={12} /> Bet Now
                                            </a>
                                        )}
                                        {isFinished && (
                                            <Link href={`/match/${match.id}`} className="w-full flex items-center justify-center gap-1.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg py-2 shadow-sm text-[10px] font-bold active:scale-95 transition hover:bg-blue-100">
                                                <BarChart2 size={12} /> View Stats
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                 ))
             ) : (
                <div className="text-center py-10 opacity-50 bg-white rounded-xl border border-dashed border-slate-300">
                   <p className="text-xs font-bold text-slate-500">No matches found.</p>
                </div>
             )}
        </div>
      </section>

      {/* 6. VIP REWARD */}
      <div className="mx-4 mb-4 mt-6">
        <div className="rounded-2xl overflow-hidden relative shadow-2xl group cursor-pointer bg-black p-6 text-center">
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500 blur-[60px] opacity-20 group-hover:opacity-30 transition"></div>
            <div className="relative z-10">
                <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-[0_0_15px_rgba(234,179,8,0.4)]">
                    <Trophy className="text-black fill-black" size={24} />
                </div>
                <h2 className="text-white font-black text-xl uppercase italic tracking-tighter mb-2">Monthly <span className="text-yellow-500">Jackpot</span></h2>
                <Link href="/vip/upgrade" className="inline-flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black font-black text-sm uppercase px-8 py-3 rounded-xl transition shadow-lg active:scale-95">Join Winners Circle <ArrowRight size={16} /></Link>
            </div>
        </div>
      </div>

      {/* 🚀 QUICK ACTION LINKS */}
      <div className="grid grid-cols-4 gap-3 px-4 py-6">
          <Link href="/matches" className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition hover:shadow-md">
              <Trophy className="text-yellow-500" size={20} />
              <span className="text-[10px] font-bold text-slate-700">Predict</span>
          </Link>
          <Link href="/leaderboard" className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition hover:shadow-md">
              <Award className="text-yellow-500" size={20} />
              <span className="text-[10px] font-bold text-slate-700">Leaders</span>
          </Link>
          <Link href="/news" className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition hover:shadow-md">
              <Newspaper className="text-blue-500" size={20} />
              <span className="text-[10px] font-bold text-slate-700">News</span>
          </Link>
          <a href="https://youtube.com/@factsportlive" target="_blank" className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition hover:shadow-md">
              <Youtube className="text-red-600" size={20} />
              <span className="text-[10px] font-bold text-slate-700">YouTube</span>
          </a>
      </div>
    </div>
  );
}