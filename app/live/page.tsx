export const runtime = 'edge';
export const dynamic = 'force-dynamic'; 
export const fetchCache = 'force-no-store'; 

import { createClient } from '@supabase/supabase-js'; 
import Link from 'next/link';
import { Metadata } from 'next';
import { ChevronLeft, Radio, MessageCircle, Trophy } from 'lucide-react';
import AdsterraStandardBanner from '@/app/components/AdsterraStandardBanner';
import FactSportMediaRoom from '@/app/components/FactSportMediaRoom'; 
import FanZoneChat from '@/app/components/FanZoneChat'; 
import LiveMediaClient from '@/app/components/LiveMediaClient'; 

export const metadata: Metadata = {
    title: 'Live Football Scores, Video & Audio Broadcasts | FactSport',
    description: 'Follow live football matches with real-time scores, live audio commentary, and video broadcasts. Don\'t miss a minute of the action.',
};

export default async function LiveMediaPage() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  const now = Date.now();
  const lookBack = new Date(now - (24 * 60 * 60 * 1000)).toISOString(); 
  const lookForward = new Date(now + (48 * 60 * 60 * 1000)).toISOString(); 

  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .not('status', 'in', '("FT","FINISHED","AET","PEN","AWARDED","ABD")')
    .gt('match_date', lookBack)
    .lt('match_date', lookForward)
    .order('match_date', { ascending: true });

  const { data: studioData } = await supabase.from('global_studio').select('*').eq('id', 1).single();

  const isStudioActive = studioData?.is_active === true || studioData?.is_active === 'true';
  const globalMediaUrl = studioData?.video_url || studioData?.audio_url || null;
  const studioTitle = studioData?.title || "Goal Rush Studio";

  return (
    <div className="min-h-screen bg-[#0a1428] pb-20 font-sans text-white selection:bg-red-500">
      
      {/* HEADER */}
      <div className="bg-[#0f1c3a] border-b border-white/10 text-white p-4 sticky top-0 z-50 shadow-2xl flex items-center justify-between backdrop-blur-lg">
          <div className="flex items-center gap-4">
              <Link href="/" className="p-1.5 bg-white/5 rounded-full hover:bg-white/10 transition border border-white/5"><ChevronLeft size={20} /></Link>
              <div>
                <h1 className="font-black text-lg leading-none italic uppercase flex items-center gap-2 tracking-tight">
                    <Radio className="text-red-500 animate-pulse"/> Live Center
                </h1>
                <p className="text-[10px] text-slate-400 font-bold tracking-widest mt-0.5">VIDEO|AUDIO COVERAGE & LIVE SCORES</p>
              </div>
          </div>
          <Link href="/tournaments" className="hidden sm:flex items-center gap-1 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 px-3 py-1.5 rounded-lg border border-yellow-500/30 transition-colors">
              <Trophy size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">Tournament Hub</span>
          </Link>
      </div>

      <div className="p-4 space-y-8 max-w-7xl mx-auto mt-4">
        <AdsterraStandardBanner />

        {isStudioActive && globalMediaUrl && (
            <div className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="lg:col-span-2 flex flex-col h-full">
                    <FactSportMediaRoom matchId="global-goal-rush" mediaUrl={globalMediaUrl} title={studioTitle} />
                </div>
                <div className="lg:col-span-1 bg-[#0f1c3a] rounded-2xl overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-slate-700 flex flex-col h-full max-h-[600px] lg:max-h-none">
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

        <LiveMediaClient matches={matches || []} />

      </div>
    </div>
  );
}