export const runtime = 'edge';
export const revalidate = 3; 

import { createClient as createPublicClient } from '@supabase/supabase-js';
import { getPostgresMatchById, getPostgresMatchPlaybackById, listPostgresMatchesWindow, getPostgresTeamForm } from '@/lib/adapters/postgres-matches';
import { getPublicHomepageSettings } from '@/lib/adapters/postgres-homepage';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Metadata, ResolvingMetadata } from 'next';
import { cache } from 'react'; 
import { ChevronLeft, Zap } from 'lucide-react';

import SecureMatchPlayer from '@/app/components/SecureMatchPlayer';
import MatchHeaderClient from '@/app/components/MatchHeaderClient'; 
import MatchMobileHub from '@/app/components/MatchMobileHub'; 
import ScoreAxisWidget from '@/app/components/ScoreAxisWidget';
import PredictionBoard from '@/app/components/PredictionBoard';
import HeadToHeadStats from '@/app/components/HeadToHeadStats';

import { getExternalData } from '@/app/lib/matchService';
import { getTeamForm } from '@/app/lib/teamForm';
import { MatchLiveProvider } from '@/app/providers/MatchLiveProvider';
import GoalRushTicker from '@/app/components/GoalRushTicker';

const sanitizeUrl = (url: string | null | undefined) => {
    if (!url) return null;
    const trimmed = url.trim();
    if (!trimmed || trimmed.toLowerCase() === 'streamio') return trimmed || null;
    if (trimmed.startsWith('//') || trimmed.includes(String.fromCharCode(92))) return null;
    const rawPath = trimmed.split(/[?#]/, 1)[0];
    if (rawPath.split('/').some(segment => segment === '..')) return null;
    try {
        let parsed: URL;
        try {
            parsed = new URL(trimmed);
        } catch {
            parsed = new URL(trimmed, 'https://factsport.invalid');
            if (parsed.origin !== 'https://factsport.invalid') return null;
            return `${parsed.pathname}${parsed.search}${parsed.hash}`;
        }
        if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return null;
        return parsed.toString();
    } catch {
        return null;
    }
};

const LIVE_STATUSES = ['LIVE', 'IN_PLAY', 'IN', '1H', '2H', 'HT', 'HALFTIME', 'HALF TIME', 'ET', 'EXTRA TIME', 'P', 'PENALTIES', 'PAUSED', 'SUSPENDED'];
const FINISHED_STATUSES = ['FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD'];

const isPostgresMatchDetail = () => process.env.FACTSPORT_MATCH_DETAIL_BACKEND === 'postgres';

const getMatchData = cache(async (id: string): Promise<any> => {
    if (isPostgresMatchDetail()) {
        const row = await getPostgresMatchById(id);
        if (!row) return null;
        return {
            ...row,
            widget_id: row.provider_widget_id || null,
            displayClock: row.display_clock || '',
        };
    }
    if (process.env.NODE_ENV !== 'development') return null;

    // Development-only parity fallback. Production Media pages never read the
    // legacy Supabase match row or its Prediction-only columns.
    const supabase = createPublicClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data, error } = await supabase.from('matches')
        .select('id, api_id, espn_id, league, home_team, away_team, home_score, away_score, match_date, status, home_logo, away_logo, video_url, livestream_url, audio_url, widget_id, venue, stage, match_group, match_events, stats, lineups, h2h, referees, predictor, displayClock')
        .eq('id', id).single();
    if (error) return null;
    return data;
});

const getMatchPlayback = cache(async (id: string): Promise<any> => {
    if (isPostgresMatchDetail()) return getPostgresMatchPlaybackById(id);
    if (process.env.NODE_ENV !== 'development') return null;
    const match: any = await getMatchData(id);
    if (!match) return null;
    return {
        id: match.id, match_date: match.match_date, status: match.status,
        video_url: match.video_url, livestream_url: match.livestream_url, audio_url: match.audio_url,
    };
});


// Next 15 Dynamic Route Types
type Props = {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ params, searchParams }: Props, parent: ResolvingMetadata): Promise<Metadata> {
    const resolvedParams = await params;
    const resolvedSearchParams = await searchParams;
    const [match, playback]: [any, any] = await Promise.all([getMatchData(resolvedParams.id), getMatchPlayback(resolvedParams.id)]);
    
    if (!match) return { title: 'Match Not Found | FactSport' };

    const status = (match.status || '').toUpperCase();
    const isLive = LIVE_STATUSES.includes(status);
    const isFinished = FINISHED_STATUSES.includes(status);
    
    let hScore = match.home_score || 0;
    let aScore = match.away_score || 0;

    if (isLive && match.espn_id) {
        try {
            const res = await fetch(`https://live-api.factsport.com/?espn_id=${match.espn_id}`, { next: { revalidate: 3 } });
            if (res.ok) {
                const liveData = await res.json();
                if (!liveData.error) {
                    hScore = liveData.home_score;
                    aScore = liveData.away_score;
                }
            }
        } catch (e) {}
    }

    let title = `${match.home_team} vs ${match.away_team} Predictions, H2H & Live Score | FactSport`;
    let description = `View match details, team form, starting lineups and live updates for ${match.home_team} vs ${match.away_team} in the ${match.league}.`;
    let label = 'UPCOMING MATCH';

    if (isLive) {
        title = `🔴 LIVE: ${match.home_team} ${hScore}-${aScore} ${match.away_team}`;
        description = `Follow the live score, minute-by-minute text commentary, and live match stats for ${match.home_team} vs ${match.away_team}.`;
        label = 'LIVE MATCH UPDATE';
    } else if (isFinished) {
        title = `${match.home_team} ${hScore}-${aScore} ${match.away_team} Result, Highlights & Match Stats`;
        description = `Full time result: ${match.home_team} ${hScore}-${aScore} ${match.away_team}. Watch the highlights, review the match report, and check the final match stats.`;
        label = 'FULL TIME RESULT';
    }

    const ogDataObj = {
        type: 'versus',
        home: match.home_team,
        away: match.away_team,
        homeLogo: match.home_logo,
        awayLogo: match.away_logo,
        hScore: isLive || isFinished ? hScore : undefined,
        aScore: isLive || isFinished ? aScore : undefined,
        label: label,
        homeTla: match.home_team?.substring(0, 3).toUpperCase(),
        awayTla: match.away_team?.substring(0, 3).toUpperCase()
    };
    
    const jsonStr = JSON.stringify(ogDataObj);
    const bytes = new TextEncoder().encode(jsonStr);
    const binStr = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join("");
    const encodedData = btoa(binStr).replace(/\+/g, '-',).replace(/\//g, '_').replace(/=+$/, '');
    
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://factsport.com';
    const ogImageUrl = `${appUrl}/api/og?data=${encodedData}`;

    const previousImages = (await parent).openGraph?.images || [];
    const mediaUnlockAt = new Date(match.match_date).getTime() - 15 * 60 * 1000;
    const mediaUnlocked = isFinished || isLive || (Number.isFinite(mediaUnlockAt) && Date.now() >= mediaUnlockAt);
    const activeVideoUrl = mediaUnlocked ? sanitizeUrl(isFinished ? playback?.video_url : playback?.livestream_url) : null;

    const isPlayerShare = resolvedSearchParams?.embed === 'true' || resolvedSearchParams?.play === 'true';

    if (isPlayerShare && activeVideoUrl) {
        return { 
            title, 
            description, 
            openGraph: { 
                title, 
                description, 
                type: 'video.other', 
                images: [ogImageUrl, ...previousImages],
                videos: [{ url: activeVideoUrl, secureUrl: activeVideoUrl }]
            }, 
            twitter: { 
                card: 'player', 
                title, 
                description,
                images: [ogImageUrl],
                players: [{
                    playerUrl: `${appUrl}/embed/${match.id}`, 
                    streamUrl: activeVideoUrl,
                    width: 1280,
                    height: 720
                }]
            } 
        };
    }

    return { 
        title, 
        description, 
        openGraph: { 
            title, 
            description, 
            type: 'website', 
            images: [ogImageUrl, ...previousImages] 
        }, 
        twitter: { 
            card: 'summary_large_image', 
            title, 
            description,
            images: [ogImageUrl]
        } 
    };
}

export default async function MatchDetailsPage({ params, searchParams }: Props) {
  const resolvedParams = await params;
  if (!resolvedParams?.id) return notFound();

  const [dbData, playback]: [any, any] = await Promise.all([getMatchData(resolvedParams.id), getMatchPlayback(resolvedParams.id)]);
  if (!dbData) return notFound();

  // Only the safe public match projection crosses into client components.
  // Raw stream URLs stay server-side and VIP analysis is fetched through an
  // authenticated API that verifies the user's profile on the server.
  const clientMatchData = {
      id: dbData.id,
      api_id: dbData.api_id,
      espn_id: dbData.espn_id,
      league: dbData.league,
      home_team: dbData.home_team,
      away_team: dbData.away_team,
      home_score: dbData.home_score,
      away_score: dbData.away_score,
      match_date: dbData.match_date,
      status: dbData.status,
      home_logo: dbData.home_logo,
      away_logo: dbData.away_logo,
      venue: dbData.venue,
      stage: dbData.stage,
      match_group: dbData.match_group,
      match_events: dbData.match_events,
      stats: dbData.stats,
      lineups: dbData.lineups,
      h2h: dbData.h2h,
      referees: dbData.referees,
      predictor: dbData.predictor,
      widget_id: dbData.widget_id || dbData.provider_widget_id || null,
      displayClock: dbData.displayClock || dbData.display_clock || '',
  };

  const rawData = await getExternalData(clientMatchData);
  const data: any = rawData || {};
  
  if (isPostgresMatchDetail()) {
      data.home_form = await getPostgresTeamForm(dbData.home_team);
      data.away_form = await getPostgresTeamForm(dbData.away_team);
  } else {
      data.home_form = await getTeamForm(dbData.home_team);
      data.away_form = await getTeamForm(dbData.away_team);
  }
  
  const currentStatus = (dbData.status || '').toUpperCase();
  const isFinishedApi = FINISHED_STATUSES.includes(currentStatus);
  const isLive = LIVE_STATUSES.includes(currentStatus);
  
  // Raw media URLs remain server-side; the playback API enforces the unlock time.
  const isUniversallyFinished = isFinishedApi;
  const hasVideoSource = !!sanitizeUrl(isUniversallyFinished ? playback?.video_url : playback?.livestream_url);
  const hasAudioSource = !isUniversallyFinished && !!sanitizeUrl(playback?.audio_url);
  const hasPlayerSource = hasVideoSource || hasAudioSource;
  const initialPlayerMode: 'video' | 'audio' = hasVideoSource ? 'video' : 'audio';

  const hasWidget = !!dbData.widget_id; 

  const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'SportsEvent',
      name: `${dbData.home_team} vs ${dbData.away_team}`,
      description: `Live scores, H2H stats, and match information for ${dbData.home_team} vs ${dbData.away_team} in the ${dbData.league}.`,
      startDate: new Date(dbData.match_date).toISOString(),
      eventStatus: isUniversallyFinished ? 'https://schema.org/EventScheduled' : (isLive ? 'https://schema.org/EventLive' : 'https://schema.org/EventScheduled'),
      sport: 'Soccer',
      competitor: [
          { '@type': 'SportsTeam', name: dbData.home_team, image: sanitizeUrl(dbData.home_logo) || undefined },
          { '@type': 'SportsTeam', name: dbData.away_team, image: sanitizeUrl(dbData.away_logo) || undefined }
      ]
  };

  const now = new Date();
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  
  let tickerMatches: any[] = [];
  if (isPostgresMatchDetail()) {
      const rows = await listPostgresMatchesWindow({ from: windowStart, to: windowEnd });
      tickerMatches = rows.slice(0, 50).map((row: any) => ({
          id: row.id, espn_id: row.espn_id, home_team: row.home_team, away_team: row.away_team,
          status: row.status, home_score: row.home_score, away_score: row.away_score,
          match_date: row.match_date, displayClock: row.display_clock || '',
      }));
  } else if (process.env.NODE_ENV === 'development') {
      const publicSupabase = createPublicClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const { data } = await publicSupabase.from('matches')
          .select('id, espn_id, home_team, away_team, status, home_score, away_score, match_date, displayClock')
          .gte('match_date', windowStart).lte('match_date', windowEnd).limit(50);
      tickerMatches = data || [];
  }

  let siteSettings: { announcement_text?: string | null; announcement_link?: string | null; announcement_enabled?: boolean | null } = {};
  if (process.env.FACTSPORT_HOMEPAGE_BACKEND === 'postgres') {
      siteSettings = (await getPublicHomepageSettings()) || {};
  } else if (process.env.NODE_ENV === 'development') {
      const publicSupabase = createPublicClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const result = await publicSupabase.from('site_settings')
          .select('announcement_text, announcement_link, announcement_enabled').limit(1).maybeSingle();
      siteSettings = (result.data || {}) as typeof siteSettings;
  }
  const announcement = {
      text: siteSettings.announcement_text || '',
      link: siteSettings.announcement_link || null,
      enabled: siteSettings.announcement_enabled === true
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 pb-24 font-sans">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <GoalRushTicker allMatches={tickerMatches || []} currentMatchId={dbData.id} />

      <MatchLiveProvider espnId={dbData.espn_id} initialData={data}>
          {!hasWidget ? (
              <div className="w-full">
                  <div className="bg-[#0a1428]">
                      <div className="text-white px-2 py-1.5 flex items-center justify-between border-b border-white/5 max-w-4xl mx-auto">
                          <Link href="/matches" className="p-1 bg-white/10 rounded-full hover:bg-white/20 transition"><ChevronLeft size={16} /></Link>
                          <span className="text-[9px] font-black tracking-widest uppercase opacity-80">{dbData.league}</span>
                          <div className="w-6"></div>
                      </div>
                      <MatchHeaderClient dbData={clientMatchData} />
                  </div>

                  <div className="w-full bg-white border-b border-slate-200">
                      <HeadToHeadStats dbData={data} />
                  </div>

                  {hasPlayerSource && (
                       <div className="w-full bg-black">
                           <SecureMatchPlayer
                               matchId={dbData.id}
                               initialMode={initialPlayerMode}
                               matchDate={dbData.match_date}
                               homeTeam={dbData.home_team}
                               awayTeam={dbData.away_team}
                               homeLogo={dbData.home_logo}
                               awayLogo={dbData.away_logo}
                               announcement={announcement}
                           />
                       </div>
                   )}
                      </div>
          ) : (
              <div className="bg-[#0a1428] text-white p-3 shadow-md flex items-center justify-between sticky top-0 z-40">
                  <Link href="/matches" className="p-1.5 bg-white/10 rounded-full"><ChevronLeft size={16} /></Link>
                  <span className="text-[10px] font-bold tracking-widest uppercase">{dbData.league}</span>
                  <div className="w-8"></div>
              </div>
          )}

          <div className="max-w-4xl mx-auto mt-3 px-2">
              {!hasWidget ? (
                  <MatchMobileHub matchId={dbData.id} espnId={dbData.espn_id} dbData={clientMatchData} chatEnabled={process.env.NODE_ENV === 'development'} />
              ) : (
                  <ScoreAxisWidget matchId={dbData.widget_id} />
              )}

              {!hasWidget && (
                  <div className="mt-4 space-y-4">
                      <div id="predictions" className="bg-white rounded-lg shadow-sm p-3 border border-slate-200 scroll-mt-20">
                          <h3 className="text-[10px] font-black uppercase tracking-tight text-slate-800 flex items-center gap-1 mb-2">
                              <Zap className="w-3 h-3 text-yellow-500 fill-yellow-500" /> Match predictions
                          </h3>
                          {process.env.NODE_ENV === 'development' && <PredictionBoard matchId={dbData.id} matchDate={dbData.match_date} homeTeam={dbData.home_team} awayTeam={dbData.away_team} />}
                      </div>
                  </div>
              )}

          </div>
      </MatchLiveProvider>
    </div>
  );
}