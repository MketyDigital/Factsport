export const runtime = 'edge';
export const revalidate = 5; 

import { createClient } from '@/app/lib/supabase/server';
import Link from 'next/link';
import { Video, Mic, Calendar, ChevronLeft, Radio, Trophy, ArrowRight, Activity } from 'lucide-react';
import LiveScoreLabel from '@/app/components/LiveScoreLabel'; 

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
    <div className="min-h-screen bg-[#F0F2F5] pb-20 font-sans text-slate-900">
      
      <div className="bg-red-600 text-white p-4 sticky top-0 z-50 shadow-md flex items-center gap-4">
          <Link href="/" className="p-1 rounded-full hover:bg-white/10 transition"><ChevronLeft /></Link>
          <div>
            <h1 className="font-black text-lg leading-none italic uppercase flex items-center gap-2">
                <Radio className="animate-pulse"/> Live Center
            </h1>
            <p className="text-[10px] text-red-100 font-medium">Watch Alongs & Live Scores</p>
          </div>
      </div>

      <div className="p-4 space-y-8">
        {coveredMatches.length === 0 && liveUncoveredMatches.length === 0 ? (
            <div className="text-center py-20 opacity-60 bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                <p className="font-black text-slate-700 text-sm mb-1">No live matches available right now.</p>
                <p className="text-xs font-bold text-slate-500">
                    Come back on <span className="text-red-600">{nextDateText}</span> for the nearest live action.
                </p>
            </div>
        ) : (
            <>
                <div>
                    <h2 className="text-xs font-black uppercase text-slate-500 mb-3 flex items-center gap-2 pl-1">
                        <Video size={14}/> Live Coverage
                    </h2>
                    
                    {coveredMatches.length === 0 ? (
                        <div className="bg-white/50 border border-slate-200 border-dashed rounded-xl p-6 text-center">
                             <p className="text-xs font-bold text-slate-500">No live coverage available for now.</p>
                             {liveUncoveredMatches.length > 0 && (
                                 <p className="text-[10px] text-slate-400 mt-1">Check out the live scores happening below.</p>
                             )}
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
                        <div className="flex items-center gap-2 mb-3 pl-1 mt-6 border-t border-slate-200 pt-6">
                            <Activity size={14} className="text-slate-400"/>
                            <h2 className="text-xs font-black uppercase text-slate-500">Live Scores</h2>
                        </div>
                        <div className="space-y-4 opacity-90">
                            {liveUncoveredMatches.map(match => (
                                <MatchCard key={match.id} match={match} hasCoverage={false} />
                            ))}
                        </div>
                    </div>
                )}
            </>
        )}
      </div>
    </div>
  );
}

function MatchCard({ match, hasCoverage }: { match: any, hasCoverage: boolean }) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden relative flex flex-col transition-all duration-300">
            <div className={`flex justify-between items-center px-4 py-2 border-b border-slate-100 ${hasCoverage ? 'bg-slate-50' : 'bg-slate-50/50'}`}>
                 <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-wider line-clamp-1">
                     <Trophy size={12} className="text-slate-400"/>
                     {match.league || 'Competition'}
                 </div>
                 <div className="shrink-0">
                     <LiveScoreLabel 
                        matchId={match.id} 
                        initialStatus={match.status} 
                        variant="badge" 
                     />
                 </div>
            </div>

            <Link href={`/match/${match.id}`} className="block p-5 flex-1 hover:bg-slate-50/50 transition-colors">
                
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
                    <div className="flex gap-2 mb-4">
                        {match.livestream_url && (
                            <div className="flex-1 bg-red-50 text-red-600 border border-red-100 py-2 rounded-lg flex items-center justify-center gap-2 text-[10px] font-black">
                                <Video size={12}/> WATCH ALONG
                            </div>
                        )}
                        {match.audio_url && (
                            <div className="flex-1 bg-blue-50 text-blue-600 border border-blue-100 py-2 rounded-lg flex items-center justify-center gap-2 text-[10px] font-black">
                                <Mic size={12}/> RADIO
                            </div>
                        )}
                    </div>
                )}
                
                <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wide pt-2 border-t border-slate-50">
                    Match Center <ArrowRight size={12} />
                </div>
            </Link>
        </div>
    );
}