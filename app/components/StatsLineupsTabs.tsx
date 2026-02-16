'use client';
import { useState } from 'react';
import { BarChart2, Users, List } from 'lucide-react';

export default function StatsLineupsTabs({ data }: { data: any }) {
  const [activeTab, setActiveTab] = useState('lineups'); // 🟢 Default to Lineups to check immediately

  const stats = data.stats || { home: {}, away: {} };
  const lineups = data.lineups || { home: [], away: [] };
  const events = data.match_events || [];

  const hasLineups = lineups.home?.length > 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      
      {/* TABS HEADER */}
      <div className="flex border-b border-slate-200">
        <button onClick={() => setActiveTab('events')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 ${activeTab === 'events' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-400 hover:bg-slate-50'}`}>
            <List size={14} /> Events
        </button>
        <button onClick={() => setActiveTab('stats')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 ${activeTab === 'stats' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-400 hover:bg-slate-50'}`}>
            <BarChart2 size={14} /> Stats
        </button>
        {/* 🟢 ALWAYS ENABLED: So you can click and see status */}
        <button onClick={() => setActiveTab('lineups')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 ${activeTab === 'lineups' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-400 hover:bg-slate-50'}`}>
            <Users size={14} /> Lineups
        </button>
      </div>

      {/* CONTENT AREA */}
      <div className="p-4 min-h-[200px]">
        
        {/* 1. EVENTS TAB */}
        {activeTab === 'events' && (
             <div className="space-y-4">
                 {events.length === 0 ? (
                     <div className="text-center py-10 opacity-50">
                        <p className="text-xs font-bold text-slate-500">Match hasn't started or no events yet.</p>
                     </div>
                 ) : (
                     events.map((e: any, i: number) => (
                        <div key={i} className="flex gap-4 items-start">
                            <div className="w-10 text-right font-mono text-xs font-bold text-slate-400 pt-0.5">{e.time}</div>
                            <div className="flex-1 pb-4 border-b border-slate-50 last:border-0">
                                <p className="text-xs font-bold text-slate-800">{e.text}</p>
                                <p className="text-[10px] text-slate-500">{e.player}</p>
                            </div>
                        </div>
                     ))
                 )}
             </div>
        )}

        {/* 2. STATS TAB */}
        {activeTab === 'stats' && (
            <div className="space-y-4">
                <StatRow label="Possession" home={stats.home?.possession || '50%'} away={stats.away?.possession || '50%'} />
                <StatRow label="Shots" home={stats.home?.shots || '0'} away={stats.away?.shots || '0'} />
                <StatRow label="Corners" home={stats.home?.corners || '0'} away={stats.away?.corners || '0'} />
                <StatRow label="Fouls" home={stats.home?.fouls || '0'} away={stats.away?.fouls || '0'} />
                <StatRow label="Saves" home={stats.home?.saves || '0'} away={stats.away?.saves || '0'} />
            </div>
        )}

        {/* 3. LINEUPS TAB */}
        {activeTab === 'lineups' && (
            <>
                {!hasLineups ? (
                    <div className="text-center py-10 opacity-50 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                        <Users className="mx-auto mb-2 text-slate-400" size={24} />
                        <p className="text-xs font-bold text-slate-500">Lineups available 60m before kickoff.</p>
                        <p className="text-[10px] text-slate-400">Waiting for official team sheet...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <h4 className="text-[10px] font-black uppercase text-slate-400 mb-3 text-center">Home</h4>
                            <ul className="space-y-2">
                                {lineups.home?.filter((p:any)=>p.is_starter).map((p:any, i:number) => (
                                    <li key={i} className="text-xs text-slate-700 flex gap-2">
                                        <span className="font-mono text-slate-400 w-4 text-right">{p.number}</span> {p.name}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-[10px] font-black uppercase text-slate-400 mb-3 text-center">Away</h4>
                            <ul className="space-y-2">
                                {lineups.away?.filter((p:any)=>p.is_starter).map((p:any, i:number) => (
                                    <li key={i} className="text-xs text-slate-700 flex gap-2">
                                        <span className="font-mono text-slate-400 w-4 text-right">{p.number}</span> {p.name}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
            </>
        )}

      </div>
    </div>
  );
}

function StatRow({ label, home, away }: any) {
    const hVal = parseInt(home.toString().replace(/\D/g,'')) || 0;
    const aVal = parseInt(away.toString().replace(/\D/g,'')) || 0;
    const total = hVal + aVal || 1;
    const hWidth = (hVal / total) * 100;

    return (
        <div>
            <div className="flex justify-between text-[10px] font-bold text-slate-600 mb-1">
                <span>{home}</span>
                <span className="text-slate-400 uppercase tracking-widest">{label}</span>
                <span>{away}</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                <div style={{ width: `${hWidth}%` }} className="bg-blue-600 h-full"></div>
                <div className="flex-1 bg-red-500 h-full"></div>
            </div>
        </div>
    );
}