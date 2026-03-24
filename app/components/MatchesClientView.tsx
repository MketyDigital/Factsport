'use client';
import { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronDown, Search, X, Calendar as CalendarIcon, Trophy } from 'lucide-react';
import Link from 'next/link';
import CompactMatchRow from '@/app/components/CompactMatchRow';
import { useSmartInterval } from '@/app/hooks/useSmartInterval';
import AdsterraStandardBanner from '@/app/components/AdsterraStandardBanner';

const PRIORITY_LEAGUES = ['Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Ligue 1', 'Champions League'];

export default function MatchesClientView({ initialMatches, teamFilter, teamFormArray }: { initialMatches: any[], teamFilter?: string | null, teamFormArray?: string[] }) {
    const [liveMatches, setLiveMatches] = useState(initialMatches);
    const isFetching = useRef(false);

    // 🟢 The 15-Day Date Strip Generator
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

    const todayStr = new Date().toISOString().split('T')[0];
    const [selectedDate, setSelectedDate] = useState(todayStr);
    const [collapsedLeagues, setCollapsedLeagues] = useState<Record<string, boolean>>({});

    const toggleLeague = (league: string) => {
        setCollapsedLeagues(prev => ({ ...prev, [league]: !prev[league] }));
    };

    // 🟢 BATCH POLLER: Only polls for Active matches that are currently on the screen!
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

    const filteredMatches = useMemo(() => {
        if (teamFilter) return liveMatches; // Team Search ignores date filter
        return liveMatches.filter(m => m.match_date.split('T')[0] === selectedDate);
    }, [liveMatches, selectedDate, teamFilter]);

    const groupedData = useMemo(() => {
        const groups: Record<string, any[]> = {};
        filteredMatches.forEach(m => {
            const key = teamFilter ? new Date(m.match_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : m.league;
            if (!groups[key]) groups[key] = [];
            groups[key].push(m);
        });
        return groups;
    }, [filteredMatches, teamFilter]);

    const sortedKeys = Object.keys(groupedData).sort((a, b) => {
        if (teamFilter) return new Date(b).getTime() - new Date(a).getTime();
        const idxA = PRIORITY_LEAGUES.indexOf(a);
        const idxB = PRIORITY_LEAGUES.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
    });

    return (
        <div className="w-full">
            {/* 🟢 TOP BAR: Team Filter OR Swipeable Date Strip */}
            {teamFilter ? (
                <div className="p-3">
                    <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl p-4 shadow-md flex items-center justify-between text-white">
                        <div>
                            <div className="flex items-center gap-2 mb-1.5">
                                <Search size={16} className="text-blue-200" />
                                <span className="text-xs font-black uppercase tracking-widest">Showing: {teamFilter}</span>
                            </div>
                            {teamFormArray && teamFormArray.length > 0 && (
                                <div className="flex items-center gap-1">
                                    <span className="text-[8px] uppercase tracking-widest font-bold text-blue-200 mr-1">Form:</span>
                                    {teamFormArray.map((result, i) => (
                                        <span key={i} className={`w-3.5 h-3.5 flex items-center justify-center text-[7px] font-black text-white rounded-sm shadow-sm border border-black/10 ${result === 'W' ? 'bg-green-500' : result === 'L' ? 'bg-red-500' : 'bg-slate-400'}`}>
                                            {result}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <Link href="/matches" className="bg-white/20 hover:bg-white/30 p-1.5 rounded-full backdrop-blur-sm transition"><X size={16} /></Link>
                    </div>
                </div>
            ) : (
                <div className="flex overflow-x-auto scrollbar-hide bg-white border-b border-slate-200 sticky top-[56px] md:top-[60px] z-40 shadow-sm scroll-smooth">
                    {dateStrip.map(d => {
                        const isActive = selectedDate === d.val;
                        return (
                            <button 
                                key={d.val} 
                                onClick={() => setSelectedDate(d.val)} 
                                className={`flex flex-col items-center min-w-[65px] md:min-w-[75px] py-2 md:py-2.5 border-b-2 transition-all ${isActive ? 'border-blue-600 bg-blue-50/50' : 'border-transparent hover:bg-slate-50'}`}
                            >
                                <span className={`text-[10px] md:text-xs font-black uppercase tracking-widest ${isActive ? 'text-blue-600' : 'text-slate-600'}`}>{d.label}</span>
                                <span className={`text-[8px] md:text-[9px] font-bold uppercase tracking-wider ${isActive ? 'text-blue-500' : 'text-slate-400'}`}>{d.subLabel}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="p-2 md:p-3 space-y-4 max-w-4xl mx-auto min-h-[500px]">
                <AdsterraStandardBanner />

                {sortedKeys.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200 border-dashed shadow-sm text-slate-400">
                        <CalendarIcon size={32} className="mb-3 opacity-30"/>
                        <p className="text-xs font-black uppercase tracking-widest">No Matches Scheduled</p>
                    </div>
                ) : (
                    sortedKeys.map((groupKey) => {
                        const isCollapsed = collapsedLeagues[groupKey];
                        const groupMatches = groupedData[groupKey];
                        const leagueBanner = !teamFilter && groupMatches[0]?.league_banner;

                        return (
                            <div key={groupKey} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all">
                                <button 
                                    onClick={() => toggleLeague(groupKey)} 
                                    className="w-full flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors px-3 py-2.5 border-b border-slate-200 active:bg-slate-200"
                                >
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        {!teamFilter && <Trophy size={14} className="text-slate-400 shrink-0" />}
                                        <span className="font-black text-[11px] md:text-xs uppercase tracking-widest text-slate-700 truncate">{groupKey}</span>
                                        {!teamFilter && <span className="bg-blue-100 text-blue-600 text-[9px] font-black px-1.5 py-0.5 rounded ml-1">{groupMatches.length}</span>}
                                    </div>
                                    <ChevronDown className={`text-slate-400 transition-transform duration-300 ${isCollapsed ? '-rotate-90' : ''}`} size={16} />
                                </button>
                                
                                <div className={`transition-all duration-300 ease-in-out ${isCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[5000px] opacity-100'}`}>
                                    {leagueBanner && (
                                        <div className="w-full h-12 md:h-16 overflow-hidden border-b border-slate-100 bg-black">
                                            <img src={leagueBanner} alt={groupKey} className="w-full h-full object-cover opacity-80" />
                                        </div>
                                    )}
                                    <div className="flex flex-col">
                                        {/* 🟢 INJECTS THE ULTRA-COMPACT ROW */}
                                        {groupMatches.map(m => (
                                            <CompactMatchRow key={m.id} match={m} disablePolling={true} showLeague={!!teamFilter} />
                                        ))}
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
}