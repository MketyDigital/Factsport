export const runtime = 'edge';
export const revalidate = 5; 

import { createClient } from '@supabase/supabase-js'; 
import Link from "next/link";
import { Metadata } from 'next';
import { ArrowRight, Youtube, Newspaper, Award, Trophy } from "lucide-react";

import HeadlinesSlider from '@/app/components/HeadlinesSlider';
import InstallAppBanner from '@/app/components/InstallAppBanner'; 
import NewsTicker from '@/app/components/NewsTicker'; 
import LatestNewsList from '@/app/components/LatestNewsList'; 
import HighlightsSlider from '@/app/components/HighlightsSlider'; 
import AdsterraStandardBanner from '@/app/components/AdsterraStandardBanner';
import MiniStandings from '@/app/components/MiniStandings'; 
import HomeDashboardClient from '@/app/components/HomeDashboardClient'; 

export const metadata: Metadata = {
  title: 'FactSport | Live Football, Sport News & Predictions',
  description: 'The #1 Platform for sports | football predictions, live scores, and breaking news.',
};

const LIVE_STATUSES = ['LIVE', 'IN_PLAY', 'IN', '1H', '2H', 'HT', 'HALFTIME', 'ET', 'EXTRA TIME', 'P', 'PENALTIES'];
const FINISHED_STATUSES = ['FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD'];

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

async function getHomepageData(leagueFilter: string | undefined) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    
  const now = new Date();
  const wideWindowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const wideWindowEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

  let matches: any[] = [];

  const [newsRes, highlightsRes, featuredRes] = await Promise.all([
    supabase.from('news').select('*').order('created_at', { ascending: false }).limit(25),
    supabase.from('matches').select('*').not('video_url', 'is', null).neq('video_url', '').order('match_date', { ascending: false }).limit(5),
    supabase.from('matches').select('*').eq('is_featured', true).gte('match_date', wideWindowStart).lte('match_date', wideWindowEnd).order('match_date', { ascending: true }).limit(5)
  ]);

  if (leagueFilter) {
      // 🟢 THE SOLUTION: Fetch closest upcoming AND closest past simultaneously
      const nowStr = new Date().toISOString();
      const [{ data: upcoming }, { data: past }] = await Promise.all([
          supabase.from('matches').select('*').ilike('league', `%${leagueFilter}%`).gte('match_date', nowStr).order('match_date', { ascending: true }).limit(5),
          supabase.from('matches').select('*').ilike('league', `%${leagueFilter}%`).lt('match_date', nowStr).order('match_date', { ascending: false }).limit(5)
      ]);
      
      matches = sortMatches([...(upcoming || []), ...(past || [])]);

  } else {
      const { data: allMatches } = await supabase.from('matches').select('*')
        .gte('match_date', wideWindowStart)
        .lte('match_date', wideWindowEnd)
        .order('match_date', { ascending: true })
        .limit(150); 
      
      if (allMatches && allMatches.length > 0) {
          matches = allMatches; 
      } else {
          const { data: recentMatches } = await supabase.from('matches').select('*')
            .order('match_date', { ascending: false })
            .limit(10);
          if (recentMatches) matches = recentMatches;
      }
  }

  return { matches, news: newsRes.data || [], highlights: highlightsRes.data || [], featuredMatches: featuredRes.data || [] };
}

export default async function Home({ searchParams }: { searchParams: { league?: string } }) {
  const resolvedParams = await searchParams;
  const selectedLeague = resolvedParams.league;
    
  const { matches, news, highlights, featuredMatches } = await getHomepageData(selectedLeague);

  const finalHeadlines = news.filter(n => n.is_headline).slice(0, 3);
  const nonHeadlineNews = news.filter(n => !finalHeadlines.some(h => h.id === n.id));
  const latestNews = nonHeadlineNews.slice(0, 5);
  const rawTicker = nonHeadlineNews.slice(0, 20);
  const tickerNews = [...rawTicker, ...rawTicker];

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 font-sans pb-0 overflow-x-hidden">
      
      {/* 1. Ticker */}
      <NewsTicker tickerNews={tickerNews} />

      {/* 2. TIMEZONE-AWARE DASHBOARD */}
      <HomeDashboardClient 
          globalMatches={matches} 
          featuredMatches={featuredMatches} 
          selectedLeague={selectedLeague} 
          miniStandingsNode={<MiniStandings leagueName={selectedLeague || 'Premier League'} />} 
      />

      <div className="mt-4 max-w-4xl mx-auto"><InstallAppBanner /></div>
      <AdsterraStandardBanner />

      {/* 3. Main Headlines (Separated Layout) */}
      {finalHeadlines.length > 0 && <div className="mt-0 md:mt-4 md:px-4"><HeadlinesSlider headlines={finalHeadlines} /></div>}
      
      {/* 4. Latest News */}
      <LatestNewsList latestNews={latestNews} />

      {/* 5. Highlights */}
      <div className="mt-8">
          <HighlightsSlider highlights={highlights} />
      </div>

      {/* 6. VIP & Footer Links */}
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