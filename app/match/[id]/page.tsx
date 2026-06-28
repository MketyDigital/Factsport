export const runtime = 'edge';
export const revalidate = 3; 

import { createClient as createPublicClient } from '@supabase/supabase-js'; 
import { createClient as createServerClient } from '@/app/lib/supabase/server'; 

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Metadata, ResolvingMetadata } from 'next';
import { cache } from 'react'; 
import { ChevronLeft, Zap } from 'lucide-react';

import FactSportPlayer from '@/app/components/FactSportPlayer';
import MatchHeaderClient from '@/app/components/MatchHeaderClient'; 
import MatchMobileHub from '@/app/components/MatchMobileHub'; 
import ScoreAxisWidget from '@/app/components/ScoreAxisWidget';
import PredictionBoard from '@/app/components/PredictionBoard';
import HeadToHeadStats from '@/app/components/HeadToHeadStats';
import FreeTipsBanner from '@/app/components/FreeTipsBanner';
import BettingPromo from '@/app/components/BettingPromo'; 

import { getExternalData } from '@/app/lib/matchService';
import { getTeamForm } from '@/app/lib/teamForm';
import { MatchLiveProvider } from '@/app/providers/MatchLiveProvider';
import GoalRushTicker from '@/app/components/GoalRushTicker';

const sanitizeUrl = (url: string | null | undefined) => {
    if (!url) return null;
    if (url.trim().toLowerCase().startsWith('javascript:')) return '#';
    return url;
};

const SCHEDULED_STATUSES = ['SCHEDULED', 'PRE', 'UPCOMING', 'TBD', 'DELAYED'];
const FINISHED_STATUSES = ['FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD'];

const getSupabaseData = cache(async (id: string) => {
    const supabase = createPublicClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data, error } = await supabase.from('matches').select('*').eq('id', id).single();
    if (error) return null;
    return data;
});

// Next 15 Dynamic Route Types
type Props = {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ params, searchParams }: Props, parent: ResolvingMetadata): Promise<Metadata> {
    const resolvedParams = await params;
    const resolvedSearchParams = await searchParams;
    const match = await getSupabaseData(resolvedParams.id);
    
    if (!match) return { title: 'Match Not Found | FactSport' };

    const status = (match.status || '').toUpperCase();
    const isLive = !SCHEDULED_STATUSES.includes(status) && !FINISHED_STATUSES.includes(status);
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
    let description = `Get expert predictions, pro betting analysis, starting lineups, and live updates for ${match.home_team} vs ${match.away_team} in the ${match.league}.`;
    let label = 'UPCOMING MATCH';

    if (isLive) {
        title = `🔴 LIVE: ${match.home_team} ${hScore}-${aScore} ${match.away_team}`;
        description = `Follow the live score, minute-by-minute text commentary, and live match stats for ${match.home_team} vs ${match.away_team}.`;
        label = 'LIVE MATCH UPDATE';
    } else if (isFinished) {
        title = `${match.home_team} ${hScore}-${aScore} ${match.away_team} Result, Highlights & Match Stats`;
        description = `Full time result: ${match.home_team} ${hScore}-${aScore} ${match.away_team}. Watch the highlights, review the pro analysis, and check the final match stats.`;
        label = 'FULL TIME RESULT';
    }

    // 🟢 DYNAMIC OG IMAGE GENERATOR PAYLOAD
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
    
    // Safely encode to base64 for Edge Runtime
    const jsonStr = JSON.stringify(ogDataObj);
    const bytes = new TextEncoder().encode(jsonStr);
    const binStr = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join("");
    const encodedData = btoa(binStr).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://factsport.com';
    const ogImageUrl = `${appUrl}/api/og?data=${encodedData}`;

    const previousImages = (await parent).openGraph?.images || [];
    const activeVideoUrl = sanitizeUrl(isFinished ? match.video_url : match.livestream_url);
    
    // 🟢 OPTION A VS OPTION B DETECTOR (?embed=true)
    const isPlayerShare = resolvedSearchParams?.embed === 'true' || resolvedSearchParams?.play === 'true';

    // Option A: Player Meta Tags
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
                    // The embedded iframe route (app/embed/[id]/page.tsx)
                    playerUrl: `${appUrl}/embed/${match.id}`, 
                    streamUrl: activeVideoUrl,
                    width: 1280,
                    height: 720
                }]
            } 
        };
    }

    // Option B: Standard Image Meta Tags (Default)
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

  const supabaseServer = createServerClient();
  await supabaseServer.auth.getUser();

  const dbData = await getSupabaseData(resolvedParams.id);
  if (!dbData) return notFound();

  const rawData = await getExternalData(dbData);
  const data: any = rawData || {};
  
  data.home_form = await getTeamForm(dbData.home_team);
  data.away_form = await getTeamForm(dbData.away_team);
  
  const currentStatus = (dbData.status || '').toUpperCase();
  const isFinished = FINISHED_STATUSES.includes(currentStatus);
  const isLive = !SCHEDULED_STATUSES.includes(currentStatus) && !isFinished;
  
  const matchDateMs = new Date(dbData.match_date).getTime();
  const minutesToKick = (matchDateMs - Date.now()) / 60000;
  
  const isUniversallyFinished = isFinished || minutesToKick < -240;

  const activeVideoUrl = sanitizeUrl(isUniversallyFinished ? dbData.video_url : dbData.livestream_url);
  const activeAudioUrl = sanitizeUrl(isUniversallyFinished ? null : dbData.audio_url);

  let isServerLocked = true;
  if (isUniversallyFinished) {
      isServerLocked = false; 
  } else if (isLive) {
      isServerLocked = false;
  } else {
      if (minutesToKick <= 5 && minutesToKick > -240) {
          isServerLocked = false; 
      }
  }

  const hasWidget = !!dbData.widget_id; 

  const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'SportsEvent',
      name: `${dbData.home_team} vs ${dbData.away_team}`,
      description: `Live scores, H2H stats, and predictions for ${dbData.home_team} vs ${dbData.away_team} in the ${dbData.league}.`,
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
  
  const publicSupabase = createPublicClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: tickerMatches } = await publicSupabase
      .from('matches')
      .select('id, espn_id, home_team, away_team, status, home_score, away_score, match_date, displayClock')
      .gte('match_date', windowStart)
      .lte('match_date', windowEnd)
      .limit(50); 

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
                      <MatchHeaderClient dbData={dbData} />
                  </div>

                  <div className="w-full bg-white border-b border-slate-200">
                      <HeadToHeadStats dbData={data} />
                  </div>

                  {(activeVideoUrl || activeAudioUrl) && (
                      <div className="w-full bg-black">
                          {activeVideoUrl ? (
                              <FactSportPlayer mediaUrl={activeVideoUrl} matchId={dbData.id} mode="video" isLocked={isServerLocked} matchDate={dbData.match_date} isFinished={isUniversallyFinished} />
                          ) : (
                              <FactSportPlayer mediaUrl={activeAudioUrl!} matchId={dbData.id} mode="audio" isLocked={isServerLocked} matchDate={dbData.match_date} isFinished={isUniversallyFinished} />
                          )}
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
                  <MatchMobileHub matchId={dbData.id} espnId={dbData.espn_id} dbData={dbData} />
              ) : (
                  <ScoreAxisWidget matchId={dbData.widget_id} affiliateLink={sanitizeUrl(dbData.affiliate_link) || undefined} />
              )}

              {!hasWidget && !isUniversallyFinished && (
                  <div className="mt-4 space-y-4">
                      <div id="predictions" className="bg-white rounded-lg shadow-sm p-3 border border-slate-200 scroll-mt-20">
                          <h3 className="text-[10px] font-black uppercase tracking-tight text-slate-800 flex items-center gap-1 mb-2">
                              <Zap className="w-3 h-3 text-yellow-500 fill-yellow-500" /> Predict & Win
                          </h3>
                          <PredictionBoard matchId={dbData.id} matchDate={dbData.match_date} homeTeam={dbData.home_team} awayTeam={dbData.away_team} />
                      </div>
                  </div>
              )}

              <div className="mt-4"><FreeTipsBanner /></div>
          </div>
      </MatchLiveProvider>
    </div>
  );
}