'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlignLeft, BarChart2, Users, Zap, Radio, PlayCircle, Lock, Link as LinkIcon, Mic } from 'lucide-react';
import FreeTipsBanner from '@/app/components/FreeTipsBanner';
import FactSportPlayer from '@/app/components/FactSportPlayer'; 

const getEventIcon = (text: string, type: string) => {
    const lower = (text + type).toLowerCase();
    if (lower.includes('goal')) return '⚽';
    if (lower.includes('corner')) return '⛳';
    if (lower.includes('foul')) return '🛑';
    if (lower.includes('card')) return '🟨';
    if (lower.includes('sub')) return '🔄';
    return '•';
};

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

export default function MatchDetailsClient({ matchData, unifiedData, activeVideoUrl, isLiveStream, affiliateLink }: any) {
  const [activeTab, setActiveTab] = useState('feed'); 
  const isScheduled = matchData.status === 'SCHEDULED';

  return (
    <div className="px-4 py-4 space-y-4">
      
      {/* 1. PREDICTION MODAL */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
         <h3 className="text-xs font-black uppercase text-blue-600 mb-3 flex items-center gap-1">
            <Zap size={14} /> Predict & Win Points
         </h3>
         {isScheduled ? (
             <div className="text-center">
                 <p className="text-xs text-slate-500 mb-4">Predict the correct score to win points!</p>
                 <Link href={`/match/${matchData.id}/predict`} className="block w-full bg-slate-900 text-white font-bold py-3 rounded-xl shadow-lg active:scale-95 transition">
                    Predict Now
                 </Link>
             </div>
         ) : (
             <div className="bg-slate-50 border border-slate-100 rounded-xl p-6 text-center">
                 <Lock size={20} className="mx-auto text-slate-300 mb-2" />
                 <h4 className="text-xs font-black text-slate-700 uppercase">Prediction Closed</h4>
                 <p className="text-[10px] text-slate-400">Match has started.</p>
             </div>
         )}
      </div>

      {/* 2. AUDIO / VIDEO PLAYER */}
      {/* Audio Status */}
      <div className="bg-[#0f172a] rounded-xl p-3 border border-slate-800 shadow-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${matchData.audio_url ? 'bg-red-600 animate-pulse' : 'bg-slate-800'}`}>
                  <Mic className="text-white" size={20} />
              </div>
              <div>
                  <h3 className="text-white font-bold text-xs">Live Audio Commentary</h3>
                  <p className="text-slate-400 text-[10px]">{matchData.audio_url ? "Radio is currently LIVE" : "Tune in when match starts"}</p>
              </div>
          </div>
          {!matchData.audio_url && <span className="bg-slate-700 text-slate-400 text-[10px] font-bold px-3 py-1.5 rounded-full border border-white/5">OFF AIR</span>}
      </div>

      {/* Video Player */}
      {activeVideoUrl && (
        <div className="rounded-xl overflow-hidden shadow-xl border border-white/20 relative bg-black aspect-video">
            <div className="absolute top-3 left-3 z-30 pointer-events-none">
                {isLiveStream ? (
                    <div className="bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded flex items-center gap-1 animate-pulse shadow-md">
                        <Radio size={10} /> LIVE WATCHALONG
                    </div>
                ) : (
                    <div className="bg-black/60 backdrop-blur text-white text-[9px] font-bold px-2 py-0.5 rounded border border-white/10 flex items-center gap-1">
                        <PlayCircle size={10} /> HIGHLIGHTS
                    </div>
                )}
            </div>
            <FactSportPlayer videoUrl={activeVideoUrl} />
        </div>
      )}

      {/* 3. BETTING PROMO (Smaller) */}
      <div className="bg-[#1A1A1A] rounded-xl p-3 shadow-lg border border-white/5 flex items-center justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-blue-600 w-16 h-full blur-[40px] opacity-20"></div>
          <div className="flex items-center gap-3 relative z-10">
               <div className="bg-blue-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded">1X</div>
               <div>
                   <div className="text-white font-bold text-xs">1xBet Official</div>
                   <div className="text-[9px] text-slate-400">Code: <span className="text-white font-bold">FACTSPORT</span></div>
               </div>
          </div>
          <a href={affiliateLink} target="_blank" className="bg-blue-600 hover:bg-blue-500 text-white font-black uppercase px-4 py-2 rounded-lg shadow-lg text-[10px] flex items-center gap-1">
              Bet <LinkIcon size={10} />
          </a>
      </div>

      {/* 4. TABS NAVIGATION */}
      {unifiedData.hasExternalData && (
          <div className="flex bg-white rounded-xl p-1 shadow-sm border border-slate-100">
              <button onClick={() => setActiveTab('feed')} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition flex items-center justify-center gap-1 ${activeTab === 'feed' ? 'bg-blue-50 text-blue-600' : 'text-slate-400'}`}>
                  <AlignLeft size={12} /> Live Feed
              </button>
              <button onClick={() => setActiveTab('stats')} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition flex items-center justify-center gap-1 ${activeTab === 'stats' ? 'bg-blue-50 text-blue-600' : 'text-slate-400'}`}>
                  <BarChart2 size={12} /> Stats
              </button>
              <button onClick={() => setActiveTab('lineups')} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition flex items-center justify-center gap-1 ${activeTab === 'lineups' ? 'bg-blue-50 text-blue-600' : 'text-slate-400'}`}>
                  <Users size={12} /> Lineups
              </button>
          </div>
      )}

      {/* 5. TAB CONTENT */}
      {activeTab === 'feed' && (
          // 🟢 Live Feed has internal scroll, but page scrolls naturally too
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {unifiedData.commentary.length > 0 ? (
                <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto">
                    {unifiedData.commentary.map((comm: any) => (
                        <div key={comm.id || Math.random()} className="p-4 flex gap-3 hover:bg-slate-50 transition">
                            <div className="flex flex-col items-center gap-1 min-w-[30px]">
                                <span className="text-[10px] font-mono font-bold text-slate-400">{comm.time ? comm.time + "'" : "•"}</span>
                                <div className="text-lg">{getEventIcon(comm.text, comm.type)}</div>
                            </div>
                            <p className="text-xs text-slate-700 leading-relaxed font-medium">{comm.text}</p>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-10 text-slate-400 text-xs">Waiting for live commentary...</div>
            )}
          </div>
      )}

      {activeTab === 'stats' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
              <StatBar label="Possession" home={unifiedData.stats.possession.h} away={unifiedData.stats.possession.a} unit="%" />
              <StatBar label="Shots" home={unifiedData.stats.shots.h} away={unifiedData.stats.shots.a} />
              <StatBar label="Corners" home={unifiedData.stats.corners.h} away={unifiedData.stats.corners.a} />
              <StatBar label="Fouls" home={unifiedData.stats.fouls.h} away={unifiedData.stats.fouls.a} />
          </div>
      )}

      {activeTab === 'lineups' && (
          <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3">
                   <h4 className="text-[10px] font-black uppercase text-slate-400 mb-2 border-b border-slate-100 pb-1">{unifiedData.home.name}</h4>
                   <ul className="space-y-1.5">
                       {unifiedData.lineups.home.length > 0 ? unifiedData.lineups.home.map((p: any, i:number) => (
                           <li key={i} className="text-xs font-bold text-slate-700 flex items-center gap-2">
                               <span className="text-[9px] text-slate-400 w-4 font-mono text-center">{p.jersey}</span> 
                               <span className="truncate">{p.athlete.displayName}</span>
                           </li>
                       )) : <li className="text-[10px] text-slate-400">Not available</li>}
                   </ul>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3">
                   <h4 className="text-[10px] font-black uppercase text-slate-400 mb-2 border-b border-slate-100 pb-1">{unifiedData.away.name}</h4>
                   <ul className="space-y-1.5">
                       {unifiedData.lineups.away.length > 0 ? unifiedData.lineups.away.map((p: any, i:number) => (
                           <li key={i} className="text-xs font-bold text-slate-700 flex items-center gap-2">
                               <span className="text-[9px] text-slate-400 w-4 font-mono text-center">{p.jersey}</span>
                               <span className="truncate">{p.athlete.displayName}</span>
                           </li>
                       )) : <li className="text-[10px] text-slate-400">Not available</li>}
                   </ul>
              </div>
          </div>
      )}

      {/* 6. FREE TIPS (Bottom) */}
      <FreeTipsBanner />
    </div>
  );
}