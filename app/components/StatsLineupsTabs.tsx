'use client';
import { useState, useEffect, useRef } from 'react';
import { BarChart2, Users } from 'lucide-react';

export default function StatsLineupsTabs({ matchId, initialData }: { matchId: string, initialData: any }) {
  const [activeTab, setActiveTab] = useState<'stats' | 'lineups'>('stats');

  const [liveData, setLiveData] = useState({
      stats: initialData?.stats || { home: {}, away: {} },
      lineups: initialData?.lineups || { home: [], away: [], formations: { home: null, away: null } }
  });
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasFetchedLive = useRef(false);

  useEffect(() => {
      if (!hasFetchedLive.current) {
          setLiveData({
              stats: initialData?.stats || { home: {}, away: {} },
              lineups: initialData?.lineups || { home: [], away: [], formations: { home: null, away: null } }
          });
      }
  }, [initialData]);

  useEffect(() => {
    let isMounted = true;

    const fetchStatsData = async () => {
      if (document.visibilityState !== 'visible' || !isMounted) return;

      try {
          let res;
          if (initialData?.espn_id) {
              res = await fetch(`https://fse.mkpoikankes.workers.dev/?espn_id=${initialData.espn_id}&t=${Date.now()}`);
          } else {
              res = await fetch(`/api/match-data?id=${matchId}&t=${Date.now()}`);
          }
          
          if (!res.ok) return;
          const payload = await res.json();
          
          if (payload && !payload.error && isMounted) {
              hasFetchedLive.current = true;

              setLiveData(prev => ({
                  stats: payload.stats || prev.stats,
                  lineups: payload.lineups || prev.lineups
              }));

              if (['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED', 'ABD'].includes(payload.status)) {
                  if (intervalRef.current) clearInterval(intervalRef.current);
              }
          }
      } catch (error) {}
    };

    fetchStatsData();

    if (!['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED', 'ABD'].includes(initialData?.status)) {
        intervalRef.current = setInterval(fetchStatsData, 3000); 
    }

    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') fetchStatsData();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
        isMounted = false;
        if (intervalRef.current) clearInterval(intervalRef.current);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [matchId, initialData?.status, initialData?.espn_id]);

  const { stats, lineups } = liveData;
  const hasLineups = lineups?.home?.length > 0 || lineups?.away?.length > 0;

  const getSafeShots = (teamStats: any) => {
      if (!teamStats) return '0';
      if (teamStats.shots && parseInt(teamStats.shots) > 0) return teamStats.shots.toString();
      const onTarget = parseInt(teamStats.shotsOnTarget || teamStats.shots_on_target || 0) || 0;
      const offTarget = parseInt(teamStats.shotsOffTarget || teamStats.shots_off_target || 0) || 0;
      const total = onTarget + offTarget;
      return total > 0 ? total.toString() : '0';
  };

  const homeShotsOn = stats?.home?.shotsOnTarget || stats?.home?.shots_on_target || '0';
  const awayShotsOn = stats?.away?.shotsOnTarget || stats?.away?.shots_on_target || '0';
  const homeShotsOff = stats?.home?.shotsOffTarget || stats?.home?.shots_off_target || '0';
  const awayShotsOff = stats?.away?.shotsOffTarget || stats?.away?.shots_off_target || '0';
  
  const showTargetStats = parseInt(homeShotsOn) > 0 || parseInt(awayShotsOn) > 0 || parseInt(homeShotsOff) > 0 || parseInt(awayShotsOff) > 0;
  const hasStats = stats?.home?.possession || getSafeShots(stats?.home) !== '0' || stats?.home?.corners;

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
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden w-full flex flex-col">
      <div className="flex border-b border-slate-200 bg-slate-50">
        <button onClick={() => setActiveTab('stats')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-colors ${activeTab === 'stats' ? 'text-blue-600 bg-white border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-700'}`}>
            <BarChart2 size={14} /> Match Stats
        </button>
        <button onClick={() => setActiveTab('lineups')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-colors ${activeTab === 'lineups' ? 'text-blue-600 bg-white border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-700'}`}>
            <Users size={14} /> Starting XI
        </button>
      </div>

      <div className="p-4 min-h-[250px] bg-white">
        {activeTab === 'stats' && (
            <div className="space-y-4">
                {!hasStats ? <div className="text-center py-10 opacity-50"><p className="text-xs font-bold tracking-widest uppercase">Stats updating...</p></div> : <>
                    <StatRow label="Possession" home={stats?.home?.possession || '50%'} away={stats?.away?.possession || '50%'} />
                    <StatRow label="Total Shots" home={getSafeShots(stats?.home)} away={getSafeShots(stats?.away)} />
                    
                    {showTargetStats && (
                        <>
                            <StatRow label="Shots on Target" home={homeShotsOn} away={awayShotsOn} />
                            <StatRow label="Shots off Target" home={homeShotsOff} away={awayShotsOff} />
                        </>
                    )}

                    <StatRow label="Corners" home={stats?.home?.corners || '0'} away={stats?.away?.corners || '0'} />
                    <StatRow label="Fouls" home={stats?.home?.fouls || '0'} away={stats?.away?.fouls || '0'} />
                    <StatRow label="Saves" home={stats?.home?.saves || '0'} away={stats?.away?.saves || '0'} />
                </>}
            </div>
        )}
        
        {activeTab === 'lineups' && (
            <>
                {!hasLineups ? <div className="text-center py-10 opacity-50 bg-slate-50 rounded-xl border border-dashed border-slate-300"><Users className="mx-auto mb-2 text-slate-400" size={24} /><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Waiting for team sheets...</p></div> : 
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="bg-slate-100 py-1 px-2 rounded mb-2 text-center flex flex-col items-center">
                                <h4 className="text-[10px] font-black uppercase text-slate-500">Home</h4>
                                {lineups.formations?.home && <span className="text-[8px] font-bold text-blue-500 bg-white px-1 mt-0.5 rounded shadow-sm">{lineups.formations.home}</span>}
                            </div>
                            <ul className="space-y-1">
                                {homePlayers.map((p:any, i:number) => <li key={i} className={`text-xs flex items-center gap-2 py-1 border-b border-slate-50 ${!p.is_starter && i>10 ? 'opacity-50' : 'text-slate-800'}`}><span className="font-mono text-slate-400 w-5 text-right font-bold shrink-0">{p.number}</span> <span className={`${p.is_starter?'font-bold':''} truncate`}>{p.name}</span></li>)}
                            </ul>
                        </div>
                        <div>
                            <div className="bg-slate-100 py-1 px-2 rounded mb-2 text-center flex flex-col items-center">
                                <h4 className="text-[10px] font-black uppercase text-slate-500">Away</h4>
                                {lineups.formations?.away && <span className="text-[8px] font-bold text-red-500 bg-white px-1 mt-0.5 rounded shadow-sm">{lineups.formations.away}</span>}
                            </div>
                            <ul className="space-y-1">
                                {awayPlayers.map((p:any, i:number) => <li key={i} className={`text-xs flex items-center gap-2 justify-end py-1 border-b border-slate-50 ${!p.is_starter && i>10 ? 'opacity-50' : 'text-slate-800'}`}><span className={`${p.is_starter?'font-bold':''} truncate text-right`}>{p.name}</span> <span className="font-mono text-slate-400 w-5 text-left font-bold shrink-0">{p.number}</span></li>)}
                            </ul>
                        </div>
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