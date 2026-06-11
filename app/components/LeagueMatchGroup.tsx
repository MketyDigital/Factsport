// @ts-nocheck
'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Calendar, Zap, Ticket, ExternalLink, BarChart2, ChevronRight, Clock, CheckCircle, Trophy, RefreshCcw } from 'lucide-react';
import MatchTime from '@/app/components/MatchTime';
import { useSmartInterval } from '@/app/hooks/useSmartInterval';
import { fetchLiveMatchDeduplicated } from '@/app/utils/liveFetcher';

const groupByDate = (matchList: any[]) => {
    const groups: { [date: string]: any[] } = {};
    matchList.forEach(m => {
        const dateObj = new Date(m.match_date);
        const dateKey = dateObj.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(m);
    });
    return groups;
};

const DEFAULT_AFFILIATE_LINK = "https://refpa58144.com/L?tag=d_1181253m_1599c_&site=1181253&ad=1599";

export default function LeagueMatchGroup({ leagueName, matches }: { leagueName: string, matches: any[] }) {
    const [activeTab, setActiveTab] = useState<'fixtures' | 'results'>('fixtures');
    const [liveMatches, setLiveMatches] = useState(matches);
    const isFetching = useRef(false);
    const [visibleCount, setVisibleCount] = useState(10);

    const handleTabChange = (tab: 'fixtures' | 'results') => {
        setActiveTab(tab);
        setVisibleCount(10);
    };

    useEffect(() => {
        setLiveMatches(prev => {
            const prevIds = prev.map(p => p.id).join(',');
            const newIds = matches.map(n => n.id).join(',');
            if (prevIds !== newIds) return matches;
            return prev;
        });
    }, [matches]);

    const pollableMatches = liveMatches.filter(m => {
        if (!m.espn_id) return false;
        const status = (m.status || '').toUpperCase();
        if (['FT', 'FINISHED', 'ABD', 'AET', 'PEN'].includes(status)) return false;
        if (['LIVE', 'IN_PLAY', 'HT', '1H', '2H', 'ET', 'P'].includes(status)) return true;
        
        const matchTime = new Date(m.match_date).getTime();
        const now = Date.now();
        return (matchTime - now) < 3600000; 
    });

    const fetchUpdates = async () => {
        if (isFetching.current || pollableMatches.length === 0) return;

        isFetching.current = true;
        try {
            const updatePromises = pollableMatches.map(async (m) => {
                try {
                    const data = await fetchLiveMatchDeduplicated(m.espn_id);
                    if (data && !data.error) {
                        return { id: m.id, status: data.status, home_score: data.home_score, away_score: data.away_score, displayClock: data.displayClock, stats: data.stats };
                    }
                } catch (e) {}
                return null;
            });

            const results = await Promise.all(updatePromises);
            
            let hasChanges = false;
            const newLiveMatches = liveMatches.map(m => {
                const update = results.find(r => r && r.id === m.id);
                if (update && (update.status !== m.status || update.home_score !== m.home_score || update.away_score !== m.away_score || update.displayClock !== m.displayClock || JSON.stringify(update.stats) !== JSON.stringify(m.stats))) {
                    hasChanges = true;
                    return { ...m, status: update.status, home_score: update.home_score, away_score: update.away_score, displayClock: update.displayClock, stats: update.stats };
                }
                return m;
            });

            if (hasChanges) setLiveMatches(newLiveMatches);

        } catch(e) { } 
        finally {
            isFetching.current = false;
        }
    };

    useEffect(() => {
        fetchUpdates();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useSmartInterval(fetchUpdates, pollableMatches.length > 0 ? 10000 : null);

    const fixtures = liveMatches
        .filter(m => !['FT', 'FINISHED', 'ABD'].includes((m.status || '').toUpperCase()))
        .sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime());
    
    const results = liveMatches
        .filter(m => ['FT', 'FINISHED', 'ABD'].includes((m.status || '').toUpperCase()))
        .sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime());

    const activeList = activeTab === 'fixtures' ? fixtures : results;
    const displayMatches = activeList.slice(0, visibleCount);
    const hasMore = visibleCount < activeList.length;
    const dateGroups = groupByDate(displayMatches);
    const hasData = displayMatches.length > 0;

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-6 flex flex-col">
            <div className="bg-slate-50 border-b border-slate-200">
                <div className="px-4 py-3 flex justify-between items-center">
                    <h2 className="font-black text-sm uppercase text-slate-800 tracking-wider truncate">{leagueName}</h2>
                    <Link href={`/standings?league=${encodeURIComponent(leagueName.replace(' Matches', ''))}`} className="text-[10px] font-bold text-blue-600 flex items-center gap-1 hover:underline">
                        Full Table <ChevronRight size={10} />
                    </Link>
                </div>
                
                <div className="flex px-2 gap-2 pb-2">
                    <button 
                        onClick={() => handleTabChange('fixtures')} 
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'fixtures' ? 'bg-white shadow-sm text-blue-600 border border-slate-100' : 'text-slate-400 hover:bg-slate-100'}`}
                    >
                        <Calendar size={12} /> Fixtures
                        <span className={`px-1.5 rounded-full text-[9px] ${activeTab === 'fixtures' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>{fixtures.length}</span>
                    </button>
                    <button 
                        onClick={() => handleTabChange('results')} 
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'results' ? 'bg-white shadow-sm text-blue-600 border border-slate-100' : 'text-slate-400 hover:bg-slate-100'}`}
                    >
                        <CheckCircle size={12} /> Results
                        <span className={`px-1.5 rounded-full text-[9px] ${activeTab === 'results' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>{results.length}</span>
                    </button>
                    <Link href={`/standings?league=${encodeURIComponent(leagueName.replace(' Matches', ''))}`} className="flex-1 py-1.5 text-xs font-bold rounded-lg text-slate-400 hover:bg-slate-100 flex items-center justify-center gap-2 transition-all">
                        <BarChart2 size={12} /> Table
                    </Link>
                </div>
            </div>

            <div className="divide-y divide-slate-50 min-h-[100px]">
                {!hasData ? (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                        <Calendar size={24} className="mb-2 opacity-50"/>
                        <p className="text-xs font-medium">No {activeTab} available.</p>
                    </div>
                ) : (
                    Object.keys(dateGroups).map((dateKey) => (
                        <div key={dateKey}>
                            <div className="bg-slate-100/80 backdrop-blur-sm px-4 py-1.5 border-b border-slate-50 sticky top-0 z-10">
                                <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                    <Clock size={10}/> {dateKey}
                                </span>
                            </div>

                            {dateGroups[dateKey].map((match) => {
                                const isLive = ['LIVE', 'HT', 'IN_PLAY'].includes((match.status || '').toUpperCase());
                                const isScheduled = ['SCHEDULED', 'PRE'].includes((match.status || '').toUpperCase());
                                const isFinished = ['FT', 'FINISHED'].includes((match.status || '').toUpperCase());
                                
                               const stageParts = [
  match.match_group ? `Group ${match.match_group}`.replace(/_/g, ' ') : '',
  match.stage && match.stage !== 'REGULAR_SEASON' ? match.stage.replace(/_/g, ' ') : '',
  match.match_type && match.match_type !== 'REGULAR_SEASON' ? match.match_type.replace(/_/g, ' ') : ''
].filter(Boolean);

const stageText = stageParts.length > 0 ? stageParts.join(' • ') : null;
const isKnockout = match.knockout || match.final || (match.match_type && ['FINAL', 'SEMI_FINAL', 'QUARTER_FINAL', 'KNOCKOUT_ROUND'].includes(String(match.match_type).toUpperCase()));

                                const homePens = match.stats?.home_penalties;
                                const awayPens = match.stats?.away_penalties;
                                const hasPens = homePens !== null && homePens !== undefined;
                                const homeHT = match.stats?.home_ht;
                                const awayHT = match.stats?.away_ht;
                                const hasHT = homeHT !== null && homeHT !== undefined;
                                const aggregateText = match.stats?.aggregate;

                                return (
                                <div key={match.id} className={`block hover:bg-slate-50 transition p-4 ${isKnockout ? 'bg-amber-50/30' : ''}`}>
                                    <Link href={`/match/${match.id}`} className="flex items-center justify-between mb-3">
                                        
                                        <div className="flex-1 space-y-3">
                                            {stageText && (
                                                <div className={`text-[8px] font-black uppercase tracking-wider mb-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${isKnockout ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-white shadow-sm' : 'text-blue-500 bg-blue-50'}`}>
                                                    {isKnockout && <Trophy size={8} />} {stageText}
                                                </div>
                                            )}

                                            <div className="flex items-center gap-3">
                                                <div className="w-7 h-7 flex items-center justify-center shrink-0">
                                                    {match.home_logo ? <img src={match.home_logo} className="w-full h-full object-contain drop-shadow-sm" /> : <div className="w-5 h-5 bg-slate-200 rounded-full"/>}
                                                </div>
                                                <span className={`text-sm font-black uppercase tracking-tight truncate max-w-[120px] sm:max-w-none ${isFinished && match.home_score > match.away_score ? 'text-slate-900' : 'text-slate-500'}`}>
                                                    {match.home_team}
                                                </span>
                                                {!isScheduled && (
                                                    <div className="ml-auto flex items-baseline gap-1.5">
                                                        {hasPens && <span className="text-[9px] font-bold text-amber-500">({homePens})</span>}
                                                        <span className={`font-black text-lg ${isFinished && match.home_score > match.away_score ? 'text-slate-900' : 'text-slate-400'}`}>{match.home_score}</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className="w-7 h-7 flex items-center justify-center shrink-0">
                                                    {match.away_logo ? <img src={match.away_logo} className="w-full h-full object-contain drop-shadow-sm" /> : <div className="w-5 h-5 bg-slate-200 rounded-full"/>}
                                                </div>
                                                <span className={`text-sm font-black uppercase tracking-tight truncate max-w-[120px] sm:max-w-none ${isFinished && match.away_score > match.home_score ? 'text-slate-900' : 'text-slate-500'}`}>
                                                    {match.away_team}
                                                </span>
                                                {!isScheduled && (
                                                    <div className="ml-auto flex items-baseline gap-1.5">
                                                        {hasPens && <span className="text-[9px] font-bold text-amber-500">({awayPens})</span>}
                                                        <span className={`font-black text-lg ${isFinished && match.away_score > match.home_score ? 'text-slate-900' : 'text-slate-400'}`}>{match.away_score}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {(hasHT || aggregateText) && (
                                                <div className="flex items-center gap-2 text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-2 pt-1 border-t border-slate-100/50">
                                                    {hasHT && <span>HT: {homeHT}-{awayHT}</span>}
                                                    {hasHT && aggregateText && <span className="w-1 h-1 bg-slate-300 rounded-full"></span>}
                                                    {aggregateText && <span className="text-blue-500">{aggregateText}</span>}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-col items-end justify-center pl-4 border-l border-slate-100 ml-4 w-16 shrink-0">
                                            {isLive ? (
                                                <div className="flex flex-col items-center">
                                                    <span className="animate-pulse text-red-600 font-black text-[10px] bg-red-50 px-2 py-0.5 rounded border border-red-100">LIVE</span>
                                                    <span className="text-[9px] text-red-500 font-bold mt-1">{match.status === 'HT' ? 'HT' : match.displayClock || 'On Going'}</span>
                                                </div>
                                            ) : isFinished ? (
                                                <div className="flex flex-col items-center">
                                                    <span className="text-slate-400 font-black text-[10px] bg-slate-100 px-2 py-0.5 rounded">FT</span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center bg-slate-50 p-1.5 rounded border border-slate-100 shadow-sm">
                                                    <span className="text-slate-800 font-black text-xs">
                                                        <MatchTime date={match.match_date} />
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </Link>

                                    {!isFinished && (
                                        <div className="flex gap-2 mt-2 pt-3 border-t border-slate-50">
                                            {isScheduled && (
                                                <Link href={`/match/${match.id}`} className="flex-1 bg-gradient-to-b from-white to-slate-50 border border-slate-200 text-slate-700 rounded-lg py-1.5 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 hover:border-slate-300 transition shadow-sm">
                                                    <Zap size={10} className="text-blue-600 fill-blue-600"/> Predict
                                                </Link>
                                            )}
                                            
                                            {match.booking_code ? (
                                                <button className="flex-1 bg-[#0a1428] text-white rounded-lg py-1.5 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 shadow-md hover:bg-[#1a2b4c] transition">
                                                    <Ticket size={10} className="text-yellow-400"/> Code: {match.booking_code}
                                                </button>
                                            ) : (
                                                <a href={match.affiliate_link || DEFAULT_AFFILIATE_LINK} target="_blank" rel="noopener noreferrer" className="flex-1 bg-green-50 text-green-700 border border-green-200 rounded-lg py-1.5 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 hover:bg-green-100 transition shadow-sm">
                                                    <ExternalLink size={10}/> Bet Now
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </div>
                                );
                            })}
                        </div>
                    ))
                )}
            </div>

            {hasMore && (
                <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                    <button 
                        onClick={() => setVisibleCount(prev => prev + 10)}
                        className="w-full bg-white border border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 text-slate-600 font-black text-[10px] uppercase tracking-widest py-3 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                    >
                        <RefreshCcw size={14} className="text-blue-500" /> 
                        Load {Math.min(10, activeList.length - visibleCount)} More {activeTab === 'fixtures' ? 'Upcoming Matches' : 'Recent Results'}
                    </button>
                </div>
            )}
        </div>
    );
}