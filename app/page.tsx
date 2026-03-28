export const runtime = 'edge';
export const revalidate = 5; 

import { createClient } from '@supabase/supabase-js'; 
import Link from "next/link";
import { Metadata } from 'next';
import { ArrowRight, Youtube, Newspaper, TrendingUp, Calendar, Award, Trophy, Info } from "lucide-react";

import HeadlinesSlider from '@/app/components/HeadlinesSlider';
import InstallAppBanner from '@/app/components/InstallAppBanner'; 
import FreeTipsBanner from '@/app/components/FreeTipsBanner';
import NewsTicker from '@/app/components/NewsTicker'; 
import LatestNewsList from '@/app/components/LatestNewsList'; 
import HighlightsSlider from '@/app/components/HighlightsSlider'; 
import HeroMatchCards from '@/app/components/HeroMatchCards'; 
import AdsterraStandardBanner from '@/app/components/AdsterraStandardBanner';
import CompactMatchRow from '@/app/components/CompactMatchRow';
import MiniStandings from '@/app/components/MiniStandings'; 
import BetOfTheDay from '@/app/components/BetOfTheDay'; 

const LIVE_STATUSES = ['LIVE', 'IN_PLAY', 'IN', '1H', '2H', 'HT', 'HALFTIME', 'ET', 'EXTRA TIME', 'P', 'PENALTIES'];
const SCHEDULED_STATUSES = ['SCHEDULED', 'PRE', 'UPCOMING', 'TBD', 'DELAYED'];
const FINISHED_STATUSES = ['FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD'];

export const metadata: Metadata = {
  title: 'FactSport | Live Football, Sport News & Predictions',
  description: 'The #1 Platform for sports | football predictions, live scores, and breaking news.',
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

const sortMatches = (matches: any[]) => {
  return matches.sort((a, b) => {
    const rawA = (a.status || '').toUpperCase();
    const rawB = (b.status || '').toUpperCase();

    const isLiveA = LIVE_STATUSES.includes(rawA);
    const isLiveB = LIVE_STATUSES.includes(rawB);
    const isFinishedA = FINISHED_STATUSES.includes(rawA);
    const isFinishedB = FINISHED_STATUSES.includes(rawB);

    if (isLiveA && !isLiveB) return -1;
    if (!isLiveA && isLiveB) return 1;

    const isScheduledA = !isLiveA && !isFinishedA;
    const isScheduledB = !isLiveB && !isFinishedB;
    if (isScheduledA && !isScheduledB) return -1;
    if (!isScheduledA && isScheduledB) return 1;

    const timeA = new Date(a.match_date).getTime();
    const timeB = new Date(b.match_date).getTime();

    if (isFinishedA && isFinishedB) return timeB - timeA;
    return timeA - timeB;
  });
};

const getMixedTodayMatches = (allTodayMatches: any[], limit: number) => {
    const leagues: Record<string, any[]> = {};
    allTodayMatches.forEach(m => {
        if (!leagues[m.league]) leagues[m.league] = [];
        leagues[m.league].push(m);
    });

    const mixed: any[] = [];
    const leagueCounters: Record<string, number> = {};
    Object.keys(leagues).forEach(k => leagueCounters[k] = 0);

    let added = true;
    while (added && mixed.length < limit) {
        added = false;
        for (const league of Object.keys(leagues)) {
            if (mixed.length >= limit) break;
            if (leagueCounters[league] < 3 && leagues[league].length > 0) {
                mixed.push(leagues[league].shift());
                leagueCounters[league]++;
                added = true;
            }
        }
        if (!added && mixed.length < limit && allTodayMatches.length > mixed.length) {
            for (const league of Object.keys(leagues)) {
                 if (mixed.length >= limit) break;
                 if (leagues[league].length > 0) {
                     mixed.push(leagues[league].shift());
                     added = true;
                 }
            }
        }
    }
    return sortMatches(mixed);
};

async function getHomepageData(leagueFilter: string | undefined) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const todayEnd = new Date(todayStart); todayEnd.setHours(23,59,59,999);

  let matches: any[] = [];
  let isShowingFallbackResults = false;

  const [newsRes, highlightsRes, featuredRes] = await Promise.all([
    supabase.from('news').select('*').order('created_at', { ascending: false }).limit(25),
    supabase.from('matches').select('*').not('video_url', 'is', null).neq('video_url', '').order('match_date', { ascending: false }).limit(5),
    supabase.from('matches').select('*').eq('is_featured', true).gte('match_date', todayStart.toISOString()).lte('match_date', todayEnd.toISOString()).order('match_date', { ascending: true }).limit(5)
  ]);

  if (leagueFilter) {
      const { data: todayLeagueMatches } = await supabase.from('matches')
          .select('*')
          .ilike('league', `%${leagueFilter}%`)
          .gte('match_date', todayStart.toISOString())
          .lte('match_date', todayEnd.toISOString())
          .order('match_date', { ascending: true })
          .limit(5); 

      if (todayLeagueMatches && todayLeagueMatches.length > 0) {
          matches = todayLeagueMatches;
      } else {
          const { data: fallbackMatches } = await supabase.from('matches')
              .select('*')
              .ilike('league', `%${leagueFilter}%`)
              .order('match_date', { ascending: false }) 
              .limit(5); 

          if (fallbackMatches && fallbackMatches.length > 0) {
              matches = fallbackMatches;
              isShowingFallbackResults = true; 
          }
      }
      matches = sortMatches(matches);

  } else {
      const { data: todayAllMatches } = await supabase.from('matches').select('*')
        .gte('match_date', todayStart.toISOString())
        .lte('match_date', todayEnd.toISOString())
        .order('match_date', { ascending: true })
        .limit(100); 
      
      if (todayAllMatches && todayAllMatches.length > 0) {
          matches = getMixedTodayMatches(todayAllMatches, 20); 
      } else {
          const { data: recentMatches } = await supabase.from('matches').select('*')
            .order('match_date', { ascending: false })
            .limit(10);
          if (recentMatches) matches = recentMatches;
      }
  }

  return { 
      matches, 
      news: newsRes.data || [], 
      highlights: highlightsRes.data || [], 
      featuredMatches: featuredRes.data || [],
      isShowingFallbackResults
  };
}

export default async function Home({ searchParams }: { searchParams: { league?: string } }) {
  const resolvedParams = await searchParams;
  const selectedLeague = resolvedParams.league;
    
  const { matches, news, highlights, featuredMatches, isShowingFallbackResults } = await getHomepageData(selectedLeague);

  const finalHeadlines = news.filter(n => n.is_headline).slice(0, 3);
  const nonHeadlineNews = news.filter(n => !finalHeadlines.some(h => h.id === n.id));
  const latestNews = nonHeadlineNews.slice(0, 5);
  const rawTicker = nonHeadlineNews.slice(0, 20);
  const tickerNews = [...rawTicker, ...rawTicker];

  // 🟢 STRICT HERO MATCHES LOGIC (Admin -> Media -> Big Teams -> Any Today) Max 5
  let heroMatches: any[] = [...featuredMatches];
  
  // 1. Add matches with Media URLs from TODAY
  const mediaMatches = matches.filter(m => m.livestream_url || m.audio_url || m.video_url);
  mediaMatches.forEach(m => {
      if (!heroMatches.find(h => h.id === m.id) && heroMatches.length < 5) heroMatches.push(m);
  });

  // 2. Fallback to Big Teams from TODAY
  if (heroMatches.length < 5) {
      const bigTeams = ['Arsenal', 'Chelsea', 'Liverpool', 'Man City', 'Manchester City', 'Man United', 'Manchester United', 'Tottenham', 'Real Madrid', 'Barcelona', 'Atletico', 'Bayern', 'Dortmund', 'Leverkusen', 'Juventus', 'Inter', 'AC Milan', 'Napoli', 'PSG'];
      const activeMatches = matches.filter(m => !FINISHED_STATUSES.includes((m.status || '').toUpperCase()));
      const candidates = activeMatches.length > 0 ? activeMatches : matches;
      
      const bigMatches = candidates.filter(m => { return bigTeams.some(giant => (m.home_team && m.home_team.toLowerCase().includes(giant.toLowerCase())) || (m.away_team && m.away_team.toLowerCase().includes(giant.toLowerCase()))); });
      
      bigMatches.forEach(m => {
          if (!heroMatches.find(h => h.id === m.id) && heroMatches.length < 5) heroMatches.push(m);
      });

      // 3. Absolute Fallback: Any available match for the day
      candidates.forEach(m => {
          if (!heroMatches.find(h => h.id === m.id) && heroMatches.length < 5) heroMatches.push(m);
      });
  }

  heroMatches = heroMatches.slice(0, 5);

  // 🟢 STABLE BET OF THE DAY LOGIC (Locks to one match per day)
  let betOfTheDayMatch = null;
  if (matches.length > 0) {
      // Prioritize Admin Featured match first
      if (featuredMatches.length > 0) {
          betOfTheDayMatch = featuredMatches[featuredMatches.length - 1]; 
      } else {
          // Sort today's matches by time descending (Latest matches first) to prefer afternoon/evening matches
          const sortedByTimeDesc = [...matches].sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime());
          
          const bigTeams = ['Arsenal', 'Chelsea', 'Liverpool', 'Man City', 'Manchester City', 'Man United', 'Manchester United', 'Tottenham', 'Real Madrid', 'Barcelona', 'Atletico', 'Bayern', 'Dortmund', 'Leverkusen', 'Juventus', 'Inter', 'AC Milan', 'Napoli', 'PSG'];
          
          // Find the latest BIG match of the day
          const latestBigMatch = sortedByTimeDesc.find(m => bigTeams.some(giant => (m.home_team && m.home_team.toLowerCase().includes(giant.toLowerCase())) || (m.away_team && m.away_team.toLowerCase().includes(giant.toLowerCase()))));
          
          // If no big match, just pick the latest match of the day. If completely empty, fallback.
          betOfTheDayMatch = latestBigMatch || sortedByTimeDesc[0] || matches[0];
      }
  }

  const displayMatches = matches.filter(m => !heroMatches.some(h => h.id === m.id));
  const groupedMatches = groupByDate(displayMatches);

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 font-sans pb-0 overflow-x-hidden">
      
      {/* 1. Ticker */}
      <NewsTicker tickerNews={tickerNews} />

      {/* 2. Hero Matches (Immediately under Ticker) */}
      {!selectedLeague && heroMatches.length > 0 && (
          <div className="bg-[#0f1c3a] pt-3 pb-4 border-b border-slate-800">
            <HeroMatchCards heroMatches={heroMatches} />
          </div>
      )}

      {/* 3. PWA App Install Banner */}
      <div className="mt-4 max-w-4xl mx-auto"><InstallAppBanner /></div>

      <AdsterraStandardBanner />

      {/* 4. Main Headlines */}
      {finalHeadlines.length > 0 && <div className="mt-0 md:mt-4 md:px-4"><HeadlinesSlider headlines={finalHeadlines} /></div>}
      
      {/* 5. Latest News */}
      <LatestNewsList latestNews={latestNews} />

      {/* 6. MATCH CENTER */}
      <section className="mt-8 max-w-6xl mx-auto">
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
            <Link href="/matches" className="px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100">Others</Link>
            </div>
        </div>

        {selectedLeague && isShowingFallbackResults && (
            <div className="px-4 mb-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-center gap-2 text-amber-800">
                        <Info size={16} className="text-amber-600 shrink-0" />
                        <p className="text-[10px] sm:text-xs font-bold">No upcoming fixtures right now. Showing latest results.</p>
                    </div>
                </div>
            </div>
        )}

        <div className="px-2 md:px-4 py-0 flex flex-col lg:flex-row gap-4 mt-2">
            
            <div className="flex-1 space-y-4">
                <FreeTipsBanner />

                {Object.keys(groupedMatches).length > 0 ? (
                    <>
                    {Object.keys(groupedMatches).map((dateKey) => (
                        <div key={dateKey} className="bg-white rounded-xl md:rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-4">
                            <div className="bg-slate-50 px-3 py-2 md:py-2.5 border-b border-slate-200 flex items-center gap-2">
                                <Calendar size={12} className="text-slate-400"/>
                                <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">{dateKey}</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 bg-[#f8fafc]">
                                {groupedMatches[dateKey].map((match) => (
                                    <div key={match.id} className="bg-white rounded-lg shadow-sm border border-slate-100 overflow-hidden">
                                        <CompactMatchRow match={match} disablePolling={false} showLeague={!selectedLeague} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    
                    <Link href="/matches" className="block w-full text-center bg-white border border-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-widest py-3.5 rounded-xl hover:bg-slate-50 hover:text-blue-600 transition shadow-sm mb-4">
                        View All Fixtures <ArrowRight size={12} className="inline ml-1 -mt-0.5" />
                    </Link>
                    </>
                ) : (
                    <div className="text-center py-16 px-4 bg-white rounded-2xl border border-dashed border-slate-300 shadow-sm">
                        <Calendar size={32} className="mx-auto mb-3 text-slate-300"/>
                        <p className="text-sm font-black text-slate-700 mb-1">Season Break</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">No active fixtures found. Check back soon for the new schedule.</p>
                    </div>
                )}
            </div>

            {selectedLeague && (
                <div className="w-full lg:w-80 shrink-0">
                    <div className="sticky top-[120px]">
                        <MiniStandings leagueName={selectedLeague} />
                    </div>
                </div>
            )}
        </div>
      </section>

      {/* 7. Bet of the Day (Using the Stable Match Selection) */}
      {betOfTheDayMatch && <div className="px-4"><BetOfTheDay initialMatch={betOfTheDayMatch} /></div>}

      {/* 8. Highlights */}
      <div className="mt-8">
          <HighlightsSlider highlights={highlights} />
      </div>

      <div className="max-w-4xl mx-auto mt-8"><AdsterraStandardBanner /></div>

      <div className="grid grid-cols-4 gap-3 px-4 py-6 max-w-4xl mx-auto">
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