export const runtime = 'edge';
export const revalidate = 3; 

import { createClient } from '@supabase/supabase-js';
import { listPublicEditorialArticles } from '@/lib/adapters/postgres-editorial';
import { listPostgresMatchesWindow } from '@/lib/adapters/postgres-matches';
import { listPublicFeaturedMatches, listPublicMatchHighlights } from '@/lib/adapters/postgres-homepage';
import Link from "next/link";
import { Metadata } from 'next';
import { ArrowRight, Youtube, Newspaper, Award, Trophy } from "lucide-react";

import HeadlinesSlider from '@/app/components/HeadlinesSlider';
import InstallAppBanner from '@/app/components/InstallAppBanner'; 
import NewsTicker from '@/app/components/NewsTicker'; 
import LatestNewsList from '@/app/components/LatestNewsList'; 
import HighlightsSlider from '@/app/components/HighlightsSlider'; 
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
  const now = new Date();
  const wideWindowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const wideWindowEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
  const usePostgresEditorial = process.env.FACTSPORT_EDITORIAL_BACKEND === 'postgres';
  const usePostgresMatches = process.env.FACTSPORT_MATCHES_BACKEND === 'postgres';
  const usePostgresHomepage = process.env.FACTSPORT_HOMEPAGE_BACKEND === 'postgres';

  let supabase: ReturnType<typeof createClient> | undefined;
  const getSupabase = () => {
    if (!supabase) {
      supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    }
    return supabase;
  };

  const safeList = async (query: any): Promise<any[]> => {
    try {
      const result = await query;
      return result.data || [];
    } catch {
      return [];
    }
  };

  const [news, highlights, featuredMatches]: [any[], any[], any[]] = await Promise.all([
    usePostgresEditorial
      ? listPublicEditorialArticles({ limit: 25 }).then(rows => rows.map((row: any) => ({
          ...row,
          body: row.excerpt || row.body_markdown,
          image_url: row.hero_media_key ? `/api/media/${row.hero_media_key}` : null,
          team_1_logo: null,
          team_2_logo: null,
          created_at: row.original_created_at || row.published_at,
        })))
      : safeList(getSupabase().from('news').select('*').order('created_at', { ascending: false }).limit(25)),
    usePostgresHomepage
      ? listPublicMatchHighlights(5)
      : safeList(getSupabase().from('matches').select('*').not('video_url', 'is', null).neq('video_url', '').order('match_date', { ascending: false }).limit(5)),
    usePostgresHomepage
      ? listPublicFeaturedMatches({ from: wideWindowStart, to: wideWindowEnd, limit: 10 })
      : safeList(getSupabase().from('matches').select('*').eq('is_featured', true).gte('match_date', wideWindowStart).lte('match_date', wideWindowEnd).order('match_date', { ascending: true }).limit(10)),
  ]);

  let matches: any[] = [];
  if (usePostgresMatches) {
    const rows = await listPostgresMatchesWindow({
      from: wideWindowStart,
      to: wideWindowEnd,
    });
    matches = sortMatches(leagueFilter
      ? rows.filter((match: any) => String(match.league || '').toLowerCase().includes(leagueFilter.toLowerCase()))
      : rows);
  } else if (leagueFilter) {
    const nowStr = new Date().toISOString();
    const [upcoming, past] = await Promise.all([
      safeList(getSupabase().from('matches').select('*').ilike('league', `%${leagueFilter}%`).gte('match_date', nowStr).order('match_date', { ascending: true }).limit(5)),
      safeList(getSupabase().from('matches').select('*').ilike('league', `%${leagueFilter}%`).lt('match_date', nowStr).order('match_date', { ascending: false }).limit(5)),
    ]);
    const combined = [...upcoming, ...past];
    if (combined.length > 0) matches = sortMatches(combined);
  } else {
    const allMatches = await safeList(getSupabase().from('matches').select('*')
      .gte('match_date', wideWindowStart)
      .lte('match_date', wideWindowEnd)
      .order('match_date', { ascending: true })
      .limit(150));
    if (allMatches.length > 0) {
      matches = allMatches;
    } else {
      const recentMatches = await safeList(getSupabase().from('matches').select('*').order('match_date', { ascending: false }).limit(10));
      if (recentMatches.length > 0) matches = recentMatches;
    }
  }

  return {
    matches,
    news: news || [],
    highlights: highlights || [],
    featuredMatches: featuredMatches || [],
  };
}

export default async function Home({ searchParams }: { searchParams: { league?: string } }) {
  const resolvedParams = await searchParams;
  const selectedLeague = resolvedParams.league;
    
  const { matches, news, highlights, featuredMatches } = await getHomepageData(selectedLeague);

  const finalHeadlines = news.filter((n: any) => n.is_headline).slice(0, 3);
  const nonHeadlineNews = news.filter((n: any) => !finalHeadlines.some((h: any) => h.id === n.id));
  const latestNews = nonHeadlineNews.slice(0, 5);
  const rawTicker = nonHeadlineNews.slice(0, 20);
  const tickerNews = [...rawTicker, ...rawTicker];

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 font-sans pb-0 overflow-x-hidden">
      
      <NewsTicker tickerNews={tickerNews} />

      <HomeDashboardClient 
          globalMatches={matches} 
          featuredMatches={featuredMatches} 
          selectedLeague={selectedLeague} 
          
          /* 🟢 ZERO MARGINS BETWEEN THESE THREE COMPONENTS */
          headlinesNode={
              finalHeadlines.length > 0 ? (
                  <div className="w-full m-0 p-0"><HeadlinesSlider headlines={finalHeadlines} /></div>
              ) : null
          }
          installBannerNode={
              <div className="w-full m-0 p-0 max-w-4xl mx-auto"><InstallAppBanner /></div>
          }
          latestNewsNode={
              <div className="w-full m-0 p-0"><LatestNewsList latestNews={latestNews} /></div>
          }
          miniStandingsNode={<MiniStandings leagueName={selectedLeague || 'Premier League'} />} 
      />

      <div className="mt-8">
          <HighlightsSlider highlights={highlights} />
      </div>


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