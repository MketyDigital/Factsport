export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { createClient } from '@/app/lib/supabase/server';
import Link from 'next/link';
import { ChevronLeft, BarChart2, Calendar, Zap, Ticket, ExternalLink, Video, Mic, Radio, Trophy, Youtube, Newspaper, Link as LinkIcon } from 'lucide-react';
import LiveScoreLabel from '@/app/components/LiveScoreLabel';
import FreeTipsBanner from '@/app/components/FreeTipsBanner'; 

const DEFAULT_AFFILIATE_LINK = "https://refpa58144.com/L?tag=d_1181253m_1599c_&site=1181253&ad=1599"; 

export default async function AllMatchesPage() {
  const supabase = createClient();
  
  const startDate = new Date(); startDate.setDate(startDate.getDate() - 1);
  const endDate = new Date(); endDate.setDate(endDate.getDate() + 2);

  let { data: matches } = await supabase
    .from('matches')
    .select('*')
    .gte('match_date', startDate.toISOString())
    .lte('match_date', endDate.toISOString())
    .order('match_date', { ascending: true });

  // FALLBACK: If no active matches, show recent finished ones (Logic from your original code)
  if (!matches || matches.length === 0) {
      const { data: recent } = await supabase
        .from('matches')
        .select('*')
        .in('status', ['FT', 'FINISHED', 'post'])
        .order('match_date', { ascending: false })
        .limit(15);
      matches = recent || [];
  }

  // Group by League
  const leagues: { [key: string]: any[] } = {};
  matches?.forEach(match => {
    if (!leagues[match.league]) leagues[match.league] = [];
    leagues[match.league].push(match);
  });

  // Sort Logic (Live -> Upcoming -> Finished)
  const sortMatches = (leagueMatches: any[]) => {
    const live = leagueMatches.filter(m => ['LIVE','in','HT'].includes(m.status));
    const upcoming = leagueMatches.filter(m => !['LIVE','in','HT','FT','FINISHED','post'].includes(m.status));
    const finished = leagueMatches.filter(m => ['FT','FINISHED','post'].includes(m.status));
    upcoming.sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime());
    finished.sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime());
    return [...live, ...upcoming, ...finished];
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 pb-20 font-sans">
      
      {/* HEADER */}
      <div className="bg-[#0a1428] text-white p-4 flex items-center gap-4 sticky top-0 z-50 shadow-md">
          <Link href="/" className="p-1 rounded-full hover:bg-white/10 transition"><ChevronLeft /></Link>
          <div>
            <h1 className="font-bold text-lg leading-none">Match Center</h1>
            <p className="text-[10px] text-slate-400 font-medium">All Competitions</p>
          </div>
      </div>

      <div className="p-3 space-y-6">
        <FreeTipsBanner />
        
        {Object.keys(leagues).length === 0 ? (
            <div className="text-center py-20 opacity-50">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                <p className="font-bold text-sm">No matches scheduled</p>
            </div>
        ) : (
            Object.keys(leagues).map((leagueName) => (
                <div key={leagueName} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    
                    {/* LEAGUE HEADER */}
                    <div className="bg-slate-50 px-4 py-3 flex justify-between items-center border-b border-slate-100">
                        <h2 className="font-black text-xs uppercase text-slate-800 tracking-wider truncate mr-2">{leagueName}</h2>
                        <Link href={`/standings?league=${encodeURIComponent(leagueName)}`} className="flex items-center gap-1.5 text-[9px] font-bold text-blue-700 bg-blue-100/50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition whitespace-nowrap">
                            <BarChart2 size={12} /> Table
                        </Link>
                    </div>

                    {/* MATCH LIST */}
                    <div className="divide-y divide-slate-50">
                        {sortMatches(leagues[leagueName]).map((match) => (
                            <div key={match.id} className="block hover:bg-slate-50 transition">
                                <Link href={`/match/${match.id}`} className="block p-4">
                                    <div className="flex items-center justify-between">
                                        
                                        {/* TEAMS */}
                                        <div className="flex-1 space-y-2">
                                            <div className="flex items-center gap-3">
                                                <div className="w-6 h-6 flex items-center justify-center shrink-0">
                                                    {match.home_logo ? <img src={match.home_logo} className="w-full h-full object-contain" /> : <div className="w-5 h-5 bg-slate-200 rounded-full"/>}
                                                </div>
                                                <span className={`text-xs ${match.home_score > match.away_score ? 'font-black text-slate-900' : 'font-medium text-slate-600'}`}>{match.home_team}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="w-6 h-6 flex items-center justify-center shrink-0">
                                                    {match.away_logo ? <img src={match.away_logo} className="w-full h-full object-contain" /> : <div className="w-5 h-5 bg-slate-200 rounded-full"/>}
                                                </div>
                                                <span className={`text-xs ${match.away_score > match.home_score ? 'font-black text-slate-900' : 'font-medium text-slate-600'}`}>{match.away_team}</span>
                                            </div>
                                        </div>

                                        {/* SCORE & STATUS */}
                                        <div className="flex flex-col items-end gap-1">
                                            <div className="flex items-center gap-2">
                                                {match.livestream_url && <Video size={10} className="text-red-500 animate-pulse"/>}
                                                {match.audio_url && <Radio size={10} className="text-blue-500 animate-pulse"/>}
                                                <LiveScoreLabel matchId={match.id} initialStatus={match.status} homeScore={match.home_score} awayScore={match.away_score} matchDate={match.match_date} />
                                            </div>
                                        </div>
                                    </div>
                                </Link>

                                {/* 🟢 RESTORED: ACTION BAR (Betting Logic) */}
                                <div className="px-4 pb-3 flex gap-2">
                                    <Link href={`/match/${match.id}`} className="flex-1 bg-slate-100 text-slate-600 rounded-lg py-2 text-[10px] font-bold flex items-center justify-center gap-1 hover:bg-slate-200">
                                        <Zap size={10}/> Predict
                                    </Link>
                                    
                                    {match.booking_code ? (
                                        <button className="flex-1 bg-[#1A1A1A] text-yellow-400 rounded-lg py-2 text-[10px] font-bold flex items-center justify-center gap-1">
                                            <Ticket size={10}/> {match.booking_code}
                                        </button>
                                    ) : (
                                        <a href={match.affiliate_link || DEFAULT_AFFILIATE_LINK} target="_blank" className="flex-1 bg-green-100 text-green-700 border border-green-200 rounded-lg py-2 text-[10px] font-bold flex items-center justify-center gap-1">
                                            <ExternalLink size={10}/> Bet Now
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))
        )}
      </div>

      {/* 🟢 RESTORED: QUICK ACTIONS FOOTER */}
      <div className="px-4 mb-4 mt-6">
          <div className="bg-[#0a1428] rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 blur-[80px] opacity-20"></div>
              <h3 className="text-white font-black text-lg italic mb-4 relative z-10 flex items-center gap-2"><Zap className="text-yellow-500"/> QUICK ACTIONS</h3>
              <div className="grid grid-cols-3 gap-3 relative z-10">
                  <Link href="/matches" className="bg-white/10 hover:bg-white/20 p-3 rounded-xl flex flex-col items-center justify-center gap-2 transition border border-white/5 active:scale-95">
                      <Trophy className="text-yellow-500" size={24} />
                      <span className="text-[10px] font-bold text-white">Predictions</span>
                  </Link>
                  <Link href="/news" className="bg-white/10 hover:bg-white/20 p-3 rounded-xl flex flex-col items-center justify-center gap-2 transition border border-white/5 active:scale-95">
                      <Newspaper className="text-blue-400" size={24} />
                      <span className="text-[10px] font-bold text-white">Latest News</span>
                  </Link>
                  <a href="https://youtube.com/@factsportlive" target="_blank" className="bg-white/10 hover:bg-white/20 p-3 rounded-xl flex flex-col items-center justify-center gap-2 transition border border-white/5 active:scale-95">
                      <Youtube className="text-red-500" size={24} />
                      <span className="text-[10px] font-bold text-white">YouTube</span>
                  </a>
              </div>
          </div>
      </div>

    </div>
  );
}