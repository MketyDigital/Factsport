export const runtime = 'edge';
export const revalidate = 3; 

import { createClient } from '@supabase/supabase-js'; 
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Metadata, ResolvingMetadata } from 'next';
import { cache } from 'react'; 
import { ChevronLeft, Zap, MapPin, Trophy, Grid, Percent, BarChart2, BrainCircuit, History, Play, Calendar, LinkIcon } from 'lucide-react';

import FactSportPlayer from '@/app/components/FactSportPlayer';
import MatchHeaderClient from '@/app/components/MatchHeaderClient'; 
import MatchMobileHub from '@/app/components/MatchMobileHub'; 
import ScoreAxisWidget from '@/app/components/ScoreAxisWidget';
import ProBettingSlipLock from '@/app/components/ProBettingSlipLock'; 
import MatchTime from '@/app/components/MatchTime';
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

  // 1. Get Logged in User for the Fan Zone Chat
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

  const formattedDate = new Date(dbData.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

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

      {/* 🟢 TOP SECTION: Sticky TV Broadcast Player & Scoreboard */}
      {!hasWidget ? (
          <div className="sticky top-0 z-50 shadow-2xl bg-[#0a1428]">
              {/* Minimalist Header */}
              <div className="bg-[#0a1428] text-white p-2 md:p-3 flex items-center justify-between border-b border-white/5">
                  <Link href="/matches" className="p-1.5 bg-white/10 rounded-full hover:bg-white/20 transition backdrop-blur-md">
                    <ChevronLeft size={20} />
                  </Link>
                  <span className="text-[10px] md:text-xs font-black tracking-widest uppercase opacity-90">{dbData.league}</span>
                  <div className="w-8"></div>
              </div>

              {/* FactSport Media Player */}
              {(activeVideoUrl || activeAudioUrl) && (
                  <div className="w-full">
                      {activeVideoUrl ? (
                          <FactSportPlayer mediaUrl={activeVideoUrl} matchId={dbData.id} mode="video" isUpcoming={isUpcomingMatch} />
                      ) : (
                          <FactSportPlayer mediaUrl={activeAudioUrl!} matchId={dbData.id} mode="audio" isUpcoming={isUpcomingMatch} />
                      )}
                  </div>
              )}

              {/* Scoreboard */}
              <div className={`${(activeVideoUrl || activeAudioUrl) ? 'rounded-none' : 'rounded-b-[2.5rem]'} overflow-hidden shadow-xl border-b border-blue-900/30`}>
                  <MatchHeaderClient matchId={dbData.id} initialData={data} />
              </div>
          </div>
      ) : (
          /* LEGACY WIDGET HEADER (If using third-party widget) */
          <div className="bg-[#0a1428] text-white p-4 shadow-md flex items-center justify-between sticky top-0 z-40">
              <Link href="/matches" className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition backdrop-blur-md">
                <ChevronLeft size={20} />
              </Link>
              <span className="text-xs font-bold tracking-widest uppercase opacity-90">{dbData.league}</span>
              <div className="w-9"></div>
          </div>
      )}

      {/* 🟢 MIDDLE SECTION: Adsterra & Match Info Tags */}
      <div className="max-w-4xl mx-auto mt-2 md:mt-4 px-2">
          <AdsterraStandardBanner />
          
          <div className="bg-white rounded-lg p-1.5 shadow-sm border border-slate-100 flex overflow-x-auto scrollbar-hide flex-nowrap items-center gap-1.5 text-[8px] md:text-[9px] font-bold text-slate-500 whitespace-nowrap mt-3">
              <span className="flex items-center gap-1 uppercase bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 shadow-sm text-slate-700 shrink-0">
                  <Calendar className="w-2 h-2 text-slate-400"/> {formattedDate} <span className="text-slate-300 mx-0.5">•</span> <MatchTime date={dbData.match_date} />
              </span>

              {(data?.venue || data?.stage || data?.group || data?.predictor) && (
                  <>
                      {data?.stage && <span className="flex items-center gap-1 uppercase bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 shadow-sm shrink-0"><Trophy className="w-2 h-2 text-yellow-500"/> {data.stage.replace(/_/g, ' ')}</span>}
                      {data?.group && <span className="flex items-center gap-1 uppercase bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 shadow-sm shrink-0"><Grid className="w-2 h-2 text-blue-500"/> {data.group.replace(/_/g, ' ')}</span>}
                      {data?.venue && <span className="flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 shadow-sm shrink-0"><MapPin className="w-2 h-2 text-red-500"/> {data.venue}</span>}
                      {data?.predictor && <span className="flex items-center gap-1 bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 shadow-sm shrink-0"><Percent className="w-2 h-2 text-blue-600"/> Win Prob: {parseFloat(String(data.predictor.home)).toFixed(0)}% | {parseFloat(String(data.predictor.away)).toFixed(0)}%</span>}
                  </>
              )}
          </div>
      </div>

      {/* 🟢 THE MOBILE HUB: (Chat, Stats, Predict, H2H) */}
      {!hasWidget ? (
          <div className="max-w-4xl mx-auto md:px-4 mt-3">
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

      {/* 🟢 BOTTOM SECTION: Pro Tips, Affiliates & Goal Rush */}
      <div className="max-w-4xl mx-auto px-4 mt-6 space-y-6">
          
          {!hasWidget && (
              <>
                  <div id="pro-analysis">
                      <ProBettingSlipLock homeTeam={dbData.home_team} awayTeam={dbData.away_team} status={dbData.status} proAnalysis={dbData.pro_analysis} />
                  </div>

                  <div className="bg-[#1A1A1A] rounded-xl p-2 md:p-3 shadow-md border border-slate-800 flex items-center justify-between relative overflow-hidden group">
                      <div className="flex items-center gap-2 relative z-10">
                          <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-600 text-white text-[9px] md:text-xs font-black rounded-md flex items-center justify-center shadow-lg italic">1X</div>
                          <div>
                              <div className="text-white font-black text-[10px] md:text-xs tracking-tight mb-0">1xBet Partner</div>
                              <div className="text-[7px] md:text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                                  Code: <span className="text-yellow-400 font-black">FACTSPORT</span>
                              </div>
                          </div>
                      </div>
                      <a href={sanitizeUrl(dbData.affiliate_link) || "#"} target="_blank" rel="noopener noreferrer" className="relative z-10 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest px-2 py-1.5 md:px-4 md:py-2.5 rounded-md shadow-md text-[7px] md:text-[9px] flex items-center gap-1">
                          Bet <span className="hidden sm:inline">Now</span> <LinkIcon className="w-2.5 h-2.5" />
                      </a>
                  </div>
              </>
          )}

          <AdsterraNativeBanner />
          
          <FreeTipsBanner />

          {otherLiveMatches && otherLiveMatches.length > 0 && (
              <div className="pb-6">
                  <GoalRush initialMatches={otherLiveMatches} />
              </div>
          )}
      </div>
    </div>
  );
}