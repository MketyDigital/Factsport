export const runtime = 'edge';
export const revalidate = 5; 

import { createClient } from '@supabase/supabase-js'; 
import Link from "next/link";
import { Metadata } from 'next';
import { ArrowRight, Youtube, Newspaper, TrendingUp, Calendar, Award, Trophy } from "lucide-react";

import LiveScoreLabel from '@/app/components/LiveScoreLabel';
import HeadlinesSlider from '@/app/components/HeadlinesSlider';
import FreeTipsBanner from '@/app/components/FreeTipsBanner';
import MatchTime from '@/app/components/MatchTime';
import NewsTicker from '@/app/components/NewsTicker'; 
import LatestNewsList from '@/app/components/LatestNewsList'; 
import HighlightsSlider from '@/app/components/HighlightsSlider'; 
import HeroMatchCards from '@/app/components/HeroMatchCards'; 
import AdsterraStandardBanner from '@/app/components/AdsterraStandardBanner';

const DEFAULT_AFFILIATE_LINK = "https://refpa58144.com/L?tag=d_1181253m_1599c_&site=1181253&ad=1599"; 

const LIVE_STATUSES = ['LIVE', 'IN_PLAY', 'IN', '1H', '2H', 'HT', 'HALFTIME', 'ET', 'EXTRA TIME', 'P', 'PENALTIES'];
const SCHEDULED_STATUSES = ['SCHEDULED', 'PRE', 'UPCOMING', 'TBD', 'DELAYED'];
const FINISHED_STATUSES = ['FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD'];

export const metadata: Metadata = {
  title: 'FactSport | Live Football, Sport News & Predictions',
  description: 'The #1 Platform for sports | football predictions, live scores, and breaking news.',
  openGraph: {
      title: 'FactSport | Live Football, Sport News & Predictions',
      description: 'The #1 Platform for sports | football predictions, live scores, and breaking news.',
      type: 'website',
      siteName: 'FactSport',
  },
  twitter: {
      card: 'summary_large_image',
      title: 'FactSport | Live Football, Sport News & Predictions',
      description: 'The #1 Platform for sports | football predictions, live scores, and breaking news.',
  }
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

// 🟢 NEW: Strict 3-Tier Sorting (Live -> Scheduled -> Finished)
const sortMatches = (matches: any[]) => {
  return matches.sort((a, b) => {
    const rawA = (a.status || '').toUpperCase();
    const rawB = (b.status || '').toUpperCase();

    const isLiveA = LIVE_STATUSES.includes(rawA);
    const isLiveB = LIVE_STATUSES.includes(rawB);
    const isFinishedA = FINISHED_STATUSES.includes(rawA);
    const isFinishedB = FINISHED_STATUSES.includes(rawB);

    // Tier 1: LIVE matches always at the top
    if (isLiveA && !isLiveB) return -1;
    if (!isLiveA && isLiveB) return 1;

    // Tier 2: SCHEDULED matches above Finished
    const isScheduledA = !isLiveA && !isFinishedA;
    const isScheduledB = !isLiveB && !isFinishedB;
    if (isScheduledA && !isScheduledB) return -1;
    if (!isScheduledA && isScheduledB) return 1;

    // If they are in the same tier, sort by time
    const timeA = new Date(a.match_date).getTime();
    const timeB = new Date(b.match_date).getTime();

    // If both are finished, show the most recently finished first
    if (isFinishedA && isFinishedB) return timeB - timeA;
    
    // If both are scheduled/live, show the soonest first
    return timeA - timeB;
  });
};

const getDiverseMatches = (allMatches: any[], limit: number) => {
    const live = allMatches.filter(m => LIVE_STATUSES.includes((m.status || '').toUpperCase()));
    const scheduled = allMatches.filter(m => !LIVE_STATUSES.includes((m.status || '').toUpperCase()));

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
    return sortMatches([...live, ...mixedScheduled].slice(0, limit));
};

async function getHomepageData(leagueFilter: string | undefined) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const tomorrowEnd = new Date(); 
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1); 
  tomorrowEnd.setHours(23,59,59,999);

  let matchQuery;

  if (leagueFilter) {
      const startDate = new Date(); startDate.setDate(startDate.getDate() - 3); 
      const endDate = new Date(); endDate.setDate(endDate.getDate() + 7); 
      matchQuery = supabase.from('matches').select('*')
        .gte('match_date', startDate.toISOString())
        .lte('match_date', endDate.toISOString())
        .ilike('league', `%${leagueFilter}%`)
        .order('match_date', { ascending: true });
  } 
  else {
      matchQuery = supabase.from('matches').select('*')
        .or(`status.eq.LIVE,status.eq.IN_PLAY,status.eq.HT,status.eq.in,match_date.gte.${todayStart.toISOString()}`)
        .lte('match_date', tomorrowEnd.toISOString()) 
        .order('match_date', { ascending: true })
        .limit(50); 
  }

  const [matchesRes, newsRes, highlightsRes, featuredRes] = await Promise.all([
    matchQuery,
    supabase.from('news').select('*').order('created_at', { ascending: false }).limit(20),
    supabase.from('matches')
      .select('*')
      .not('video_url', 'is', null)
      .neq('video_url', '') 
      .order('match_date', { ascending: false })
      .limit(5),
    supabase.from('matches')
      .select('*')
      .eq('is_featured', true)
      .gte('match_date', todayStart.toISOString()) 
      .order('match_date', { ascending: true })
      .limit(5)
  ]);

  let matches = matchesRes.data || [];

  if (leagueFilter && matches.length === 0) {
      const { data: past } = await supabase.from('matches')
          .select('*').ilike('league', `%${leagueFilter}%`).lt('match_date', new Date().toISOString())
          .order('match_date', { ascending: false }).limit(10);
      const { data: future } = await supabase.from('matches')
          .select('*').ilike('league', `%${leagueFilter}%`).gt('match_date', new Date().toISOString())
          .order('match_date', { ascending: true }).limit(5);
          
      matches = [...(future || []), ...(past || [])].sort((a,b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime());
  } else if (!leagueFilter && matches.length > 0) {
      matches = getDiverseMatches(matches, 20);
  } else {
      matches = sortMatches(matches);
  }

  if (matches.length === 0 && !leagueFilter) {
      const { data: finishedMatches } = await supabase.from('matches').select('*')
        .in('status', ['FT', 'FINISHED', 'ABD', 'post', 'POST', 'ENDED', 'AET', 'PEN']) 
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

  const rawTicker = news.slice(0, 15);
  const tickerNews = [...rawTicker, ...rawTicker, ...rawTicker, ...rawTicker]; 
  const finalHeadlines = news.filter(n => n.is_headline).slice(0, 3);
  const latestNews = news.filter(n => !finalHeadlines.some(h => h.id === n.id)).slice(0, 5);

  let heroMatches: any[] = [];
  
  if (featuredMatches.length > 0) {
      heroMatches = featuredMatches.slice(0, 2);
  } 
  
  if (heroMatches.length === 0) {
      const bigTeams = [
          'Arsenal', 'Chelsea', 'Liverpool', 'Man City', 'Manchester City', 'Man United', 'Manchester United', 'Tottenham',
          'Real Madrid', 'Barcelona', 'Atletico', 
          'Bayern', 'Dortmund', 'Leverkusen',
          'Juventus', 'Inter', 'AC Milan', 'Napoli', 
          'PSG', 'Paris Saint Germain'
      ];

      const activeMatches = matches.filter(m => !FINISHED_STATUSES.includes((m.status || '').toUpperCase()));
      const candidates = activeMatches.length > 0 ? activeMatches : matches;

      const bigMatches = candidates.filter(m => {
          return bigTeams.some(giant => 
              (m.home_team && m.home_team.toLowerCase().includes(giant.toLowerCase())) || 
              (m.away_team && m.away_team.toLowerCase().includes(giant.toLowerCase()))
          );
      });

      if (bigMatches.length > 0) {
          heroMatches = bigMatches.slice(0, 2);
      } else {
          heroMatches = candidates.slice(0, 2);
      }
  }

  const displayMatches = matches.filter(m => !heroMatches.some(h => h.id === m.id));
  const groupedMatches = groupByDate(displayMatches);

  const jsonLd = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "FactSport",
      "url": "https://factsport.com/",
      "potentialAction": {
          "@type": "SearchAction",
          "target": "https://factsport.com/news?category={search_term_string}",
          "query-input": "required name=search_term_string"
      }
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 font-sans pb-0 overflow-x-hidden">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      
      <NewsTicker tickerNews={tickerNews} />
      <AdsterraStandardBanner />
      {finalHeadlines.length > 0 && <div className="mt-4 px-4"><HeadlinesSlider headlines={finalHeadlines} /></div>}
      <HighlightsSlider highlights={highlights} />
      <LatestNewsList latestNews={latestNews} />

      <section className="mt-8">
         <div className="px-4 flex justify-between items-center mb-3">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2"><TrendingUp className="text-red-500" size={14}/> Match Center</h3>
            <Link href="/matches" className="text-[10px] font-black bg-[#0a1428] text-white px-4 py-2 rounded-lg flex items-center gap-1 shadow-md active:scale-95 transition hover:bg-slate-900">
                All Fixtures <ArrowRight size={10} />
            </Link>
        </div>
        
        <div className="bg-white border-y border-slate-200 sticky top-0 z-30 overflow-x-auto scrollbar-hide py-2 shadow-sm mb-4">
            <div className="flex px-4 space-x-2 min-w-max">
            <Link href="/" scroll={false} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all ${!selectedLeague ? 'bg-[#0a1428] text-white shadow-md' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'}`}>For You</Link>
            {['Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Champions League'].map((league) => (
                <Link key={league} href={`/?league=${league}`} scroll={false} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all ${selectedLeague === league ? 'bg-[#0a1428] text-white shadow-md' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'}`}>{league === 'Premier League' ? 'EPL' : league}</Link>
            ))}
            </div>
        </div>

        {selectedLeague && matches.length > 0 && matches[0].league_banner && (
            <div className="px-4 mb-4">
                <div className="rounded-xl overflow-hidden shadow-sm border border-slate-200 bg-white">
                    <img src={matches[0].league_banner} alt={selectedLeague} className="w-full h-16 object-cover object-center" />
                </div>
            </div>
        )}

        {!selectedLeague && <HeroMatchCards heroMatches={heroMatches} />}
        
        <div className="px-4 py-0 space-y-4 mt-2">
             <FreeTipsBanner />

             {Object.keys(groupedMatches).length > 0 ? (
                 Object.keys(groupedMatches).map((dateKey) => (
                    <div key={dateKey} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-4">
                        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center gap-2">
                            <Calendar size={12} className="text-slate-400"/>
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">{dateKey}</span>
                        </div>

                        <div className="divide-y divide-slate-50">
                            {groupedMatches[dateKey].map((match) => {
                                const rawStatus = (match.status || '').toUpperCase();
                                
                                const isScheduled = SCHEDULED_STATUSES.includes(rawStatus);
                                const isFinished = FINISHED_STATUSES.includes(rawStatus);
                                
                                const stageText = match.match_group ? match.match_group.replace(/_/g, ' ') : (match.stage && match.stage !== 'REGULAR_SEASON' ? match.stage.replace(/_/g, ' ') : null);

                                return (
                                    <div key={match.id} className="hover:bg-slate-50/80 transition block">
                                        <Link href={`/match/${match.id}`} className="block p-4">
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">{match.league}</span>
                                                    {stageText && (
                                                        <>
                                                            <span className="text-[8px] text-slate-300">•</span>
                                                            <span className="text-[8px] font-black text-blue-500 uppercase tracking-wider bg-blue-50 px-1.5 py-0.5 rounded">{stageText}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <div className="flex justify-between items-center">
                                                <div className="flex-1 flex flex-col gap-2">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-6 h-6 flex items-center justify-center shrink-0">{match.home_logo ? <img src={match.home_logo} className="w-full h-full object-contain" /> : <div className="w-5 h-5 bg-slate-200 rounded-full"></div>}</div>
                                                        <span className={`text-xs font-black uppercase tracking-tight truncate max-w-[120px] sm:max-w-none ${isFinished && match.home_score > match.away_score ? 'text-slate-900' : 'text-slate-600'}`}>
                                                            {match.home_team}
                                                        </span>
                                                        {!isScheduled && <span className={`ml-auto font-black text-sm ${isFinished && match.home_score > match.away_score ? 'text-slate-900' : 'text-slate-400'}`}>{match.home_score}</span>}
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-6 h-6 flex items-center justify-center shrink-0">{match.away_logo ? <img src={match.away_logo} className="w-full h-full object-contain" /> : <div className="w-5 h-5 bg-slate-200 rounded-full"></div>}</div>
                                                        <span className={`text-xs font-black uppercase tracking-tight truncate max-w-[120px] sm:max-w-none ${isFinished && match.away_score > match.home_score ? 'text-slate-900' : 'text-slate-600'}`}>
                                                            {match.away_team}
                                                        </span>
                                                        {!isScheduled && <span className={`ml-auto font-black text-sm ${isFinished && match.away_score > match.home_score ? 'text-slate-900' : 'text-slate-400'}`}>{match.away_score}</span>}
                                                    </div>
                                                </div>
                                                
                                                <div className="flex flex-col items-end justify-center pl-4 border-l border-slate-100 ml-4 w-16 shrink-0">
                                                    <LiveScoreLabel 
                                                        matchId={match.id} 
                                                        espnId={match.espn_id} 
                                                        initialStatus={match.status} 
                                                        variant="badge" 
                                                        matchDate={match.match_date} 
                                                        disablePolling={true}
                                                    />
                                                    {isScheduled && <span className="text-[10px] font-bold text-slate-500 mt-1"><MatchTime date={match.match_date} /></span>}
                                                </div>
                                            </div>
                                        </Link>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))
             ) : (
                <div className="text-center py-12 opacity-50 bg-white rounded-2xl border border-dashed border-slate-300 shadow-sm">
                   <Calendar size={24} className="mx-auto mb-2 text-slate-400"/>
                   <p className="text-xs font-bold text-slate-500">No matches found.</p>
                </div>
             )}
        </div>
      </section>

      <div className="mx-4 mb-4 mt-6">
        <div className="rounded-2xl overflow-hidden relative shadow-2xl group cursor-pointer bg-black p-6 text-center">
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500 blur-[60px] opacity-20 group-hover:opacity-30 transition"></div>
            <div className="relative z-10">
                <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-[0_0_15px_rgba(234,179,8,0.4)]">
                    <Trophy className="text-black fill-black" size={24} />
                </div>
                <h2 className="text-white font-black text-xl uppercase italic tracking-tighter mb-2">Predict & Win <span className="text-yellow-500">Fantastic Prices</span></h2>
                <Link href="/vip/upgrade" className="inline-flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black font-black text-sm uppercase px-8 py-3 rounded-xl transition shadow-lg active:scale-95">Join Winners Circle <ArrowRight size={16} /></Link>
            </div>
        </div>
      </div>

      <AdsterraStandardBanner />

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
          <a href="https://youtube.com/@factsportlive" target="_blank" rel="noopener noreferrer" className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition hover:shadow-md">
              <Youtube className="text-red-600" size={20} />
              <span className="text-[10px] font-bold text-slate-700">YouTube</span>
          </a>
      </div>
    </div>
  );
}