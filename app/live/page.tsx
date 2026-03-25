export const runtime = 'edge';
export const revalidate = 3; 

import { createClient } from '@supabase/supabase-js'; 
import Link from 'next/link';
import { Metadata } from 'next';
import { Video, Mic, Calendar, ChevronLeft, Radio, Trophy, Activity, PlayCircle, ArrowRight, MessageCircle } from 'lucide-react';
import LiveScoreLabel from '@/app/components/LiveScoreLabel'; 
import BettingPromo from '@/app/components/BettingPromo';
import AdsterraStandardBanner from '@/app/components/AdsterraStandardBanner';
import FactSportMediaRoom from '@/app/components/FactSportMediaRoom'; 
import FanZoneChat from '@/app/components/FanZoneChat'; 

export const metadata: Metadata = {
    title: 'Live Football Scores, Video & Audio Broadcasts | FactSport',
    description: 'Follow live football matches with real-time scores, live audio commentary, and video broadcasts. Don\'t miss a minute of the action.',
};

export default async function LiveMediaPage() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .not('status', 'in', '("FT","FINISHED","AET","PEN","AWARDED","ABD")')
    .order('match_date', { ascending: true });

  const safeMatches = matches || [];
  const coveredMatches = safeMatches.filter(m => m.livestream_url || m.audio_url);
  
  // 🟢 STRICT "TODAY" FILTER LOGIC
  const todayStart = new Date(); 
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart); 
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const liveUncoveredMatches = safeMatches.filter(m => {
      if (m.livestream_url || m.audio_url) return false;
      
      const status = (m.status || '').toUpperCase();
      const isLiveNow = ['LIVE','IN_PLAY','1H','2H','HT','ET','P','PENALTIES'].includes(status);
      
      const matchDate = new Date(m.match_date);
      const isToday = matchDate >= todayStart && matchDate < tomorrowStart;
      
      // Only show if it's currently live OR it is scheduled for TODAY
      return isLiveNow || isToday;
  });

  const nextUpcomingMatch = safeMatches.find(m => new Date(m.match_date) > new Date());
  const nextDateText = nextUpcomingMatch 
    ? new Date(nextUpcomingMatch.match_date).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : "a later date";

  const { data: studioData } = await supabase.from('global_studio').select('*').eq('id', 1).single();

  const isStudioActive = studioData?.is_active;
  const globalMediaUrl = studioData?.video_url || studioData?.audio_url || null;
  const studioTitle = studioData?.title || "Goal Rush Studio";

  return (
    <div className="min-h-screen bg-[#0a1428] pb-20 font-sans text-white selection:bg-red-500">
      
      <div className="bg-[#0f1c3a] border-b border-white/10 text-white p-4 sticky top-0 z-50 shadow-2xl flex items-center gap-4 backdrop-blur-lg">
          <Link href="/" className="p-1.5 bg-white/5 rounded-full hover:bg-white/10 transition border border-white/5"><ChevronLeft size={20} /></Link>
          <div>
            <h1 className="font-black text-lg leading-none italic uppercase flex items-center gap-2 tracking-tight">
                <Radio className="text-red-500 animate-pulse"/> Live Center
            </h1>
            <p className="text-[10px] text-slate-400 font-bold tracking-widest mt-0.5">VIDEO|AUDIO COVERAGE & LIVE SCORES</p>
          </div>
      </div>

      <div className="p-4 space-y-8 max-w-7xl mx-auto mt-4">
        <AdsterraStandardBanner />

        <div className="max-w-2xl mx-auto">
            <BettingPromo affiliateLink={null} />
        </div>

        {isStudioActive && globalMediaUrl && (
            <div className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="lg:col-span-2 flex flex-col h-full">
                    <FactSportMediaRoom matchId="global-goal-rush" mediaUrl={globalMediaUrl} title={studioTitle} />
                </div>
                <div className="lg:col-span-1 bg-white rounded-2xl overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-slate-700 flex flex-col h-full max-h-[600px] lg:max-h-none">
                     <div className="bg-[#0a1428] p-3.5 border-b border-slate-800 flex items-center justify-between shrink-0 shadow-md relative z-10">
                         <div className="flex items-center gap-2.5">
                             <div className="w-8 h-8 bg-blue-600/20 rounded-full flex items-center justify-center border border-blue-500/30">
                                 <MessageCircle size={14} className="text-blue-400"/>
                             </div>
                             <div>
                                 <span className="font-black text-white text-xs tracking-widest uppercase block">Studio Chat</span>
                                 <span className="text-[9px] font-bold text-slate-400 tracking-widest uppercase">Live Fan Zone</span>
                             </div>
                         </div>
                         <span className="flex h-2 w-2 relative mr-2">
                             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                             <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                         </span>
                     </div>
                     <div className="flex-1 overflow-hidden relative">
                         <FanZoneChat matchId="global-goal-rush" />
                     </div>
                </div>
            </div>
        )}

        <div className="max-w-5xl mx-auto space-y-8">
            {coveredMatches.length === 0 && liveUncoveredMatches.length === 0 ? (
                <div className="text-center py-20 bg-white/5 rounded-3xl border border-white/10 p-6 backdrop-blur-sm">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10 shadow-inner">
                        <Calendar className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="font-black text-white text-lg mb-2">No Live Action Right Now</p>
                    <p className="text-xs font-bold text-slate-400">
                        Come back on <span className="text-red-500">{nextDateText}</span> for the next broadcast.
                    </p>
                </div>
            ) : (
                <>
                    <div>
                        <h2 className="text-xs font-black uppercase text-slate-400 mb-4 flex items-center gap-2 pl-1 tracking-widest">
                            <Video size={14} className="text-blue-500"/> Featured Coverage
                        </h2>
                        
                        {coveredMatches.length === 0 ? (
                            <div className="bg-white/5 border border-white/10 border-dashed rounded-2xl p-6 text-center">
                                 <p className="text-xs font-bold text-slate-400">No Live Coverage scheduled currently.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {coveredMatches.map(match => (
                                    <MatchCard key={match.id} match={match} hasCoverage={true} />
                                ))}
                            </div>
                        )}
                    </div>

                    <AdsterraStandardBanner />

                    <div>
                        <div className="flex items-center gap-2 mb-4 pl-1 mt-4 border-t border-white/10 pt-8">
                            <Activity size={14} className="text-red-500 animate-pulse"/>
                            <h2 className="text-xs font-black uppercase text-slate-400 tracking-widest">Other Live Scores</h2>
                        </div>
                        
                        {/* 🟢 FALLBACK FOR EMPTY DAILY SCHEDULE */}
                        {liveUncoveredMatches.length === 0 ? (
                            <div className="bg-white/5 border border-white/10 border-dashed rounded-2xl p-6 md:p-10 flex flex-col items-center justify-center text-center">
                                <Calendar size={24} className="text-slate-500 mb-3 opacity-50" />
                                <p className="text-sm font-black text-white mb-1">No matches scheduled for today.</p>
                                <p className="text-xs font-bold text-slate-400 mb-5">Check the full calendar for upcoming fixtures and past results.</p>
                                <Link href="/matches" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-xl transition-colors shadow-lg active:scale-95">
                                    Open Match Center <ArrowRight size={14} />
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-2.5 opacity-95">
                                {liveUncoveredMatches.map(match => (
                                    <MatchCard key={match.id} match={match} hasCoverage={false} />
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}

            <AdsterraStandardBanner />
        </div>
      </div>
    </div>
  );
}

function MatchCard({ match, hasCoverage }: { match: any, hasCoverage: boolean }) {
    if (!hasCoverage) {
        return (
            <div className="rounded-xl overflow-hidden relative flex flex-col transition-colors border bg-white/[0.03] border-white/5 hover:bg-white/[0.06] group shadow-lg">
                <Link href={`/match/${match.id}`} className="block">
                    <div className="flex justify-between items-center px-3 py-1.5 border-b border-white/5 bg-black/20">
                         <div className="flex items-center gap-1.5 text-[8px] font-black text-slate-400 uppercase tracking-widest line-clamp-1">
                             <Trophy size={10} className="text-slate-500"/>
                             {match.league || 'Competition'}
                         </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 md:p-4">
                        <div className="flex-1 text-right text-xs md:text-sm font-black text-white truncate pr-3">{match.home_team}</div>
                        <div className="shrink-0 flex justify-center w-16">
                            <LiveScoreLabel 
                                matchId={match.id} espnId={match.espn_id} initialStatus={match.status} 
                                homeScore={match.home_score} awayScore={match.away_score} matchDate={match.match_date} 
                            />
                        </div>
                        <div className="flex-1 text-left text-xs md:text-sm font-black text-white truncate pl-3">{match.away_team}</div>
                    </div>
                </Link>
            </div>
        );
    }

    return (
        <div className="rounded-2xl shadow-xl overflow-hidden relative flex flex-col transition-all duration-500 border bg-slate-900 border-slate-700 hover:border-blue-500/50">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-purple-500 to-red-600"></div>
            <div className="flex justify-between items-center px-4 py-2.5 border-b bg-slate-800/50 border-slate-700/50">
                 <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest line-clamp-1">
                     <Trophy size={10} className="text-yellow-500"/>
                     {match.league || 'Competition'}
                 </div>
            </div>
            <Link href={`/match/${match.id}`} className="block p-5 flex-1 hover:bg-white/5 transition-colors group">
                <LiveScoreLabel 
                    matchId={match.id} espnId={match.espn_id} initialStatus={match.status} 
                    homeScore={match.home_score} awayScore={match.away_score} homeTeam={match.home_team} awayTeam={match.away_team} variant="large" 
                />
                {(match.livestream_url || match.audio_url) && (
                    <div className="flex gap-3 mb-2 mt-4">
                        {match.livestream_url && (
                            <div className="flex-1 bg-red-600/20 text-red-500 border border-red-500/30 py-2.5 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black group-hover:bg-red-600 group-hover:text-white transition-all shadow-inner">
                                <PlayCircle size={14}/> WATCH ALONG
                            </div>
                        )}
                        {match.audio_url && (
                            <div className="flex-1 bg-blue-600/20 text-blue-400 border border-blue-500/30 py-2.5 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
                                <Mic size={14}/> LIVE RADIO
                            </div>
                        )}
                    </div>
                )}
            </Link>
        </div>
    );
}