'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  AlignLeft, BarChart2, Users, Lock, Zap, Link as LinkIcon 
} from 'lucide-react';
import FreeTipsBanner from '@/app/components/FreeTipsBanner';

// Helper Icons
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

// Simple Stat Bar
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

export default function MatchDetailsClient({ matchData, unifiedData, affiliateLink }: any) {
  const [activeTab, setActiveTab] = useState('feed'); 
  const isScheduled = matchData.status === 'SCHEDULED';

  return (
    <div className="flex flex-col h-full">
      
      {/* 🟢 TOP SECTION: Prediction & Betting (Non-Scrolling or Sticky) */}
      <div className="px-4 py-4 space-y-4 flex-shrink-0">
          
          {/* 1. PREDICTION MODAL */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
             <h3 className="text-xs font-black uppercase text-blue-600 mb-3 flex items-center gap-1">
                <Zap size={14} /> Predict & Win Points
             </h3>
             
             {isScheduled ? (
                 <div className="text-center">
                     <p className="text-xs text-slate-500 mb-4">Predict the correct score to win points and climb the leaderboard!</p>
                     <Link href={`/match/${matchData.id}/predict`} className="block w-full bg-slate-900 text-white font-bold py-3 rounded-xl shadow-lg active:scale-95 transition">
                        Predict Now
                     </Link>
                 </div>
             ) : (
                 <div className="bg-slate-50 border border-slate-100 rounded-xl p-8 text-center">
                     <Lock size={24} className="mx-auto text-slate-300 mb-2" />
                     <h4 className="text-sm font-black text-slate-700 uppercase">Prediction Closed</h4>
                     <p className="text-[10px] text-slate-400">Match has started.</p>
                 </div>
             )}
          </div>

          {/* 2. BETTING PROMO (Immediately after Prediction) */}
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
                   <a href={affiliateLink} target="_blank" className="bg-blue-600 hover:bg-blue-500 text-white font-black uppercase px-6 py-3 rounded-xl shadow-lg shadow-blue-900/50 transition active:scale-95 text-xs flex items-center gap-1">
                       Bet <LinkIcon size={12} />
                   </a>
              </div>
          </div>

          {/* 3. TABS NAVIGATION */}
          {unifiedData.hasExternalData && (
              <div className="flex bg-white rounded-xl p-1 shadow-sm border border-slate-100">
                  <button onClick={() => setActiveTab('feed')} className={`flex-1 py-3 text-[10px] font-bold uppercase rounded-lg transition flex items-center justify-center gap-1 ${activeTab === 'feed' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}>
                      <AlignLeft size={14} /> Live Feed
                  </button>
                  <button onClick={() => setActiveTab('stats')} className={`flex-1 py-3 text-[10px] font-bold uppercase rounded-lg transition flex items-center justify-center gap-1 ${activeTab === 'stats' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}>
                      <BarChart2 size={14} /> Stats
                  </button>
                  <button onClick={() => setActiveTab('lineups')} className={`flex-1 py-3 text-[10px] font-bold uppercase rounded-lg transition flex items-center justify-center gap-1 ${activeTab === 'lineups' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}>
                      <Users size={14} /> Lineups
                  </button>
              </div>
          )}
      </div>

      {/* 🟢 BOTTOM SECTION: Scrolling Content (Tabs) */}
      <div className="flex-1 overflow-y-auto px-4 pb-10 space-y-4">
          
          {/* TAB: LIVE FEED */}
          {activeTab === 'feed' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden min-h-[200px]">
                {unifiedData.commentary.length > 0 ? (
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
                ) : (
                    <div className="text-center py-10 text-slate-400 text-xs">Waiting for live commentary...</div>
                )}
              </div>
          )}

          {/* TAB: STATS */}
          {activeTab === 'stats' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
                  <h3 className="text-xs font-black uppercase text-slate-400 mb-4 text-center">Match Stats</h3>
                  <StatBar label="Possession" home={unifiedData.stats.possession.h} away={unifiedData.stats.possession.a} unit="%" />
                  <StatBar label="Shots on Target" home={unifiedData.stats.shots.h} away={unifiedData.stats.shots.a} />
                  <StatBar label="Corners" home={unifiedData.stats.corners.h} away={unifiedData.stats.corners.a} />
                  <StatBar label="Fouls" home={unifiedData.stats.fouls.h} away={unifiedData.stats.fouls.a} />
              </div>
          )}

          {/* TAB: LINEUPS */}
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
          
          {/* FREE TIPS (At the Bottom) */}
          <div className="pt-4">
              <FreeTipsBanner />
          </div>
      </div>
    </div>
  );
}