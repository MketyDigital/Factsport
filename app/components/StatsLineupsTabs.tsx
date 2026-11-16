'use client';
import { useState } from 'react';
import { BarChart2, Users } from 'lucide-react';
import PitchLineup from './PitchLineup';
import VisualStatCompare from './VisualStatCompare';
import MatchTimeline from './MatchTimeline';
import PlayerRatingsWidget from './PlayerRatingsWidget';
import { useMatchLive } from '@/app/providers/MatchLiveProvider';

export default function StatsLineupsTabs({ matchId, dbData }: { matchId: string, dbData?: any }) {
  const [activeTab, setActiveTab] = useState<'stats' | 'lineups'>('stats');

  const liveData = useMatchLive();

  const stats = liveData?.stats || { home: {}, away: {} };
  const lineups = liveData?.lineups || { home: [], away: [], formations: { home: null, away: null } };
  const events = liveData?.match_events || liveData?.events || [];

  const getSafeShots = (teamStats: any): number | null => {
    if (!teamStats) return null;
    const direct = teamStats.shots;
    if (direct !== null && direct !== undefined && /^\d+$/.test(String(direct).trim())) {
      return Number(direct);
    }
    const on = teamStats.shotsOnTarget ?? teamStats.shots_on_target;
    const off = teamStats.shotsOffTarget ?? teamStats.shots_off_target;
    if (on === null || on === undefined || off === null || off === undefined) return null;
    if (!/^\d+$/.test(String(on).trim()) || !/^\d+$/.test(String(off).trim())) return null;
    return Number(on) + Number(off);
  };

  const homeShotsOn = stats?.home?.shotsOnTarget ?? stats?.home?.shots_on_target;
  const awayShotsOn = stats?.away?.shotsOnTarget ?? stats?.away?.shots_on_target;
  const showTargetStats = homeShotsOn != null || awayShotsOn != null;
  const hasStats = [stats?.home?.possession, stats?.away?.possession,
    stats?.home?.corners, stats?.away?.corners,
    getSafeShots(stats?.home), getSafeShots(stats?.away)].some(value => value !== null && value !== undefined);
  const homeTeam = dbData?.home_team || 'Home';
  const awayTeam = dbData?.away_team || 'Away';
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {!hasStats ? <div className="text-center py-10 opacity-50"><p className="text-xs font-bold tracking-widest uppercase">Stats updating...</p></div> : <>
                    <VisualStatCompare label="Possession" home={stats?.home?.possession} away={stats?.away?.possession} homeTeam={homeTeam} awayTeam={awayTeam} />
                    <VisualStatCompare label="Total Shots" home={getSafeShots(stats?.home)} away={getSafeShots(stats?.away)} homeTeam={homeTeam} awayTeam={awayTeam} />
                    {showTargetStats && <VisualStatCompare label="Shots on Target" home={homeShotsOn} away={awayShotsOn} homeTeam={homeTeam} awayTeam={awayTeam} />}
                    <VisualStatCompare label="Corners" home={stats?.home?.corners} away={stats?.away?.corners} homeTeam={homeTeam} awayTeam={awayTeam} />
                    <VisualStatCompare label="Fouls" home={stats?.home?.fouls} away={stats?.away?.fouls} homeTeam={homeTeam} awayTeam={awayTeam} />
                    <VisualStatCompare label="Saves" home={stats?.home?.saves} away={stats?.away?.saves} homeTeam={homeTeam} awayTeam={awayTeam} />
                </>}
                <div className="col-span-full"><MatchTimeline events={events} /></div>
            </div>
        )}
        {activeTab === 'lineups' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 -m-4">
                <PitchLineup data={{ lineups: lineups }} dbData={dbData} />
                <div className="p-4 bg-white border-t border-slate-100">
                    <PlayerRatingsWidget matchId={matchId} lineups={lineups} status={liveData?.status} />
                </div>
            </div>
        )}
      </div>
    </div>
  );
}

