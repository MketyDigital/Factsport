export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { createClient } from '@/app/lib/supabase/server';
import Link from 'next/link';
import { Video, Mic, Calendar, ChevronLeft, Radio } from 'lucide-react';
import LiveScoreLabel from '@/app/components/LiveScoreLabel';

export default async function LiveMediaPage() {
  const supabase = createClient();
  const today = new Date().toISOString();

  // Fetch matches that have EITHER a livestream_url OR an audio_url
  // And are NOT finished (we only want upcoming/live content)
  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .or('livestream_url.neq.null,audio_url.neq.null') // This checks if either is NOT NULL
    .neq('status', 'FT') // Don't show finished games
    .order('match_date', { ascending: true });

  return (
    <div className="min-h-screen bg-[#F0F2F5] pb-20 font-sans text-slate-900">
      
      {/* Header */}
      <div className="bg-red-600 text-white p-4 sticky top-0 z-50 shadow-md flex items-center gap-4">
          <Link href="/" className="p-1 rounded-full hover:bg-white/10 transition"><ChevronLeft /></Link>
          <div>
            <h1 className="font-black text-lg leading-none italic uppercase flex items-center gap-2">
                <Radio className="animate-pulse"/> Live Center
            </h1>
            <p className="text-[10px] text-red-100 font-medium">Watch Alongs & Radio Commentary</p>
          </div>
      </div>

      <div className="p-4 space-y-4">
        {(!matches || matches.length === 0) ? (
            <div className="text-center py-20 opacity-50">
                <Video className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                <p className="font-bold text-sm">No live broadcasts scheduled right now.</p>
                <p className="text-xs">Check back on matchday!</p>
            </div>
        ) : (
            matches.map(match => (
                <div key={match.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden relative">
                    {/* Live Badge */}
                    <div className="absolute top-0 right-0 p-3">
                         {['LIVE','in','1H','2H','HT'].includes(match.status) ? (
                            <span className="bg-red-600 text-white text-[9px] font-black px-2 py-1 rounded animate-pulse">LIVE ON AIR</span>
                         ) : (
                            <span className="bg-slate-100 text-slate-500 text-[9px] font-bold px-2 py-1 rounded">UPCOMING</span>
                         )}
                    </div>

                    <Link href={`/match/${match.id}`} className="block p-5">
                        <div className="flex items-center gap-2 mb-3 text-[10px] font-bold text-slate-400 uppercase">
                            <Calendar size={12}/> {new Date(match.match_date).toLocaleString()}
                        </div>

                        <div className="flex justify-between items-center mb-4">
                            <div className="text-center w-1/3">
                                <div className="text-2xl font-black">{match.home_score ?? 0}</div>
                                <div className="text-xs font-bold text-slate-600 line-clamp-1">{match.home_team}</div>
                            </div>
                            <div className="text-slate-300 font-black text-lg">VS</div>
                            <div className="text-center w-1/3">
                                <div className="text-2xl font-black">{match.away_score ?? 0}</div>
                                <div className="text-xs font-bold text-slate-600 line-clamp-1">{match.away_team}</div>
                            </div>
                        </div>

                        {/* Media Indicators */}
                        <div className="flex gap-2">
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
                    </Link>
                </div>
            ))
        )}
      </div>
    </div>
  );
}