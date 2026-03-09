export const runtime = 'edge';
export const revalidate = 3; 

import { createClient } from '@/app/lib/supabase/server';
import Link from 'next/link';
// 🔥 Added ArrowRight to imports for the banner
import { Video, Mic, Calendar, ChevronLeft, Radio, Trophy, Activity, PlayCircle, ArrowRight } from 'lucide-react';
import LiveScoreLabel from '@/app/components/LiveScoreLabel'; 
import AutoRefresh from '@/app/components/AutoRefresh';
import BettingPromo from '@/app/components/BettingPromo'; // 🔥 IMPORTED BETTING PROMO

export default async function LiveMediaPage() {
  const supabase = createClient();

  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .not('status', 'in', '("FT","FINISHED","AET","PEN","AWARDED","ABD")')
    .order('match_date', { ascending: true });

  const safeMatches = matches || [];
  const coveredMatches = safeMatches.filter(m => m.livestream_url || m.audio_url);
  const liveUncoveredMatches = safeMatches.filter(m => 
    !m.livestream_url && !m.audio_url && 
    ['LIVE','IN_PLAY','1H','2H','HT'].includes(m.status)
  );

  const nextUpcomingMatch = safeMatches.find(m => new Date(m.match_date) > new Date());
  const nextDateText = nextUpcomingMatch 
    ? new Date(nextUpcomingMatch.match_date).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : "a later date";

  return (
    <div className="min-h-screen bg-[#0a1428] pb-20 font-sans text-white selection:bg-red-500">
      
      {/* 🔥 INVISIBLE AUTO REFRESH COMPONENT (Fires every 60s) */}
      <AutoRefresh interval={60000} />
      
      <div className="bg-[#0f1c3a] border-b border-white/10 text-white p-4 sticky top-0 z-50 shadow-2xl flex items-center gap-4 backdrop-blur-lg">
          <Link href="/" className="p-1.5 bg-white/5 rounded-full hover:bg-white/10 transition border border-white/5"><ChevronLeft size={20} /></Link>
          <div>
            <h1 className="font-black text-lg leading-none italic uppercase flex items-center gap-2 tracking-tight">
                <Radio className="text-red-500 animate-pulse"/> Live Center
            </h1>
            <p className="text-[10px] text-slate-400 font-bold tracking-widest mt-0.5">WATCH ALONGS & LIVE SCORES</p>
          </div>
      </div>

      <div className="p-4 space-y-8 max-w-5xl mx-auto mt-4">
        
        {/* 🟢 COMPONENT 1: BETTING PROMO (Compact layout at the top) */}
        <div className="max-w-2xl mx-auto">
            <BettingPromo affiliateLink={null} />
        </div>

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
                             <p className="text-xs font-bold text-slate-400">No watchalongs scheduled currently.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {coveredMatches.map(match => (
                                <MatchCard key={match.id} match={match} hasCoverage={true} />
                            ))}
                        </div>
                    )}
                </div>

                {liveUncoveredMatches.length > 0 && (
                    <div>
                        <div className="flex items-center gap-2 mb-4 pl-1 mt-8 border-t border-white/10 pt-8">
                            <Activity size={14} className="text-red-500 animate-pulse"/>
                            <h2 className="text-xs font-black uppercase text-slate-400 tracking-widest">Other Live Scores</h2>
                        </div>
                        <div className="space-y-4 opacity-95">
                            {liveUncoveredMatches.map(match => (
                                <MatchCard key={match.id} match={match} hasCoverage={false} />
                            ))}
                        </div>
                    </div>
                )}
            </>
        )}

        {/* 🟢 COMPONENT 2: PREDICT & WIN BANNER (Slim layout at the bottom) */}
        <div className="mt-10 max-w-3xl mx-auto bg-[#0a1428] rounded-2xl p-4 md:p-5 border border-yellow-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500 opacity-10 rounded-full blur-2xl transform translate-x-10 -translate-y-10"></div>
            <div className="flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(234,179,8,0.4)]">
                    <Trophy size={24} className="text-black fill-black" />
                </div>
                <div>
                    <h3 className="font-black text-lg uppercase italic text-white leading-tight tracking-tighter">Predict & <span className="text-yellow-500">Win Prizes</span></h3>
                    <p className="text-xs text-slate-400 font-bold mt-0.5">Join the leaderboard for fantastic rewards.</p>
                </div>
            </div>
            <Link href="/vip/upgrade" className="relative z-10 w-full sm:w-auto shrink-0 bg-yellow-500 hover:bg-yellow-400 text-black px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition flex items-center justify-center gap-2 active:scale-95 shadow-md">
                Play Now <ArrowRight size={14}/>
            </Link>
        </div>

      </div>
    </div>
  );
}

// THE UNTOUCHED MATCH CARD LOGIC
function MatchCard({ match, hasCoverage }: { match: any, hasCoverage: boolean }) {
    return (
        <div className={`rounded-2xl shadow-xl overflow-hidden relative flex flex-col transition-all duration-500 border ${hasCoverage ? 'bg-slate-900 border-slate-700 hover:border-blue-500/50' : 'bg-white/5 border-white/10'}`}>
            
            {hasCoverage && <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-purple-500 to-red-600"></div>}

            <div className={`flex justify-between items-center px-4 py-2.5 border-b ${hasCoverage ? 'bg-slate-800/50 border-slate-700/50' : 'bg-black/20 border-white/5'}`}>
                 <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest line-clamp-1">
                     <Trophy size={10} className={hasCoverage ? "text-yellow-500" : "text-slate-500"}/>
                     {match.league || 'Competition'}
                 </div>
                 <div className="shrink-0 drop-shadow-md">
                     <LiveScoreLabel 
                        matchId={match.id} 
                        initialStatus={match.status} 
                        variant="badge" 
                     />
                 </div>
            </div>

            <Link href={`/match/${match.id}`} className="block p-5 flex-1 hover:bg-white/5 transition-colors group">
                
                <LiveScoreLabel 
                    matchId={match.id} 
                    initialStatus={match.status} 
                    homeScore={match.home_score} 
                    awayScore={match.away_score}
                    homeTeam={match.home_team}
                    awayTeam={match.away_team}
                    variant="large" 
                />

                {hasCoverage && (match.livestream_url || match.audio_url) && (
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