'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { BarChart2, Users } from 'lucide-react';
import PitchLineup from './PitchLineup';
import MatchTimeline from './MatchTimeline';
import PlayerRatingsWidget from './PlayerRatingsWidget';

const getSafeEvents = (dataEvs: any, initialEvs: any, dbEvs: any) => {
    let raw = dataEvs || initialEvs || dbEvs || [];
    if (typeof raw === 'string') {
        try { raw = JSON.parse(raw); } catch(e) { raw = []; }
    }
    return Array.isArray(raw) ? raw : [];
};

export default function StatsLineupsTabs({ matchId, initialData, dbData }: { matchId: string, initialData: any, dbData?: any }) {
  const [activeTab, setActiveTab] = useState<'stats' | 'lineups'>('stats');

  const [liveData, setLiveData] = useState({
      stats: initialData?.stats || { home: {}, away: {} },
      lineups: initialData?.lineups || { home: [], away: [], formations: { home: null, away: null } },
      rawEvents: initialData?.events || initialData?.match_events || dbData?.match_events || []
  });
  
  const hasFetchedLive = useRef(false);
  const isFetching = useRef(false);

  useEffect(() => {
      if (!hasFetchedLive.current) {
          setLiveData({
              stats: initialData?.stats || { home: {}, away: {} },
              lineups: initialData?.lineups || { home: [], away: [], formations: { home: null, away: null } },
              rawEvents: initialData?.events || initialData?.match_events || dbData?.match_events || []
          });
      }
  }, [initialData, dbData]);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const isFinishedInitially = ['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED', 'ABD'].includes(initialData?.status);
    if (isFinishedInitially || !initialData?.espn_id) return;

    const fetchStatsData = async () => {
      if (!isMounted) return; 

      let matchFinished = false;

      // 🟢 HEARTBEAT FIX: Bypasses fetching when hidden, but keeps scheduling the next loop!
      if (document.visibilityState === 'visible' && !isFetching.current) {
          isFetching.current = true;
          try {
              let res = await fetch(`https://fse.mkpoikankes.workers.dev/?espn_id=${initialData.espn_id}&t=${Date.now()}`);
              
              if (res.ok) {
                  const payload = await res.json();
                  if (payload && !payload.error && isMounted) {
                      hasFetchedLive.current = true;
                      
                      setLiveData(prev => {
                          const oldHomePoss = prev.stats?.home?.possession;
                          const newHomePoss = payload.stats?.home?.possession;
                          const oldEventsLen = (prev.rawEvents || []).length;
                          const newEventsLen = (payload.events || payload.match_events || []).length;
                          const oldStatus = prev.stats?.status;
                          const newStatus = payload.stats?.status;

                          const oldLineupsStr = JSON.stringify(prev.lineups || {});
                          const newLineupsStr = JSON.stringify(payload.lineups || {});
                          const lineupsChanged = oldLineupsStr !== newLineupsStr;

                          if (oldHomePoss === newHomePoss && oldEventsLen === newEventsLen && oldStatus === newStatus && !lineupsChanged) {
                              return prev; 
                          }

                          return {
                              stats: payload.stats || prev.stats,
                              lineups: lineupsChanged ? payload.lineups : prev.lineups, 
                              rawEvents: payload.events || payload.match_events || prev.rawEvents 
                          };
                      });

                      if (['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED', 'ABD'].includes(payload.status)) {
                          matchFinished = true; // Match is over, we can finally stop polling.
                      }
                  }
              }
          } catch (error) {
          } finally {
              isFetching.current = false;
          }
      }
      
      // 🟢 THE HEARTBEAT: Re-fires every 8 seconds until the game is FT.
      if (isMounted && !matchFinished) {
          timeoutId = setTimeout(fetchStatsData, 8000); 
      }
    };

    fetchStatsData();

    return () => {
        isMounted = false;
        clearTimeout(timeoutId);
    };
  }, [initialData?.status, initialData?.espn_id]);

  const { stats, lineups, rawEvents } = liveData;
  const events = useMemo(() => getSafeEvents(rawEvents, null, null), [rawEvents]);

  const getSafeShots = (teamStats: any) => {
      if (!teamStats) return '0';
      if (teamStats.shots && parseInt(teamStats.shots) > 0) return teamStats.shots.toString();
      const onTarget = parseInt(teamStats.shotsOnTarget || teamStats.shots_on_target || 0) || 0;
      const offTarget = parseInt(teamStats.shotsOffTarget || teamStats.shots_off_target || 0) || 0;
      return (onTarget + offTarget) > 0 ? (onTarget + offTarget).toString() : '0';
  };

  const homeShotsOn = stats?.home?.shotsOnTarget || stats?.home?.shots_on_target || '0';
  const awayShotsOn = stats?.away?.shotsOnTarget || stats?.away?.shots_on_target || '0';
  const showTargetStats = parseInt(homeShotsOn) > 0 || parseInt(awayShotsOn) > 0;
  const hasStats = stats?.home?.possession || getSafeShots(stats?.home) !== '0' || stats?.home?.corners;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden w-full flex flex-col mt-4">
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
                    {showTargetStats && <StatRow label="Shots on Target" home={homeShotsOn} away={awayShotsOn} />}
                    <StatRow label="Corners" home={stats?.home?.corners || '0'} away={stats?.away?.corners || '0'} />
                    <StatRow label="Fouls" home={stats?.home?.fouls || '0'} away={stats?.away?.fouls || '0'} />
                    <StatRow label="Saves" home={stats?.home?.saves || '0'} away={stats?.away?.saves || '0'} />
                </>}
                <MatchTimeline events={events} />
            </div>
        )}
        {activeTab === 'lineups' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 -m-4">
                <PitchLineup data={{ lineups: liveData.lineups }} dbData={dbData} />
                <div className="p-4 bg-white border-t border-slate-100">
                    <PlayerRatingsWidget matchId={matchId} lineups={liveData.lineups} status={liveData.stats?.status || initialData?.status} />
                </div>
            </div>
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
        <div className="py-1">
            <div className="flex justify-between text-[9px] font-bold text-slate-600 mb-0.5 uppercase tracking-tight">
                <span>{home}</span>
                <span className="text-slate-400 font-medium">{label}</span>
                <span>{away}</span>
            </div>
            <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden flex">
                <div style={{ width: `${hWidth}%` }} className="bg-blue-600 h-full"></div>
                <div className="flex-1 bg-red-500 h-full"></div>
            </div>
        </div>
    );
}