export const runtime = 'edge';
export const revalidate = 5; 

import { createClient } from '@supabase/supabase-js'; 
import Link from "next/link";
import { Metadata } from 'next';
import { ArrowRight, Youtube, Newspaper, TrendingUp, Calendar, Award, Trophy, Info } from "lucide-react";

import HeadlinesSlider from '@/app/components/HeadlinesSlider';
import InstallAppBanner from '@/app/components/InstallAppBanner'; // 🟢 NEW
import FreeTipsBanner from '@/app/components/FreeTipsBanner';
import NewsTicker from '@/app/components/NewsTicker'; 
import LatestNewsList from '@/app/components/LatestNewsList'; 
import HighlightsSlider from '@/app/components/HighlightsSlider'; 
import HeroMatchCards from '@/app/components/HeroMatchCards'; 
import AdsterraStandardBanner from '@/app/components/AdsterraStandardBanner';
import CompactMatchRow from '@/app/components/CompactMatchRow';
import MiniStandings from '@/app/components/MiniStandings'; // 🟢 NEW
import BetOfTheDay from '@/app/components/BetOfTheDay'; // 🟢 NEW

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

  let matches: any[] = [];
  let isShowingFallbackResults = false;

  const [newsRes, highlightsRes, featuredRes] = await Promise.all([
    supabase.from('news').select('*').order('created_at', { ascending: false }).limit(25),
    supabase.from('matches').select('*').not('video_url', 'is', null).neq('video_url', '').order('match_date', { ascending: false }).limit(5),
    supabase.from('matches').select('*').eq('is_featured', true).gte('match_date', todayStart.toISOString()).order('match_date', { ascending: true }).limit(5)
  ]);

  if (leagueFilter) {
      const { data: activeMatches } = await supabase.from('matches')
          .select('*')
          .ilike('league', `%${leagueFilter}%`)
          .not('status', 'in', '("FT","FINISHED","AET","PEN","AWARDED","ABD","POST","ENDED")')
          .order('match_date', { ascending: true })
          .limit(5); // 🟢 Limit strictly to 5 per league tab

      if (activeMatches && activeMatches.length > 0) {
          matches = activeMatches;
      } else {
          const { data: pastMatches } = await supabase.from('matches')
              .select('*')
              .ilike('league', `%${leagueFilter}%`)
              .in('status', ['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED', 'ABD', 'POST', 'ENDED'])
              .order('match_date', { ascending: false }) 
              .limit(5); // 🟢 Limit strictly to 5 per league tab

          if (pastMatches && pastMatches.length > 0) {
              matches = pastMatches;
              isShowingFallbackResults = true; 
          }
      }
      matches = sortMatches(matches);

  } else {
      const { data: defaultMatches } = await supabase.from('matches').select('*')
        .or(`status.eq.LIVE,status.eq.IN_PLAY,status.eq.HT,status.eq.in,match_date.gte.${todayStart.toISOString()}`)
        .order('match_date', { ascending: true })
        .limit(50); 
      
      matches = defaultMatches || [];

      if (matches.length > 0) {
          matches = getDiverseMatches(matches, 15); // 🟢 Limit strictly to 15 for "For You"
      } else {
          const { data: finishedMatches } = await supabase.from('matches').select('*')
            .in('status', ['FT', 'FINISHED', 'ABD', 'post', 'POST', 'ENDED', 'AET', 'PEN']) 
            .order('match_date', { ascending: false })
            .limit(10);
          if (finishedMatches) matches = finishedMatches;
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

  let heroMatches: any[] = [...featuredMatches];
  const mediaMatches = matches.filter(m => m.livestream_url || m.audio_url || m.video_url);
  mediaMatches.forEach(m => {
      if (!heroMatches.find(h => h.id === m.id) && heroMatches.length < 5) heroMatches.push(m);
  });

  if (heroMatches.length < 5) {
      const bigTeams = ['Arsenal', 'Chelsea', 'Liverpool', 'Man City', 'Manchester City', 'Man United', 'Manchester United', 'Tottenham', 'Real Madrid', 'Barcelona', 'Atletico', 'Bayern', 'Dortmund', 'Leverkusen', 'Juventus', 'Inter', 'AC Milan', 'Napoli', 'PSG'];
      const activeMatches = matches.filter(m => !FINISHED_STATUSES.includes((m.status || '').toUpperCase()));
      const candidates = activeMatches.length > 0 ? activeMatches : matches;
      const bigMatches = candidates.filter(m => { return bigTeams.some(giant => (m.home_team && m.home_team.toLowerCase().includes(giant.toLowerCase())) || (m.away_team && m.away_team.toLowerCase().includes(giant.toLowerCase()))); });
      
      bigMatches.forEach(m => {
          if (!heroMatches.find(h => h.id === m.id) && heroMatches.length < 5) heroMatches.push(m);
      });
  }

  heroMatches = heroMatches.slice(0, 5);
  const displayMatches = matches.filter(m => !heroMatches.some(h => h.id === m.id));
  const groupedMatches = groupByDate(displayMatches);

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 font-sans pb-0 overflow-x-hidden">
      
      {/* 1. Ticker */}
      <NewsTicker tickerNews={tickerNews} />

      {/* 2. Hero Matches */}
      {!selectedLeague && heroMatches.length > 0 && (
          <div className="bg-[#0f1c3a] pt-3 pb-4">
            <HeroMatchCards heroMatches={heroMatches} />
          </div>
      )}

      <AdsterraStandardBanner />

      {/* 3. Main Headlines */}
      {finalHeadlines.length > 0 && <div className="mt-0 md:mt-4 md:px-4"><HeadlinesSlider headlines={finalHeadlines} /></div>}
      
      {/* 🟢 NEW: 4. PWA Install Prompt */}
      <div className="mt-4 max-w-4xl mx-auto"><InstallAppBanner /></div>

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
            {/* MATCHES COLUMN */}
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

                            {/* 🟢 THE 2-COLUMN GRID ON ALL SCREENS */}
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
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">No active fixtures found in the database. Check back soon for the new season schedule.</p>
                    </div>
                )}
            </div>

            {/* 🟢 NEW: MINI STANDINGS WIDGET COLUMN */}
            <div className="w-full lg:w-80 shrink-0">
                <div className="sticky top-[120px]">
                    <MiniStandings leagueName={selectedLeague || 'Premier League'} />
                </div>
            </div>
        </div>
      </section>

      {/* 🟢 NEW: 7. Bet of the Day (After Match Center) */}
      <div className="px-4"><BetOfTheDay match={heroMatches[0] || matches[0]} /></div>

      {/* 8. Highlights */}
      <div className="mt-8">
          <HighlightsSlider highlights={highlights} />
      </div>

      {/* 9. VIP / Leaders / Footer Links */}
      <div className="mx-4 mb-4 mt-8 max-w-4xl md:mx-auto">
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

      <div className="max-w-4xl mx-auto"><AdsterraStandardBanner /></div>

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