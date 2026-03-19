export const runtime = 'edge';
export const revalidate = 3; 

import { createClient } from '@supabase/supabase-js'; 
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

import FactSportPlayer from '@/app/components/FactSportPlayer';
import MatchHeaderClient from '@/app/components/MatchHeaderClient'; 
import MatchMobileHub from '@/app/components/MatchMobileHub'; // 🟢 NEW
import ProBettingSlipLock from '@/app/components/ProBettingSlipLock'; 
import GoalRush from '@/app/components/GoalRush'; 
import AdsterraStandardBanner from '@/app/components/AdsterraStandardBanner';
import AdsterraNativeBanner from '@/app/components/AdsterraNativeBanner';

import { getExternalData } from '@/app/lib/matchService';
import { getTeamForm } from '@/app/lib/teamForm';

// ... (Keep your existing sanitizeUrl, generateMetadata, and getSupabaseData functions here) ...

export default async function MatchDetailsPage({ params }: { params: { id: string } }) {
  const resolvedParams = await params;
  if (!resolvedParams?.id) return notFound();

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  // 1. Get the current logged-in user for the Fan Zone!
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
  const isFinished = ['FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD'].includes(currentStatus);
  const isUpcomingMatch = ['SCHEDULED', 'PRE', 'UPCOMING', 'TBD', 'DELAYED'].includes(currentStatus);
  
  const activeVideoUrl = sanitizeUrl(isFinished ? dbData.video_url : dbData.livestream_url);
  const activeAudioUrl = sanitizeUrl(dbData.audio_url);

  // 🟢 We check if this is our proprietary broadcast (e.g. YouTube unlisted link)
  const isOurBroadcast = activeVideoUrl?.includes('youtube.com') || activeAudioUrl?.includes('youtube.com');

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 pb-24 font-sans">
      
      {/* 🟢 TOP SECTION: Sticky Media Player & Scoreboard */}
      <div className="sticky top-0 z-50 shadow-2xl">
          {/* Minimalist Header */}
          <div className="bg-[#0a1428] text-white p-2 md:p-4 flex items-center justify-between">
              <Link href="/matches" className="p-1.5 bg-white/10 rounded-full hover:bg-white/20 transition backdrop-blur-md">
                <ChevronLeft size={20} />
              </Link>
              <span className="text-[10px] md:text-xs font-black tracking-widest uppercase opacity-90">{dbData.league}</span>
              <div className="w-8"></div>
          </div>

          {/* FactSport Player (If available) */}
          {(activeVideoUrl || activeAudioUrl) && (
              <div className="w-full">
                  {activeVideoUrl ? (
                      <FactSportPlayer mediaUrl={activeVideoUrl} mode="video" isUpcoming={isUpcomingMatch} />
                  ) : (
                      <FactSportPlayer mediaUrl={activeAudioUrl!} mode="audio" isUpcoming={isUpcomingMatch} />
                  )}
              </div>
          )}

          {/* The Scoreboard (Rounds the bottom corners if no player is active) */}
          <div className={`${(activeVideoUrl || activeAudioUrl) ? 'rounded-none' : 'rounded-b-3xl'}`}>
              <MatchHeaderClient matchId={dbData.id} initialData={data} />
          </div>
      </div>

      <div className="max-w-4xl mx-auto mt-2">
          <AdsterraStandardBanner />
      </div>

      {/* 🟢 MIDDLE SECTION: The Mobile Hub (Chat, Stats, Predict, H2H) */}
      <div className="max-w-4xl mx-auto md:px-4 md:mt-6">
          <MatchMobileHub 
              matchId={dbData.id} 
              espnId={dbData.espn_id} 
              currentUser={currentUser} 
              initialData={data} 
              dbData={dbData} 
          />
      </div>

      {/* 🟢 BOTTOM SECTION: Pro Tips & Goal Rush */}
      <div className="max-w-4xl mx-auto px-4 mt-6 space-y-6">
          <div id="pro-analysis">
              <ProBettingSlipLock homeTeam={dbData.home_team} awayTeam={dbData.away_team} status={dbData.status} proAnalysis={dbData.pro_analysis} />
          </div>

          <AdsterraNativeBanner />

          {otherLiveMatches && otherLiveMatches.length > 0 && (
              <div className="pb-6">
                  <GoalRush initialMatches={otherLiveMatches} />
              </div>
          )}
      </div>
    </div>
  );
}