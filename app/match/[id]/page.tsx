export const runtime = 'edge';

import { createClient } from '@/app/lib/supabase/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Share2, Video, Mic, PlayCircle } from 'lucide-react';
import MatchDetailsClient from '@/app/components/MatchDetailsClient';
import MatchHeaderClient from '@/app/components/MatchHeaderClient';
import { getExternalData } from '@/app/lib/matchService';

const DEFAULT_AFFILIATE_LINK = "https://refpa58144.com/L?tag=d_1181253m_1599c_&site=1181253&ad=1599";

export default async function MatchDetailsPage({ params }: { params: { id: string } }) {
  const resolvedParams = await params;
  if (!resolvedParams?.id) return notFound();

  const supabase = createClient();
  const { data: matchData } = await supabase.from('matches').select('*').eq('id', resolvedParams.id).single();
  if (!matchData) return notFound();

  const unifiedData = await getExternalData(matchData);

  // Video Logic
  const activeVideoUrl = matchData.livestream_url || matchData.video_url;
  const isLiveStream = !!matchData.livestream_url;

  return (
    // 🟢 LAYOUT: "min-h-screen" allows natural scrolling (No h-screen lock)
    <div className="min-h-screen bg-[#F0F2F5] font-sans text-slate-900 pb-10">
      
      {/* 1. STICKY HEADER (Scoreboard stays at top) */}
      <div className="bg-[#0a1428] text-white shadow-lg sticky top-0 z-50">
          <div className="p-4 flex items-center justify-between">
              <Link href="/" className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition backdrop-blur-md"><ChevronLeft size={20}/></Link>
              <h1 className="text-xs font-bold text-slate-400 uppercase tracking-widest">{matchData.league}</h1>
              <button className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition backdrop-blur-md"><Share2 size={20}/></button>
          </div>

          <MatchHeaderClient 
              matchId={matchData.id} 
              initialData={matchData} 
              initialGoals={unifiedData.goals} 
          />
          <div className="h-4"></div>
      </div>

      {/* 2. MEDIA BAR (Scrolls with page) */}
      {(matchData.livestream_url || matchData.audio_url || matchData.video_url) && (
          <div className="bg-[#111] border-b border-white/10 p-3 flex gap-3 overflow-x-auto scrollbar-hide z-40">
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

      {/* 3. SCROLLABLE BODY */}
      <MatchDetailsClient 
          matchData={matchData} 
          unifiedData={unifiedData} 
          activeVideoUrl={activeVideoUrl} 
          isLiveStream={isLiveStream}
          affiliateLink={matchData.affiliate_link || DEFAULT_AFFILIATE_LINK} 
      />
    </div>
  );
}