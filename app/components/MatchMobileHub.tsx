// app/components/MatchMobileHub.tsx

'use client';

import { useState, useEffect } from 'react';
import { MessageCircle, BarChart2, Zap, BrainCircuit, Table, Trophy, AlertTriangle } from 'lucide-react';
import FanZoneChat from '@/app/components/FanZoneChat';
import StatsLineupsTabs from '@/app/components/StatsLineupsTabs';
import ProBettingSlipLock from '@/app/components/ProBettingSlipLock';
import AdsterraStandardBanner from '@/app/components/AdsterraStandardBanner';
import LiveStandings from '@/app/components/LiveStandings';
import WinProbability from '@/app/components/WinProbability';
import MOTMVoteWidget from '@/app/components/MOTMVoteWidget';
import GroupStageTable from '@/app/components/GroupStageTable';
import { useMatchLive } from '@/app/providers/MatchLiveProvider';

const getMatchContextText = (data: any) => {
  if (!data) return '';

  const matchType = String(data.match_type || '').toUpperCase();
  const stage = String(data.stage || '').toLowerCase();
  const group = data.match_group || data.group || '';
  const homeWins = Number(data.home_score) > Number(data.away_score);
  const awayWins = Number(data.away_score) > Number(data.home_score);
  const winner = homeWins ? data.home_team : awayWins ? data.away_team : '';

  if (matchType === 'FINAL' || stage.includes('final')) {
    return winner ? `${winner} wins the cup.` : 'Cup final decided.';
  }

  if (matchType === 'SEMI_FINAL' || stage.includes('semi')) {
    return winner ? `${winner} advances to the final.` : 'Semi-final winner advances.';
  }

  if (matchType === 'QUARTER_FINAL' || stage.includes('quarter')) {
    return winner ? `${winner} advances to the semi-finals.` : 'Quarter-final winner advances.';
  }

  if (matchType === 'KNOCKOUT_ROUND' || stage.includes('knockout')) {
    return winner ? `${winner} advances to the next round.` : 'Knockout winner advances.';
  }

  if (matchType === 'GROUP_STAGE' || stage.includes('group')) {
    return group ? `Group ${group} standings update.` : 'Group-stage standings update.';
  }

  return '';
};

export default function MatchMobileHub({ matchId, espnId, dbData }: any) {
  const [activeTab, setActiveTab] = useState<'chat' | 'stats' | 'pro' | 'table'>('chat');
  const liveData = useMatchLive();

  const currentStatus = (liveData?.status || '').toUpperCase();
  const isFinished = ['FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD'].includes(currentStatus);

  const matchDateMs = new Date(dbData.match_date).getTime();
  const minutesToKick = (matchDateMs - Date.now()) / 60000;
  const isUniversallyFinished = isFinished || minutesToKick < -240;

  useEffect(() => {
    if (isUniversallyFinished && (activeTab === 'table' || activeTab === 'pro')) {
      setActiveTab('stats');
    }
  }, [isUniversallyFinished, activeTab]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const y = element.getBoundingClientRect().top + window.scrollY - 60;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const matchContextText = getMatchContextText(liveData);

  return (
    <div className="w-full flex flex-col bg-white shadow-md md:rounded-2xl overflow-hidden mb-4 border border-slate-200">
      <WinProbability predictor={liveData?.predictor} homeTeam={dbData.home_team} awayTeam={dbData.away_team} />

      {matchContextText && (
        <div className="bg-blue-50 border-b border-blue-100 px-3 py-2 text-[10px] md:text-xs font-black text-blue-700 flex items-center gap-2">
          <Trophy size={12} className="text-blue-600 shrink-0" />
          {matchContextText}
        </div>
      )}

      {liveData?.group_summary?.length > 0 && (
        <div className="p-2 md:p-3 border-b border-slate-200">
          <GroupStageTable groups={liveData.group_summary} />
        </div>
      )}

      <div className="flex overflow-x-auto scrollbar-hide border-b border-slate-200 bg-white sticky top-0 z-40 shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
        <button onClick={() => setActiveTab('chat')} className={`flex-1 py-3 px-3 min-w-max text-[10px] md:text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${activeTab === 'chat' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-slate-500 hover:bg-slate-50'}`}>
          <MessageCircle size={14} className={activeTab === 'chat' ? 'fill-blue-100' : ''}/> Live Chat
        </button>
        <button onClick={() => setActiveTab('stats')} className={`flex-1 py-3 px-3 min-w-max text-[10px] md:text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${activeTab === 'stats' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-slate-500 hover:bg-slate-50'}`}>
          <BarChart2 size={14} /> Stats & XI
        </button>

        {!isUniversallyFinished && (
          <button onClick={() => setActiveTab('table')} className={`flex-1 py-3 px-3 min-w-max text-[10px] md:text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${activeTab === 'table' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Table size={14} /> Table
          </button>
        )}

        {!isUniversallyFinished && (
          <button onClick={() => setActiveTab('pro')} className={`flex-1 py-3 px-3 min-w-max text-[10px] md:text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${activeTab === 'pro' ? 'text-yellow-600 border-b-2 border-yellow-500 bg-yellow-50/30' : 'text-slate-500 hover:bg-slate-50'}`}>
            <BrainCircuit size={14} className={activeTab === 'pro' ? 'text-yellow-500' : ''}/> Pro Slip
          </button>
        )}

        {!isUniversallyFinished && (
          <button onClick={() => scrollToSection('predictions')} className="flex-1 py-3 px-4 min-w-max text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1.5 border-l border-slate-100">
            <Zap size={12} /> Predict
          </button>
        )}
      </div>

      <div className="bg-[#F0F2F5] relative min-h-[300px]">
        <div className="w-full bg-white border-b border-slate-200 py-1 sticky top-[46px] z-30">
          <AdsterraStandardBanner />
        </div>

        {activeTab === 'chat' && (
          <div className="p-2 md:p-4 bg-white flex flex-col h-full">
            <MOTMVoteWidget matchId={matchId} lineups={liveData?.lineups} />
            <FanZoneChat matchId={matchId} espnId={espnId} />
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="p-2 md:p-4 bg-white">
            <StatsLineupsTabs matchId={matchId} dbData={dbData} />
          </div>
        )}

        {!isUniversallyFinished && activeTab === 'table' && (
          <div className="p-2 md:p-4 bg-white">
            <LiveStandings leagueName={dbData.league} homeTeam={dbData.home_team} awayTeam={dbData.away_team} homeScore={liveData?.home_score} awayScore={liveData?.away_score} status={liveData?.status} />
          </div>
        )}

        {!isUniversallyFinished && activeTab === 'pro' && (
          <div className="p-3 md:p-6 bg-slate-900">
            <ProBettingSlipLock homeTeam={dbData.home_team} awayTeam={dbData.away_team} status={dbData.status} proAnalysis={dbData.pro_analysis} />
          </div>
        )}
      </div>
    </div>
  );
}