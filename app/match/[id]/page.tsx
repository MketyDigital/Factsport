export const runtime = 'edge';
export const revalidate = 3; 

import { createClient } from '@supabase/supabase-js'; 
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Metadata, ResolvingMetadata } from 'next';
import { cache } from 'react'; 
import { ChevronLeft, Zap, LinkIcon, RadioTower } from 'lucide-react';

import FactSportPlayer from '@/app/components/FactSportPlayer';
import MatchHeaderClient from '@/app/components/MatchHeaderClient'; 
import MatchMobileHub from '@/app/components/MatchMobileHub'; 
import ScoreAxisWidget from '@/app/components/ScoreAxisWidget';
import PredictionBoard from '@/app/components/PredictionBoard';
import HeadToHeadStats from '@/app/components/HeadToHeadStats';
import GoalRush from '@/app/components/GoalRush'; 
import FreeTipsBanner from '@/app/components/FreeTipsBanner';
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

export async function generateMetadata({ params }: { params: { id: string } }, parent: ResolvingMetadata): Promise<Metadata> {
    const resolvedParams = await params;
    const match = await getSupabaseData(resolvedParams.id);
    if (!match) return { title: 'Match Not Found | FactSport' };

    const status = (match.status || '').toUpperCase();
    const isLive = !SCHEDULED_STATUSES.includes(status) && !FINISHED_STATUSES.includes(status);
    const isFinished = FINISHED_STATUSES.includes(status);
    let title = `${match.home_team} vs ${match.away_team} Predictions, H2H & Live Score | FactSport`;
    let description = `Get expert predictions, pro betting analysis, starting lineups, and live updates for ${match.home_team} vs ${match.away_team} in the ${match.league}.`;

    if (isLive) {
        title = `🔴 LIVE: ${match.home_team} ${match.home_score}-${match.away_score} ${match.away_team}`;
        description = `Follow the live score, minute-by-minute text commentary, and live match stats for ${match.home_team} vs ${match.away_team}.`;
    } else if (isFinished) {
        title = `${match.home_team} ${match.home_score}-${match.away_score} ${match.away_team} Result, Highlights & Match Stats`;
        description = `Full time result: ${match.home_team} ${match.home_score}-${match.away_score} ${match.away_team}. Watch the highlights, review the pro analysis, and check the final match stats.`;
    }

    const previousImages = (await parent).openGraph?.images || [];
    return { title, description, openGraph: { title, description, type: 'website', images: match.home_logo && match.away_logo ? [match.home_logo, ...previousImages] : previousImages }, twitter: { card: 'summary_large_image', title, description } };
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
  
  const matchDateMs = new Date(dbData.match_date).getTime();
  const minutesToKick = (matchDateMs - Date.now()) / 60000;
  const isUpcomingMatch = SCHEDULED_STATUSES.includes(currentStatus) && minutesToKick > 5;
  
  const activeVideoUrl = sanitizeUrl(isFinished ? dbData.video_url : dbData.livestream_url);
  const activeAudioUrl = sanitizeUrl(dbData.audio_url);
  const hasWidget = !!dbData.widget_id; 

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 pb-24 font-sans">
      {!hasWidget ? (
          <div className="w-full">
              {/* 1. HEADER */}
              <div className="bg-[#0a1428]">
                  <div className="text-white px-2 py-1.5 flex items-center justify-between border-b border-white/5 max-w-4xl mx-auto">
                      <Link href="/matches" className="p-1 bg-white/10 rounded-full hover:bg-white/20 transition"><ChevronLeft size={16} /></Link>
                      <span className="text-[9px] font-black tracking-widest uppercase opacity-80">{dbData.league}</span>
                      <div className="w-6"></div>
                  </div>
                  <MatchHeaderClient matchId={dbData.id} initialData={data} dbData={dbData} />
              </div>

              {/* 2. HEAD TO HEAD (Flushed directly under header, ALWAYS SHOWS) */}
              <div className="w-full bg-white border-b border-slate-200">
                  <HeadToHeadStats dbData={data} />
              </div>

              {/* 3. MEDIA PLAYER & GUEST BANNER */}
              {(activeVideoUrl || activeAudioUrl) && (
                  <div className="w-full bg-black">
                      {activeVideoUrl ? (
                          <FactSportPlayer mediaUrl={activeVideoUrl} matchId={dbData.id} mode="video" isUpcoming={isUpcomingMatch} isFinished={isFinished} />
                      ) : (
                          <FactSportPlayer mediaUrl={activeAudioUrl!} matchId={dbData.id} mode="audio" isUpcoming={isUpcomingMatch} isFinished={isFinished} />
                      )}

                      {/* 4. GUEST BROADCASTER BANNER */}
                      <div className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 px-3 py-2 flex items-center justify-between text-black shadow-inner">
                          <div className="flex items-center gap-1.5">
                              <RadioTower size={12} className="animate-pulse" />
                              <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest">Studio</span>
                          </div>
                          <span className="text-[9px] md:text-[10px] font-bold">Want to have your say on air? <a href="#" className="underline font-black decoration-black/50 underline-offset-2">Click Here</a></span>
                      </div>
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

      {/* 5. MOBILE HUB (Tabs) */}
      <div className="max-w-4xl mx-auto mt-3 px-2">
          {!hasWidget ? (
              <MatchMobileHub matchId={dbData.id} espnId={dbData.espn_id} currentUser={currentUser} initialData={data} dbData={dbData} />
          ) : (
              <ScoreAxisWidget matchId={dbData.widget_id} affiliateLink={sanitizeUrl(dbData.affiliate_link) || undefined} />
          )}

          {!hasWidget && (
              <div className="mt-4 space-y-4">
                  <div id="predictions" className="bg-white rounded-lg shadow-sm p-3 border border-slate-200 scroll-mt-20">
                      <h3 className="text-[10px] font-black uppercase tracking-tight text-slate-800 flex items-center gap-1 mb-2">
                          <Zap className="w-3 h-3 text-yellow-500 fill-yellow-500" /> Predict & Win
                      </h3>
                      <PredictionBoard matchId={dbData.id} matchDate={dbData.match_date} homeTeam={dbData.home_team} awayTeam={dbData.away_team} />
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
              </div>
          )}

          <div className="mt-4"><AdsterraNativeBanner /></div>
          <div className="mt-4"><FreeTipsBanner /></div>

          {otherLiveMatches && otherLiveMatches.length > 0 && (
              <div className="mt-4 pb-4">
                  <GoalRush initialMatches={otherLiveMatches} />
              </div>
          )}
      </div>
    </div>
  );
}