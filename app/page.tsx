export const runtime = 'edge';
export const revalidate = 3; 

import { createClient } from '@supabase/supabase-js';
import { listPublicEditorialArticles } from '@/lib/adapters/postgres-editorial';
import { listPostgresMatchesWindow } from '@/lib/adapters/postgres-matches';
import { listPublicFeaturedMatches, listPublicMatchHighlights } from '@/lib/adapters/postgres-homepage';
import Link from "next/link";
import { Metadata } from 'next';
import { headers } from 'next/headers';
import { ArrowRight, Youtube, Newspaper, Award, Trophy } from "lucide-react";

import HeadlinesSlider from '@/app/components/HeadlinesSlider';
import InstallAppBanner from '@/app/components/InstallAppBanner'; 
import NewsTicker from '@/app/components/NewsTicker'; 
import LatestNewsList from '@/app/components/LatestNewsList'; 
import HighlightsSlider from '@/app/components/HighlightsSlider'; 
import MiniStandings from '@/app/components/MiniStandings'; 
import HomeDashboardClient from '@/app/components/HomeDashboardClient'; 

async function isPrivateProductRequest(): Promise<boolean> {
  const rawPrivateHost = (process.env.FACTSPORT_PRIVATE_PRODUCT_HOST || '').trim();
  if (!rawPrivateHost) return false;
  let privateHost = '';
  try {
    privateHost = new URL(rawPrivateHost.includes('://') ? rawPrivateHost : `https://${rawPrivateHost}`).hostname.toLowerCase();
  } catch {
    return false;
  }
  const requestHeaders = await headers();
  const requestHost = (requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || '')
    .split(',')[0].trim().toLowerCase().split(':')[0];
  return Boolean(privateHost && requestHost && requestHost === privateHost);
}

export async function generateMetadata(): Promise<Metadata> {
  if (await isPrivateProductRequest()) {
    return {
      title: 'FactSport Predict | Match Predictions',
      description: 'Sign in to your FactSport Predict account.',
      robots: { index: false, follow: false, noarchive: true, nosnippet: true },
    };
  }
  return {
    title: 'FactSport | Football News, Live Scores & Match Analysis',
    description: 'Football news, live scores, fixtures, match analysis and highlights from leagues around the world.',
  };
}

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

  if (process.env.NODE_ENV !== 'development' && !(usePostgresEditorial && usePostgresMatches && usePostgresHomepage)) {
    // Production Media must never fall back to legacy SELECT * projections,
    // which can include Prediction-only fields and affiliate settings.
    return { matches: [], news: [], highlights: [], featuredMatches: [] };
  }

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
  if (await isPrivateProductRequest()) return <PredictionEntryPage />;
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
              <span className="text-[10px] font-bold text-slate-700">Matches</span>
          </Link>
          <Link href="/standings" className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition hover:shadow-md">
              <Award className="text-yellow-500" size={20} />
              <span className="text-[10px] font-bold text-slate-700">Tables</span>
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

function PredictionEntryPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0a1428] px-5 py-12 text-white">
      <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-sm md:p-10">
        <p className="text-xs font-black uppercase tracking-[.22em] text-blue-300">FactSport Predict</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">Your predictions, in one place.</h1>
        <p className="mt-4 max-w-lg text-sm leading-6 text-slate-300 md:text-base">
          Play free predictions without an account, or sign in to your central Predict account for member features.
        </p>
        <Link href="/matches" className="group mt-8 flex min-h-24 items-center justify-between overflow-hidden rounded-2xl border border-cyan-300/25 bg-gradient-to-r from-blue-700/70 to-cyan-500/20 p-5 shadow-[0_12px_50px_rgba(0,180,255,.14)] transition duration-300 hover:-translate-y-1 hover:border-cyan-200/70 hover:shadow-[0_18px_55px_rgba(0,180,255,.24)]">
          <span><span className="block text-lg font-black">Explore free predictions</span><span className="mt-1 block text-xs text-blue-100">Pick a fixture and submit when you’re ready.</span></span>
          <span aria-hidden="true" className="text-3xl transition-transform duration-300 group-hover:translate-x-1">⚽</span>
        </Link>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-600 px-6 text-sm font-extrabold text-white transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200">
            Sign in
          </Link>
          <Link href="/register" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/20 bg-white/5 px-6 text-sm font-extrabold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
            Create account
          </Link>
        </div>
      </section>
    </main>
  );
}
