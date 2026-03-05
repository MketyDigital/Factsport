'use client';
import { useState, useEffect, useRef } from 'react';
import { BarChart2, Users, List, AlertCircle } from 'lucide-react';

export default function StatsLineupsTabs({ matchId, initialData }: { matchId: string, initialData: any }) {
  const [activeTab, setActiveTab] = useState('events');

  const [liveData, setLiveData] = useState({
      stats: initialData?.stats || { home: {}, away: {} },
      lineups: initialData?.lineups || { home: [], away: [] },
      events: initialData?.goals || initialData?.match_events || [] 
  });
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchStatsData = async () => {
      if (document.visibilityState !== 'visible') return;

      try {
          const res = await fetch(`/api/match-data?id=${matchId}`);
          if (!res.ok) return;
          const payload = await res.json();
          
          if (payload && !payload.error) {
              setLiveData(prev => ({
                  stats: payload.stats || prev.stats,
                  lineups: payload.lineups || prev.lineups,
                  events: payload.match_events || payload.goals || prev.events
              }));

              if (['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED', 'ABD'].includes(payload.status)) {
                  if (intervalRef.current) clearInterval(intervalRef.current);
              }
          }
      } catch (error) {}
    };

    fetchStatsData();

    if (!['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED', 'ABD'].includes(initialData?.status)) {
        intervalRef.current = setInterval(fetchStatsData, 5000);
    }

    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') fetchStatsData();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [matchId, initialData?.status]);

  const { stats, lineups, events } = liveData;
  
  const hasLineups = lineups?.home?.length > 0 || lineups?.away?.length > 0;
  const hasStats = stats?.home?.possession || stats?.home?.shots;

  const getSortedLineup = (players: any[]) => {
      if (!players || !Array.isArray(players)) return [];
      const hasStarterInfo = players.some((p: any) => p.is_starter);
      if (hasStarterInfo) {
          return [...players].sort((a: any, b: any) => (a.is_starter === b.is_starter) ? 0 : a.is_starter ? -1 : 1);
      }
      return players;
  };
  
  const homePlayers = getSortedLineup(lineups?.home);
  const awayPlayers = getSortedLineup(lineups?.away);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex border-b border-slate-200">
        <button onClick={() => setActiveTab('events')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 ${activeTab === 'events' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-400 hover:bg-slate-50'}`}><List size={14} /> Events</button>
        <button onClick={() => setActiveTab('stats')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 ${activeTab === 'stats' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-400 hover:bg-slate-50'}`}><BarChart2 size={14} /> Stats</button>
        <button onClick={() => setActiveTab('lineups')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 ${activeTab === 'lineups' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-400 hover:bg-slate-50'}`}><Users size={14} /> Lineups</button>
      </div>

      <div className="p-4 min-h-[200px]">
        {activeTab === 'events' && (
             <div className="space-y-4">
                 {(!events || events.length === 0) ? <div className="text-center py-8 opacity-50"><AlertCircle className="mx-auto mb-2 text-slate-300" size={24} /><p className="text-xs font-bold text-slate-500">No match events yet.</p></div> : 
                     events.map((e: any, i: number) => (
                        <div key={i} className="flex gap-4 items-start animate-in fade-in slide-in-from-left-2">
                            <div className="w-10 text-right font-mono text-xs font-bold text-slate-400 pt-0.5">{e.time}</div>
                            <div className="flex-1 pb-4 border-b border-slate-50 last:border-0">
                                <p className="text-xs font-bold text-slate-800 flex items-start gap-2 leading-relaxed">
                                    <span className="shrink-0 mt-0.5">
                                        {e.type === 'goal' && '⚽'} 
                                        {e.type === 'card' && '🟨'} 
                                        {e.type === 'red-card' && '🟥'} 
                                        {e.type === 'sub' && '🔄'}
                                    </span>
                                    <span>{e.text}</span>
                                </p>
                            </div>
                        </div>
                     ))
                 }
             </div>
        )}
        
        {activeTab === 'stats' && (
            <div className="space-y-4">
                {!hasStats ? <div className="text-center py-10 opacity-50"><p className="text-xs">Stats updating...</p></div> : <>
                    <StatRow label="Possession" home={stats?.home?.possession || '50%'} away={stats?.away?.possession || '50%'} />
                    <StatRow label="Shots" home={stats?.home?.shots || '0'} away={stats?.away?.shots || '0'} />
                    <StatRow label="Corners" home={stats?.home?.corners || '0'} away={stats?.away?.corners || '0'} />
                    <StatRow label="Fouls" home={stats?.home?.fouls || '0'} away={stats?.away?.fouls || '0'} />
                    <StatRow label="Saves" home={stats?.home?.saves || '0'} away={stats?.away?.saves || '0'} />
                </>}
            </div>
        )}
        {activeTab === 'lineups' && (
            <>
                {!hasLineups ? <div className="text-center py-10 opacity-50 bg-slate-50 rounded-xl border border-dashed border-slate-300"><Users className="mx-auto mb-2 text-slate-400" size={24} /><p className="text-xs font-bold text-slate-500">Waiting for team sheets...</p></div> : 
                    <div className="grid grid-cols-2 gap-4">
                        <div><div className="bg-slate-100 py-1 px-2 rounded mb-2 text-center"><h4 className="text-[10px] font-black uppercase text-slate-500">Home</h4></div><ul className="space-y-1">{homePlayers.map((p:any, i:number) => <li key={i} className={`text-xs flex gap-2 py-1 border-b border-slate-50 ${!p.is_starter && i>10 ? 'opacity-50' : 'text-slate-800'}`}><span className="font-mono text-slate-400 w-5 text-right font-bold">{p.number}</span> <span className={p.is_starter?'font-bold':''}>{p.name}</span></li>)}</ul></div>
                        <div><div className="bg-slate-100 py-1 px-2 rounded mb-2 text-center"><h4 className="text-[10px] font-black uppercase text-slate-500">Away</h4></div><ul className="space-y-1">{awayPlayers.map((p:any, i:number) => <li key={i} className={`text-xs flex gap-2 py-1 border-b border-slate-50 ${!p.is_starter && i>10 ? 'opacity-50' : 'text-slate-800'}`}><span className="font-mono text-slate-400 w-5 text-right font-bold">{p.number}</span> <span className={p.is_starter?'font-bold':''}>{p.name}</span></li>)}</ul></div>
                    </div>
                }
            </>
        )}
      </div>
    </div>
  );
}

function StatRow({ label, home, away }: any) {
    const hVal = parseInt(home?.toString().replace(/\D/g,'')) || 0;
    const aVal = parseInt(away?.toString().replace(/\D/g,'')) || 0;
    const total = hVal + aVal || 1;
    const hWidth = (hVal / total) * 100;
    return (
        <div>
            <div className="flex justify-between text-[10px] font-bold text-slate-600 mb-1"><span>{home}</span><span className="text-slate-400 uppercase tracking-widest">{label}</span><span>{away}</span></div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex"><div style={{ width: `${hWidth}%` }} className="bg-blue-600 h-full"></div><div className="flex-1 bg-red-500 h-full"></div></div>
        </div>
    );
}