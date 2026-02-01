export const runtime = 'edge';

import { createClient } from '@/app/lib/supabase/server';
import Link from 'next/link';
import { ChevronLeft, Share2, Video, Mic, PlayCircle } from 'lucide-react';
import { getExternalData } from '@/app/lib/matchService';
import MatchDetailsClient from '@/app/components/MatchDetailsClient';
import MatchHeaderClient from '@/app/components/MatchHeaderClient';

// 🟢 CONFIG
const DEFAULT_AFFILIATE_LINK = "https://refpa58144.com/L?tag=d_1181253m_1599c_&site=1181253&ad=1599";

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

  const isLive = unifiedData.status === 'LIVE' || unifiedData.status === 'in';

  return (
    <div className="min-h-screen bg-[#F0F2F5] pb-20 font-sans text-slate-900">
      
      {/* HEADER & SCOREBOARD (Realtime) */}
      <div className="bg-[#0a1428] text-white sticky top-0 z-50 shadow-lg">
          <div className="p-4 flex items-center justify-between">
              <Link href="/" className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition backdrop-blur-md"><ChevronLeft size={20}/></Link>
              <div className="text-center">
                 <h1 className="text-xs font-bold text-slate-400 uppercase tracking-widest">{matchData.league}</h1>
                 {isLive && <span className="text-[10px] font-black text-red-500 animate-pulse bg-red-500/10 px-2 py-0.5 rounded mt-1 inline-block">LIVE NOW</span>}
              </div>
              <button className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition backdrop-blur-md"><Share2 size={20}/></button>
          </div>

          {/* 🟢 REALTIME HEADER CLIENT (Handles Score, Timer, Scorer Alignment) */}
          <MatchHeaderClient 
              matchId={matchId} 
              initialData={matchData} 
              initialGoals={unifiedData.goals} 
          />
          <div className="h-4"></div>
      </div>

      {/* MEDIA BAR (Live Stream / Radio / Highlights) */}
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

      {/* CLIENT INTERACTIVE SECTION (Tabs, Prediction, Stats, Betting) */}
      <MatchDetailsClient 
          matchData={matchData} 
          unifiedData={unifiedData} 
          affiliateLink={matchData.affiliate_link || DEFAULT_AFFILIATE_LINK} 
      />
    </div>
  );
}