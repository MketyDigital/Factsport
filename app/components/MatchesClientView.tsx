'use client';
import { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronDown, Search, X, Calendar as CalendarIcon, Trophy, CheckCircle, BarChart2, RefreshCcw, LayoutGrid, Clock, History } from 'lucide-react';
import Link from 'next/link';
import CompactMatchRow from '@/app/components/CompactMatchRow';
import { useSmartInterval } from '@/app/hooks/useSmartInterval';
import AdsterraStandardBanner from '@/app/components/AdsterraStandardBanner';

const PRIORITY_LEAGUES = ['Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Ligue 1', 'Champions League'];
const FINISHED_STATUSES = ['FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD'];

export default function MatchesClientView({ initialMatches, teamFilter, teamFormArray }: { initialMatches: any[], teamFilter?: string | null, teamFormArray?: string[] }) {
    const [liveMatches, setLiveMatches] = useState(initialMatches);
    const [selectedLeague, setSelectedLeague] = useState<string>('All'); 
    const [activeTab, setActiveTab] = useState<'fixtures' | 'results'>('fixtures');
    const [visibleCount, setVisibleCount] = useState(15);
    const [collapsedLeagues, setCollapsedLeagues] = useState<Record<string, boolean>>({});
    const isFetching = useRef(false);

    const [selectedDate, setSelectedDate] = useState(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        const matchesByDate = new Set(initialMatches.map(m => m.match_date.split('T')[0]));
        
        if (matchesByDate.has(todayStr)) return todayStr;
        if (matchesByDate.size === 0) return todayStr;

        const availableDates = Array.from(matchesByDate).sort();
        const todayTime = new Date(todayStr).getTime();
        
        let closestDate = availableDates[0];
        let smallestDiff = Infinity;

        availableDates.forEach(d => {
            const diff = new Date(d).getTime() - todayTime;
            if (diff >= 0 && diff < smallestDiff) {
                smallestDiff = diff;
                closestDate = d;
            }
        });

        return closestDate;
    });

    const dateStrip = useMemo(() => {
        const dates = [];
        for (let i = -7; i <= 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() + i);
            const val = d.toISOString().split('T')[0];
            
            let label = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }).toUpperCase();
            let subLabel = '';
            if (i === 0) { label = 'TODAY'; subLabel = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
            else if (i === -1) { label = 'YEST'; subLabel = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
            else if (i === 1) { label = 'TOM'; subLabel = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
            else { const parts = label.split(' '); label = parts[0]; subLabel = parts[1] + ' ' + d.toLocaleDateString('en-GB', { month: 'short' }); }
            dates.push({ label, subLabel, val });
        }
        return dates;
    }, []);

    const allLeagues = useMemo(() => {
        const unique = Array.from(new Set(initialMatches.map(m => m.league))).sort();
        const priority = PRIORITY_LEAGUES.filter(l => unique.includes(l));
        const others = unique.filter(l => !PRIORITY_LEAGUES.includes(l));
        return [...priority, ...others];
    }, [initialMatches]);

    const fetchUpdates = async () => {
        if (isFetching.current) return;
        const activeEspnIds = liveMatches.filter(m => ['LIVE', 'IN_PLAY', '1H', '2H', 'HT', 'ET', 'P'].includes((m.status || '').toUpperCase()) && m.espn_id).map(m => m.espn_id);
        if (activeEspnIds.length === 0) return;
        
        isFetching.current = true;
        try {
            const promises = activeEspnIds.map(async (espn_id) => {
                const res = await fetch(`https://live-api.factsport.com/?espn_id=${espn_id}&t=${Date.now()}`);
                if (res.ok) {
                    const data = await res.json();
                    if (!data.error) return { espn_id, ...data };
                }
                return null;
            });

            const results = await Promise.all(promises);
            let hasChanges = false;
            const newMatches = liveMatches.map(m => {
                const update = results.find(r => r && r.espn_id === m.espn_id);
                if (update && (update.status !== m.status || update.home_score !== m.home_score || update.away_score !== m.away_score || update.displayClock !== m.displayClock)) {
                    hasChanges = true;
                    return { ...m, status: update.status, home_score: update.home_score, away_score: update.away_score, displayClock: update.displayClock };
                }
                return m;
            });
            if (hasChanges) setLiveMatches(newMatches);
        } catch (e) { } 
        finally { isFetching.current = false; }
    };
    useSmartInterval(fetchUpdates, 8000);

    const handleLeagueSelect = (league: string) => {
        setSelectedLeague(league);
        setActiveTab('fixtures');
        setVisibleCount(15);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // --- 1. THE CALENDAR VIEW (Default "All Matches") ---
    const renderCalendarView = () => {
        const filtered = liveMatches.filter(m => m.match_date.split('T')[0] === selectedDate);
        const grouped: Record<string, any[]> = {};
        filtered.forEach(m => { if (!grouped[m.league]) grouped[m.league] = []; grouped[m.league].push(m); });
        
        const sortedKeys = Object.keys(grouped).sort((a, b) => {
            const idxA = PRIORITY_LEAGUES.indexOf(a);
            const idxB = PRIORITY_LEAGUES.indexOf(b);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.localeCompare(b);
        });

        return (
            <div className="w-full">
                <div className="flex overflow-x-auto scrollbar-hide bg-white border-b border-slate-200 sticky top-[56px] md:top-[60px] z-40 shadow-sm scroll-smooth">
                    {dateStrip.map(d => {
                        const isActive = selectedDate === d.val;
                        return (
                            <button key={d.val} onClick={() => setSelectedDate(d.val)} className={`flex flex-col items-center min-w-[65px] md:min-w-[75px] py-2 md:py-2.5 border-b-2 transition-all ${isActive ? 'border-blue-600 bg-blue-50/50' : 'border-transparent hover:bg-slate-50'}`}>
                                <span className={`text-[10px] md:text-xs font-black uppercase tracking-widest ${isActive ? 'text-blue-600' : 'text-slate-600'}`}>{d.label}</span>
                                <span className={`text-[8px] md:text-[9px] font-bold uppercase tracking-wider ${isActive ? 'text-blue-500' : 'text-slate-400'}`}>{d.subLabel}</span>
                            </button>
                        );
                    })}
                </div>
                <div className="p-2 md:p-3 space-y-4 max-w-4xl mx-auto mt-2 min-h-[500px]">
                    {sortedKeys.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200 border-dashed shadow-sm text-slate-400 mx-2">
                            <CalendarIcon size={32} className="mb-3 opacity-30"/>
                            <p className="text-xs font-black uppercase tracking-widest text-slate-500">No Matches on this Date</p>
                            <p className="text-[10px] font-bold mt-1 text-slate-400">Select another day from the calendar above.</p>
                        </div>
                    ) : (
                        sortedKeys.map((groupKey) => {
                            const isCollapsed = collapsedLeagues[groupKey];
                            const groupMatches = grouped[groupKey];
                            return (
                                <div key={groupKey} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all">
                                    <div className="w-full flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors px-3 py-2.5 border-b border-slate-200">
                                        <button onClick={() => setCollapsedLeagues(prev => ({ ...prev, [groupKey]: !prev[groupKey] }))} className="flex-1 flex items-center gap-2 overflow-hidden text-left">
                                            <Trophy size={14} className="text-slate-400 shrink-0" />
                                            <span className="font-black text-[11px] md:text-xs uppercase tracking-widest text-slate-700 truncate">{groupKey}</span>
                                            <span className="bg-blue-100 text-blue-600 text-[9px] font-black px-1.5 py-0.5 rounded ml-1">{groupMatches.length}</span>
                                            <ChevronDown className={`text-slate-400 transition-transform duration-300 ml-auto mr-2 ${isCollapsed ? '-rotate-90' : ''}`} size={16} />
                                        </button>
                                        <Link href={`/standings?league=${encodeURIComponent(groupKey)}`} title="View Table" className="p-1.5 bg-white border border-slate-200 text-slate-500 hover:text-blue-600 rounded shadow-sm transition">
                                            <BarChart2 size={12} />
                                        </Link>
                                    </div>
                                    
                                    <div className={`transition-all duration-300 ease-in-out ${isCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[5000px] opacity-100'}`}>
                                        <div className="flex flex-col">
                                            {groupMatches.map(m => <CompactMatchRow key={m.id} match={m} disablePolling={true} />)}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <AdsterraStandardBanner />
                </div>
            </div>
        );
    };

    // --- 2. THE GLOBAL LATEST RESULTS VIEW (Modified exactly as requested) ---
    const renderGlobalResultsView = () => {
        const finishedMatches = liveMatches
            .filter(m => FINISHED_STATUSES.includes((m.status || '').toUpperCase()))
            .sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime());

        // 🟢 Get the last 3 distinct dates (e.g. "The Last Weekend Snapshot")
        const uniqueDates = Array.from(new Set(finishedMatches.map(m => m.match_date.split('T')[0]))).slice(0, 3);

        return (
            <div className="w-full p-2 md:p-3 max-w-4xl mx-auto min-h-[600px] space-y-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-2">
                    <div className="bg-slate-50 p-3 md:p-4 flex items-center gap-2">
                        <History className="text-green-600" size={18} />
                        <h2 className="font-black text-sm md:text-base uppercase text-slate-800 tracking-wider">Latest Global Results</h2>
                    </div>
                </div>

                {uniqueDates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 shadow-sm text-slate-400">
                        <History size={32} className="mb-2 opacity-30"/>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">No recent results found.</p>
                    </div>
                ) : (
                    uniqueDates.map(dateStr => {
                        const dateMatches = finishedMatches.filter(m => m.match_date.split('T')[0] === dateStr);
                        const dateLabel = new Date(dateStr).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
                        
                        // Group by League inside this date
                        const groupedByLeague: Record<string, any[]> = {};
                        dateMatches.forEach(m => { if (!groupedByLeague[m.league]) groupedByLeague[m.league] = []; groupedByLeague[m.league].push(m); });
                        
                        const sortedLeagues = Object.keys(groupedByLeague).sort((a, b) => {
                            const idxA = PRIORITY_LEAGUES.indexOf(a);
                            const idxB = PRIORITY_LEAGUES.indexOf(b);
                            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                            if (idxA !== -1) return -1;
                            if (idxB !== -1) return 1;
                            return a.localeCompare(b);
                        });

                        return (
                            <div key={dateStr} className="space-y-3">
                                <div className="flex items-center gap-2 pl-2 mt-8 first:mt-2">
                                    <CalendarIcon size={14} className="text-slate-400"/>
                                    <h3 className="font-black text-xs uppercase tracking-widest text-slate-600">{dateLabel}</h3>
                                </div>
                                
                                {sortedLeagues.map(league => {
                                    const groupKey = `res-${dateStr}-${league}`;
                                    const isCollapsed = collapsedLeagues[groupKey];
                                    const leagueMatches = groupedByLeague[league];
                                    
                                    return (
                                        <div key={groupKey} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all">
                                            <div className="w-full flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors px-3 py-2.5 border-b border-slate-200">
                                                <button onClick={() => setCollapsedLeagues(prev => ({ ...prev, [groupKey]: !prev[groupKey] }))} className="flex-1 flex items-center gap-2 overflow-hidden text-left">
                                                    <Trophy size={14} className="text-slate-400 shrink-0" />
                                                    <span className="font-black text-[11px] md:text-xs uppercase tracking-widest text-slate-700 truncate">{league}</span>
                                                    <span className="bg-slate-200 text-slate-600 text-[9px] font-black px-1.5 py-0.5 rounded ml-1">{leagueMatches.length}</span>
                                                    <ChevronDown className={`text-slate-400 transition-transform duration-300 ml-auto mr-2 ${isCollapsed ? '-rotate-90' : ''}`} size={16} />
                                                </button>
                                                <Link href={`/standings?league=${encodeURIComponent(league)}`} title="View Table" className="p-1.5 bg-white border border-slate-200 text-slate-500 hover:text-blue-600 rounded shadow-sm transition">
                                                    <BarChart2 size={12} />
                                                </Link>
                                            </div>
                                            
                                            <div className={`transition-all duration-300 ease-in-out ${isCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[5000px] opacity-100'}`}>
                                                <div className="flex flex-col">
                                                    {leagueMatches.map(m => <CompactMatchRow key={m.id} match={m} disablePolling={true} />)}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })
                )}
                <AdsterraStandardBanner />
            </div>
        );
    };

    // --- 3. THE SPECIFIC LEAGUE VIEW ---
    const renderLeagueView = () => {
        const leagueMatches = liveMatches.filter(m => m.league === selectedLeague);
        const fixtures = leagueMatches.filter(m => !FINISHED_STATUSES.includes((m.status || '').toUpperCase())).sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime());
        const results = leagueMatches.filter(m => FINISHED_STATUSES.includes((m.status || '').toUpperCase())).sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime());
        
        const activeList = activeTab === 'fixtures' ? fixtures : results;
        const displayMatches = activeList.slice(0, visibleCount);
        const hasMore = visibleCount < activeList.length;

        const groupedData: Record<string, any[]> = {};
        displayMatches.forEach(m => {
            const dateKey = new Date(m.match_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
            if (!groupedData[dateKey]) groupedData[dateKey] = [];
            groupedData[dateKey].push(m);
        });

        return (
            <div className="w-full p-2 md:p-4 max-w-4xl mx-auto min-h-[600px]">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6 flex flex-col">
                    <div className="bg-slate-50 border-b border-slate-200 p-3 md:p-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Trophy className="text-blue-500" size={20} />
                            <h2 className="font-black text-sm md:text-base uppercase text-slate-800 tracking-wider truncate">{selectedLeague}</h2>
                        </div>
                    </div>
                    
                    <div className="flex px-2 md:px-4 gap-2 py-3 bg-slate-50 border-b border-slate-200">
                        <button onClick={() => { setActiveTab('fixtures'); setVisibleCount(15); }} className={`flex-1 py-2 text-[10px] md:text-xs font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'fixtures' ? 'bg-white shadow-sm text-blue-600 border border-slate-200' : 'text-slate-400 hover:bg-slate-100 border border-transparent'}`}>
                            <CalendarIcon size={14} /> Fixtures <span className={`px-1.5 rounded-full text-[9px] ${activeTab === 'fixtures' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>{fixtures.length}</span>
                        </button>
                        <button onClick={() => { setActiveTab('results'); setVisibleCount(15); }} className={`flex-1 py-2 text-[10px] md:text-xs font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'results' ? 'bg-white shadow-sm text-blue-600 border border-slate-200' : 'text-slate-400 hover:bg-slate-100 border border-transparent'}`}>
                            <CheckCircle size={14} /> Results <span className={`px-1.5 rounded-full text-[9px] ${activeTab === 'results' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>{results.length}</span>
                        </button>
                        <Link href={`/standings?league=${encodeURIComponent(selectedLeague)}`} className="flex-1 py-2 text-[10px] md:text-xs font-black uppercase tracking-widest rounded-lg text-slate-400 hover:bg-slate-100 border border-transparent flex items-center justify-center gap-2 transition-all">
                            <BarChart2 size={14} /> Table
                        </Link>
                    </div>

                    <div className="divide-y divide-slate-50 min-h-[200px] bg-slate-50/30">
                        {displayMatches.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                                <CalendarIcon size={32} className="mb-2 opacity-30"/>
                                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">No {activeTab} available.</p>
                            </div>
                        ) : (
                            Object.keys(groupedData).map((dateKey) => (
                                <div key={dateKey}>
                                    <div className="bg-slate-100/80 backdrop-blur-sm px-4 py-1.5 border-b border-slate-50 sticky top-[56px] md:top-[60px] z-10 flex items-center gap-1.5">
                                        <Clock size={12} className="text-slate-400"/>
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{dateKey}</span>
                                    </div>
                                    <div className="flex flex-col bg-white">
                                        {groupedData[dateKey].map((match) => (
                                            <CompactMatchRow key={match.id} match={match} disablePolling={false} />
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {hasMore && (
                        <div className="p-4 border-t border-slate-200 bg-slate-50">
                            <button onClick={() => setVisibleCount(prev => prev + 15)} className="w-full bg-white border border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 text-slate-600 font-black text-[10px] md:text-xs uppercase tracking-widest py-3 md:py-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2">
                                <RefreshCcw size={14} className="text-blue-500" /> Load {Math.min(15, activeList.length - visibleCount)} More {activeTab === 'fixtures' ? 'Fixtures' : 'Results'}
                            </button>
                        </div>
                    )}
                </div>
                <AdsterraStandardBanner />
            </div>
        );
    };

    return (
        <div className="flex flex-col md:flex-row max-w-[1400px] mx-auto items-start w-full relative">
            
            {/* 🟢 DESKTOP SIDEBAR */}
            <aside className="hidden md:flex flex-col w-[260px] lg:w-[280px] shrink-0 sticky top-[60px] h-[calc(100vh-60px)] overflow-y-auto border-r border-slate-200 bg-white shadow-[5px_0_15px_rgba(0,0,0,0.02)] z-30">
                <div className="p-4 border-b border-slate-100 bg-slate-50">
                    <h3 className="font-black uppercase tracking-widest text-xs text-slate-500 flex items-center gap-2 mb-3"><LayoutGrid size={14} className="text-blue-500"/> Navigation</h3>
                    <div className="space-y-2">
                        <button onClick={() => handleLeagueSelect('All')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${selectedLeague === 'All' ? 'bg-blue-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                            <CalendarIcon size={14} /> All Matches
                        </button>
                        <button onClick={() => handleLeagueSelect('Results')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${selectedLeague === 'Results' ? 'bg-green-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                            <History size={14} /> Latest Results
                        </button>
                    </div>
                </div>
                
                <div className="p-4">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 pl-1">Competitions</h4>
                    <div className="space-y-1">
                        {allLeagues.map(league => (
                            <button key={league} onClick={() => handleLeagueSelect(league)} className={`w-full flex items-center text-left gap-3 px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-colors ${selectedLeague === league ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'text-slate-600 hover:bg-slate-50 border border-transparent'}`}>
                                <Trophy size={12} className={selectedLeague === league ? 'text-blue-500' : 'text-slate-400'} />
                                <span className="truncate">{league}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </aside>

            {/* 🟢 MOBILE LEAGUE NAVIGATOR */}
            <div className="md:hidden w-full bg-white border-b border-slate-200 sticky top-[56px] z-40 shadow-sm overflow-x-auto scrollbar-hide py-2">
                <div className="flex px-3 space-x-2 min-w-max items-center">
                    <button onClick={() => handleLeagueSelect('All')} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${selectedLeague === 'All' ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>All Matches</button>
                    <button onClick={() => handleLeagueSelect('Results')} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-1.5 ${selectedLeague === 'Results' ? 'bg-green-600 border-green-600 text-white shadow-md' : 'bg-green-50 border-green-200 text-green-700'}`}><CheckCircle size={12}/> Results</button>
                    <div className="w-[1px] h-6 bg-slate-200 mx-1"></div>
                    {allLeagues.map((league) => (
                        <button key={league} onClick={() => handleLeagueSelect(league)} className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all border ${selectedLeague === league ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>{league === 'Premier League' ? 'EPL' : league}</button>
                    ))}
                </div>
            </div>

            {/* 🟢 MAIN CONTENT AREA */}
            <main className="flex-1 w-full min-w-0 bg-[#F0F2F5]">
                {teamFilter ? (
                    <div className="p-3 max-w-4xl mx-auto">
                        <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl p-4 shadow-md flex items-center justify-between text-white mb-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1.5">
                                    <Search size={16} className="text-blue-200" />
                                    <span className="text-xs font-black uppercase tracking-widest">Showing: {teamFilter}</span>
                                </div>
                                {teamFormArray && teamFormArray.length > 0 && (
                                    <div className="flex items-center gap-1">
                                        <span className="text-[8px] uppercase tracking-widest font-bold text-blue-200 mr-1">Form:</span>
                                        {teamFormArray.map((res, i) => (
                                            <span key={i} className={`w-3.5 h-3.5 flex items-center justify-center text-[7px] font-black text-white rounded-sm shadow-sm border border-black/10 ${res === 'W' ? 'bg-green-500' : res === 'L' ? 'bg-red-500' : 'bg-slate-400'}`}>{res}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <Link href="/matches" className="bg-white/20 hover:bg-white/30 p-1.5 rounded-full backdrop-blur-sm transition"><X size={16} /></Link>
                        </div>
                        {renderCalendarView()}
                    </div>
                ) : (
                    selectedLeague === 'All' ? renderCalendarView() : 
                    selectedLeague === 'Results' ? renderGlobalResultsView() : 
                    renderLeagueView()
                )}
            </main>
        </div>
    );
}