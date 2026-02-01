export const runtime = 'edge';

import { createClient } from '@/app/lib/supabase/server';
import Link from 'next/link';
import { 
  ChevronLeft, Calendar, Video, Mic, Share2, 
  MapPin, Flag, Trophy, Clock, AlignLeft, 
  AlertCircle, Radio, PlayCircle
} from 'lucide-react';
import LiveScoreLabel from '@/app/components/LiveScoreLabel';
import FreeTipsBanner from '@/app/components/FreeTipsBanner';
import { getExternalData } from '@/app/lib/matchService';

// 🟢 CONFIG: Default 1xBet Link
const DEFAULT_AFFILIATE_LINK = "https://refpa58144.com/L?tag=d_1181253m_1599c_&site=1181253&ad=1599";

// ✅ Helper Icon for Live Feed
const getEventIcon = (text: string, type: string) => {
    const lower = (text + type).toLowerCase();
    if (lower.includes('goal')) return '⚽';
    if (lower.includes('corner')) return '⛳';
    if (lower.includes('foul')) return '🛑';
    if (lower.includes('yellow card')) return '🟨';
    if (lower.includes('red card')) return '🟥';
    if (lower.includes('save')) return '🧤';
    if (lower.includes('substitution')) return '🔄';
    if (lower.includes('half')) return '⏱️';
    return '•';
};

// ✅ Helper for Goal Icon vs Time
const GoalTime = ({ time }: { time: string }) => {
    if (!time || time === "0'" || time === "0") {
        return <span className="text-sm">⚽</span>; // Shows Ball if no time
    }
    return <span className="text-[10px] font-mono text-green-600 bg-green-50 px-1 rounded">{time}</span>;
};

export default async function MatchDetailsPage({ params }: { params: { id: string } }) {
  const resolvedParams = await params;
  const matchId = resolvedParams.id;
  const supabase = createClient();
  
  // 1. Fetch DB Match Data
  const { data: matchData } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single();

  if (!matchData) return <div className="text-center p-10">Match not found</div>;

  // 2. Fetch External Data (ESPN)
  const unifiedData = await getExternalData(matchData);

  // 3. Helpers
  const isLive = unifiedData.status === 'LIVE' || unifiedData.status === 'in';
  const isFinished = unifiedData.status === 'FT' || unifiedData.status === 'post';

  return (
    <div className="min-h-screen bg-[#F0F2F5] pb-20 font-sans text-slate-900">
      
      {/* HEADER */}
      <div className="bg-[#0a1428] text-white sticky top-0 z-50 shadow-lg">
          <div className="p-4 flex items-center justify-between">
              <Link href="/" className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition backdrop-blur-md"><ChevronLeft size={20}/></Link>
              <div className="text-center">
                 <h1 className="text-xs font-bold text-slate-400 uppercase tracking-widest">{matchData.league}</h1>
                 {isLive && <span className="text-[10px] font-black text-red-500 animate-pulse bg-red-500/10 px-2 py-0.5 rounded mt-1 inline-block">LIVE NOW</span>}
              </div>
              <button className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition backdrop-blur-md"><Share2 size={20}/></button>
          </div>

          {/* SCORE CARD */}
          <div className="px-6 pb-8 pt-2">
              <div className="flex justify-between items-center relative">
                  {/* Home Team */}
                  <div className="flex-1 flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-white rounded-2xl p-2 shadow-lg shadow-black/20">
                          {unifiedData.home.logo ? <img src={unifiedData.home.logo} className="w-full h-full object-contain"/> : <div className="w-full h-full bg-slate-200 rounded-xl"/>}
                      </div>
                      <span className="font-bold text-sm text-center leading-tight max-w-[100px]">{unifiedData.home.name}</span>
                  </div>

                  {/* Score */}
                  <div className="flex flex-col items-center px-4 z-10">
                      {matchData.status === 'SCHEDULED' ? (
                          <div className="text-center">
                              <div className="text-3xl font-black tracking-tighter mb-1">{new Date(matchData.match_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                              <span className="text-[10px] font-bold text-slate-400 bg-white/10 px-2 py-1 rounded">VS</span>
                          </div>
                      ) : (
                          <div className="text-center">
                              <div className="text-5xl font-black tracking-tighter flex items-center gap-3 mb-1 shadow-black/50 drop-shadow-2xl">
                                  <span>{unifiedData.home.score}</span>
                                  <span className="text-slate-600 text-3xl">:</span>
                                  <span>{unifiedData.away.score}</span>
                              </div>
                              <div className="text-[10px] font-bold text-slate-400 bg-white/10 px-3 py-1 rounded-full">{unifiedData.displayClock || unifiedData.status}</div>
                          </div>
                      )}
                  </div>

                  {/* Away Team */}
                  <div className="flex-1 flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-white rounded-2xl p-2 shadow-lg shadow-black/20">
                          {unifiedData.away.logo ? <img src={unifiedData.away.logo} className="w-full h-full object-contain"/> : <div className="w-full h-full bg-slate-200 rounded-xl"/>}
                      </div>
                      <span className="font-bold text-sm text-center leading-tight max-w-[100px]">{unifiedData.away.name}</span>
                  </div>
              </div>

              {/* 🟢 GOAL SCORERS (Fixed Alignment) */}
              {(isLive || isFinished) && unifiedData.goals.length > 0 && (
                  <div className="mt-6 border-t border-white/10 pt-4 grid grid-cols-2 gap-8 text-[10px] font-medium text-slate-300">
                      {/* Left: Home Goals */}
                      <div className="text-right space-y-1">
                          {unifiedData.goals.filter(g => g.team === 'home').map((g, i) => (
                              <div key={i} className="flex items-center justify-end gap-2">
                                  <span className="font-bold text-white">{g.player}</span>
                                  <GoalTime time={g.time} />
                              </div>
                          ))}
                      </div>
                      {/* Right: Away Goals */}
                      <div className="text-left space-y-1">
                          {unifiedData.goals.filter(g => g.team === 'away').map((g, i) => (
                              <div key={i} className="flex items-center justify-start gap-2">
                                  <GoalTime time={g.time} />
                                  <span className="font-bold text-white">{g.player}</span>
                              </div>
                          ))}
                      </div>
                  </div>
              )}
          </div>
      </div>

      {/* MEDIA BAR */}
      {(matchData.livestream_url || matchData.audio_url || matchData.video_url) && (
          <div className="bg-[#111] border-b border-white/10 p-3 flex gap-3 overflow-x-auto scrollbar-hide sticky top-[100px] z-40">
              {matchData.livestream_url && (
                  <a href={matchData.livestream_url} target="_blank" className="flex items-center gap-2 bg-red-600/20 text-red-500 px-4 py-2 rounded-full text-xs font-black uppercase whitespace-nowrap hover:bg-red-600 hover:text-white transition border border-red-600/30">
                      <Video size={14} className="animate-pulse"/> Watch Live
                  </a>
              )}
              {matchData.audio_url && (
                  <a href={matchData.audio_url} target="_blank" className="flex items-center gap-2 bg-blue-600/20 text-blue-500 px-4 py-2 rounded-full text-xs font-black uppercase whitespace-nowrap hover:bg-blue-600 hover:text-white transition border border-blue-600/30">
                      <Mic size={14}/> Listen Radio
                  </a>
              )}
              {matchData.video_url && (
                  <a href={matchData.video_url} target="_blank" className="flex items-center gap-2 bg-slate-800 text-slate-300 px-4 py-2 rounded-full text-xs font-black uppercase whitespace-nowrap hover:bg-white hover:text-black transition border border-slate-700">
                      <PlayCircle size={14}/> Highlights
                  </a>
              )}
          </div>
      )}

      {/* CONTENT GRID */}
      <div className="px-4 py-4 space-y-4">
          
          {/* BETTING CARD */}
          <div className="bg-[#1A1A1A] rounded-2xl p-4 shadow-xl border border-white/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 bg-blue-600 w-20 h-20 blur-[60px] opacity-20 group-hover:opacity-30 transition"></div>
              <div className="flex justify-between items-center relative z-10">
                   <div>
                       <div className="flex items-center gap-2 mb-1">
                          <div className="bg-blue-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded">1X</div>
                          <span className="text-white font-bold text-sm">1xBet Official</span>
                       </div>
                       <p className="text-blue-200 text-xs">Highest Odds Guaranteed</p>
                       <div className="mt-3 bg-white/5 border border-white/10 rounded-lg p-2 flex items-center justify-between max-w-[200px]">
                           <div className="text-[9px] text-slate-400 uppercase">Promo Code</div>
                           <div className="text-white font-black text-sm tracking-wider">FACTSPORT</div>
                       </div>
                   </div>
                   <a href={matchData.affiliate_link || DEFAULT_AFFILIATE_LINK} target="_blank" className="bg-blue-600 hover:bg-blue-500 text-white font-black uppercase px-6 py-3 rounded-xl shadow-lg shadow-blue-900/50 transition active:scale-95 text-xs flex items-center gap-1">
                       Bet <LinkIcon size={12} />
                   </a>
              </div>
          </div>

          <FreeTipsBanner />

          {/* 🟢 BEAUTIFUL LIVE FEED (Replaced messy Match Events) */}
          {(isLive || isFinished) && unifiedData.commentary.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="text-xs font-black uppercase text-slate-500 flex items-center gap-2">
                          <AlignLeft size={14} className="text-blue-500"/> Live Feed
                      </h3>
                      <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold animate-pulse">● Live</span>
                  </div>
                  <div className="divide-y divide-slate-50">
                      {unifiedData.commentary.map((comm: any) => (
                          <div key={comm.id} className="p-4 flex gap-3 hover:bg-slate-50 transition">
                              <div className="flex flex-col items-center gap-1 min-w-[30px]">
                                  {comm.time ? (
                                     <span className="text-[10px] font-mono font-bold text-slate-400">{comm.time}</span>
                                  ) : (
                                     <span className="text-[10px] text-slate-300">•</span>
                                  )}
                                  <div className="text-lg">{getEventIcon(comm.text, comm.type)}</div>
                              </div>
                              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                                  {comm.text}
                              </p>
                          </div>
                      ))}
                  </div>
              </div>
          )}

          {/* STATS */}
          {unifiedData.hasExternalData && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
                  <h3 className="text-xs font-black uppercase text-slate-400 mb-4 text-center">Match Stats</h3>
                  
                  <StatBar label="Possession" home={unifiedData.stats.possession.h} away={unifiedData.stats.possession.a} unit="%" />
                  <StatBar label="Shots on Target" home={unifiedData.stats.shots.h} away={unifiedData.stats.shots.a} />
                  <StatBar label="Corners" home={unifiedData.stats.corners.h} away={unifiedData.stats.corners.a} />
                  <StatBar label="Fouls" home={unifiedData.stats.fouls.h} away={unifiedData.stats.fouls.a} />
              </div>
          )}
      </div>
    </div>
  );
}

// Simple Stat Bar Component
function StatBar({ label, home, away, unit = '' }: any) {
    const total = home + away || 1;
    const homePct = (home / total) * 100;
    
    return (
        <div className="mb-4 last:mb-0">
            <div className="flex justify-between text-[10px] font-bold text-slate-600 mb-1">
                <span>{home}{unit}</span>
                <span className="uppercase text-slate-400">{label}</span>
                <span>{away}{unit}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
                <div className="bg-slate-800 h-full" style={{ width: `${homePct}%` }}></div>
                <div className="bg-red-500 h-full flex-1"></div>
            </div>
        </div>
    );
}

// Icon for Bet Button
function LinkIcon({ size }: { size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>
    )
}