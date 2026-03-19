export const runtime = 'edge';
export const revalidate = 3; 

import { createClient } from '@supabase/supabase-js'; 
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Metadata, ResolvingMetadata } from 'next';
import { cache } from 'react'; 
import { ChevronLeft, Zap, LinkIcon } from 'lucide-react';

import FactSportPlayer from '@/app/components/FactSportPlayer';
import MatchHeaderClient from '@/app/components/MatchHeaderClient'; 
import MatchMobileHub from '@/app/components/MatchMobileHub'; 
import ScoreAxisWidget from '@/app/components/ScoreAxisWidget';
import PredictionBoard from '@/app/components/PredictionBoard';
import HeadToHeadStats from '@/app/components/HeadToHeadStats';
import GoalRush from '@/app/components/GoalRush'; 
import FreeTipsBanner from '@/app/components/FreeTipsBanner';
import AdsterraStandardBanner from '@/app/components/AdsterraStandardBanner';
import AdsterraNativeBanner from '@/app/components/AdsterraNativeBanner';

import { getExternalData } from '@/app/lib/matchService';
import { getTeamForm } from '@/app/lib/teamForm';

const sanitizeUrl = (url: string | null | undefined) => {
    if (!url) return null;
    if (url.trim().toLowerCase().startsWith('javascript:')) return '#';
    return url;
};

const SCHEDULED_STATUSES = ['SCHEDULED', 'PRE', 'UPCOMING', 'TBD', 'DELAYED'];
const FINISHED_STATUSES = ['FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD'];

const getSupabaseData = cache(async (id: string) => {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data, error } = await supabase.from('matches').select('*').eq('id', id).single();
    if (error) return null;
    return data;
});

export async function generateMetadata(
    { params }: { params: { id: string } },
    parent: ResolvingMetadata
): Promise<Metadata> {
    const resolvedParams = await params;
    const match = await getSupabaseData(resolvedParams.id);
    
    if (!match) return { title: 'Match Not Found | FactSport' };

    const status = (match.status || '').toUpperCase();
    const isLive = !SCHEDULED_STATUSES.includes(status) && !FINISHED_STATUSES.includes(status);
    const isFinished = FINISHED_STATUSES.includes(status);

    let mediaTag = "";
    if (match.livestream_url) mediaTag = " | Watch Live";
    else if (match.audio_url) mediaTag = " | Live Radio";

    let title = `${match.home_team} vs ${match.away_team} Predictions, H2H & Live Score | FactSport`;
    let description = `Get expert predictions, pro betting analysis, starting lineups, and live updates for ${match.home_team} vs ${match.away_team} in the ${match.league}.`;

    if (isLive) {
        title = `🔴 LIVE: ${match.home_team} ${match.home_score}-${match.away_score} ${match.away_team}${mediaTag}`;
        description = `Follow the live score, minute-by-minute text commentary, and live match stats for ${match.home_team} vs ${match.away_team}.`;
    } else if (isFinished) {
        title = `${match.home_team} ${match.home_score}-${match.away_score} ${match.away_team} Result, Highlights & Match Stats`;
        description = `Full time result: ${match.home_team} ${match.home_score}-${match.away_score} ${match.away_team}. Watch the highlights, review the pro analysis, and check the final match stats.`;
    }

    const previousImages = (await parent).openGraph?.images || [];

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            type: 'website',
            images: match.home_logo && match.away_logo ? [match.home_logo, ...previousImages] : previousImages,
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
        }
    };
}

export default async function MatchDetailsPage({ params }: { params: { id: string } }) {
  const resolvedParams = await params;
  if (!resolvedParams?.id) return notFound();

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: authData } = await supabase.auth.getUser();
  const currentUser = authData?.user || null;

  const dbData = await getSupabaseData(resolvedParams.id);
  if (!dbData) return notFound();

  const { data: otherLiveMatches } = await supabase
      .from('matches')
      .select('id, espn_id, home_team, away_team, home_score, away_score, status, displayClock')
      .in('status', ['LIVE', 'IN_PLAY', '1H', '2H', 'HT', 'ET', 'P', 'PENALTIES'])
      .neq('id', resolvedParams.id) 
      .limit(8);

  const rawData = await getExternalData(dbData);
  const data: any = rawData || {};
  
  data.home_form = await getTeamForm(dbData.home_team);
  data.away_form = await getTeamForm(dbData.away_team);
  
  const currentStatus = (dbData.status || '').toUpperCase();
  const isFinished = FINISHED_STATUSES.includes(currentStatus);
  const isUpcomingMatch = SCHEDULED_STATUSES.includes(currentStatus);
  
  const activeVideoUrl = sanitizeUrl(isFinished ? dbData.video_url : dbData.livestream_url);
  const activeAudioUrl = sanitizeUrl(dbData.audio_url);
  const hasWidget = !!dbData.widget_id; 

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    "name": `${dbData.home_team} vs ${dbData.away_team}`,
    "description": `Live coverage, predictions, and stats for ${dbData.home_team} vs ${dbData.away_team}.`,
    "startDate": new Date(dbData.match_date).toISOString(),
    "sport": "Soccer",
    "competitor": [
      { "@type": "SportsTeam", "name": dbData.home_team, "image": dbData.home_logo || "" },
      { "@type": "SportsTeam", "name": dbData.away_team, "image": dbData.away_logo || "" }
    ],
    "homeTeam": { "@type": "SportsTeam", "name": dbData.home_team },
    "awayTeam": { "@type": "SportsTeam", "name": dbData.away_team },
    ...(dbData.venue && { "location": { "@type": "Place", "name": dbData.venue } }),
    ...(!isUpcomingMatch && { "eventStatus": isFinished ? "https://schema.org/EventRescheduled" : "https://schema.org/EventLive" })
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 pb-24 font-sans">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {!hasWidget ? (
          <div className="bg-[#0a1428] shadow-md">
              <div className="text-white px-2 py-1.5 flex items-center justify-between border-b border-white/5">
                  <Link href="/matches" className="p-1 bg-white/10 rounded-full hover:bg-white/20 transition">
                    <ChevronLeft size={16} />
                  </Link>
                  <span className="text-[9px] font-black tracking-widest uppercase opacity-80">{dbData.league}</span>
                  <div className="w-6"></div>
              </div>

              <MatchHeaderClient matchId={dbData.id} initialData={data} dbData={dbData} />

              {(activeVideoUrl || activeAudioUrl) && (
                  <div className="w-full bg-black border-t border-blue-900/30">
                      {activeVideoUrl ? (
                          <FactSportPlayer mediaUrl={activeVideoUrl} matchId={dbData.id} mode="video" isUpcoming={isUpcomingMatch} />
                      ) : (
                          <FactSportPlayer mediaUrl={activeAudioUrl!} matchId={dbData.id} mode="audio" isUpcoming={isUpcomingMatch} />
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

      <div className="max-w-4xl mx-auto mt-2 px-2">
          <AdsterraStandardBanner />
          
          {!hasWidget ? (
              <div className="mt-2">
                  <MatchMobileHub 
                      matchId={dbData.id} 
                      espnId={dbData.espn_id} 
                      currentUser={currentUser} 
                      initialData={data} 
                      dbData={dbData} 
                  />
              </div>
          ) : (
              <div className="mt-2">
                  <ScoreAxisWidget matchId={dbData.widget_id} affiliateLink={sanitizeUrl(dbData.affiliate_link) || undefined} />
              </div>
          )}
      </div>

      <div className="max-w-4xl mx-auto px-2 mt-4 space-y-4">
          {!hasWidget && (
              <>
                  <div id="predictions" className="scroll-mt-16 bg-white rounded-lg shadow-sm p-3 border border-slate-200">
                      <h3 className="text-[10px] font-black uppercase tracking-tight text-slate-800 flex items-center gap-1 mb-2">
                          <Zap className="w-3 h-3 text-yellow-500 fill-yellow-500" /> Predict & Win
                      </h3>
                      <PredictionBoard matchId={dbData.id} matchDate={dbData.match_date} homeTeam={dbData.home_team} awayTeam={dbData.away_team} />
                  </div>

                  <div id="h2h" className="scroll-mt-16">
                      <HeadToHeadStats dbData={data} />
                  </div>

                  <div className="bg-[#1A1A1A] rounded-lg p-2.5 shadow-sm border border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-600 text-white text-[9px] font-black rounded flex items-center justify-center italic">1X</div>
                          <div>
                              <div className="text-white font-black text-[10px] leading-none">1xBet Partner</div>
                              <div className="text-[7px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                                  Code: <span className="text-yellow-400 font-black">FACTSPORT</span>
                              </div>
                          </div>
                      </div>
                      <a href={sanitizeUrl(dbData.affiliate_link) || "#"} target="_blank" className="bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest px-3 py-1.5 rounded shadow text-[8px] flex items-center gap-1 active:scale-95">
                          Bet <LinkIcon className="w-2.5 h-2.5" />
                      </a>
                  </div>
              </>
          )}

          <AdsterraNativeBanner />
          <FreeTipsBanner />

          {otherLiveMatches && otherLiveMatches.length > 0 && (
              <div className="pb-4">
                  <GoalRush initialMatches={otherLiveMatches} />
              </div>
          )}
      </div>
    </div>
  );
}