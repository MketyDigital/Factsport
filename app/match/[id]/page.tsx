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
import AdsterraStandardBanner from '@/app/components/AdsterraStandardBanner';
import BettingPromo from '@/app/components/BettingPromo'; 

import { getExternalData } from '@/app/lib/matchService';
import { getTeamForm } from '@/app/lib/teamForm';
import { MatchLiveProvider } from '@/app/providers/MatchLiveProvider';

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

export async function generateMetadata({ params }: { params: { id: string } }, parent: ResolvingMetadata): Promise<Metadata> {
    const resolvedParams = await params;
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

    if (isLive) {
        title = `🔴 LIVE: ${match.home_team} ${hScore}-${aScore} ${match.away_team}`;
        description = `Follow the live score, minute-by-minute text commentary, and live match stats for ${match.home_team} vs ${match.away_team}.`;
    } else if (isFinished) {
        title = `${match.home_team} ${hScore}-${aScore} ${match.away_team} Result, Highlights & Match Stats`;
        description = `Full time result: ${match.home_team} ${hScore}-${aScore} ${match.away_team}. Watch the highlights, review the pro analysis, and check the final match stats.`;
    }

    const previousImages = (await parent).openGraph?.images || [];
    return { 
        title, 
        description, 
        openGraph: { title, description, type: 'website', images: match.home_logo && match.away_logo ? [match.home_logo, ...previousImages] : previousImages }, 
        twitter: { card: 'summary_large_image', title, description } 
    };
}

export default async function MatchDetailsPage({ params }: { params: { id: string } }) {
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

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 pb-24 font-sans">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

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

              {/* 🟢 Post-Match Purge: Destroy Predictions and Betting Promos after the match */}
              {!hasWidget && !isUniversallyFinished && (
                  <div className="mt-4 space-y-4">
                      <div id="predictions" className="bg-white rounded-lg shadow-sm p-3 border border-slate-200 scroll-mt-20">
                          <h3 className="text-[10px] font-black uppercase tracking-tight text-slate-800 flex items-center gap-1 mb-2">
                              <Zap className="w-3 h-3 text-yellow-500 fill-yellow-500" /> Predict & Win
                          </h3>
                          <PredictionBoard matchId={dbData.id} matchDate={dbData.match_date} homeTeam={dbData.home_team} awayTeam={dbData.away_team} />
                      </div>
                      
                      <BettingPromo affiliateLink={sanitizeUrl(dbData.affiliate_link) || null} />
                  </div>
              )}

              <div className="mt-4"><AdsterraStandardBanner /></div>
              <div className="mt-4"><FreeTipsBanner /></div>
          </div>
      </MatchLiveProvider>
    </div>
  );
}