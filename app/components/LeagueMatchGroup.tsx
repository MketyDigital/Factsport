'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Calendar, Zap, Ticket, ExternalLink, BarChart2, ChevronRight, Clock, CheckCircle } from 'lucide-react';

// Helper to Group Matches by Date
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

// Helper: 1xBet Link
const DEFAULT_AFFILIATE_LINK = "https://refpa58144.com/L?tag=d_1181253m_1599c_&site=1181253&ad=1599";

export default function LeagueMatchGroup({ leagueName, matches }: { leagueName: string, matches: any[] }) {
    const [activeTab, setActiveTab] = useState<'fixtures' | 'results'>('fixtures');

    // 1. Filter Matches
    const now = new Date();
    const fixtures = matches
        .filter(m => !['FT', 'FINISHED', 'ABD'].includes(m.status))
        .sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime());
    
    const results = matches
        .filter(m => ['FT', 'FINISHED', 'ABD'].includes(m.status))
        .sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime()); // Newest first

    // 2. Decide what to show
    const displayMatches = activeTab === 'fixtures' ? fixtures : results;
    const dateGroups = groupByDate(displayMatches);
    const hasData = displayMatches.length > 0;

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-6 flex flex-col">
            
            {/* A. HEADER & TABS */}
            <div className="bg-slate-50 border-b border-slate-200">
                <div className="px-4 py-3 flex justify-between items-center">
                    <h2 className="font-black text-sm uppercase text-slate-800 tracking-wider truncate">{leagueName}</h2>
                    <Link href={`/standings?league=${encodeURIComponent(leagueName)}`} className="text-[10px] font-bold text-blue-600 flex items-center gap-1 hover:underline">
                        Full Table <ChevronRight size={10} />
                    </Link>
                </div>
                
                {/* TABS CONTROLLER */}
                <div className="flex px-2 gap-2 pb-2">
                    <button 
                        onClick={() => setActiveTab('fixtures')} 
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'fixtures' ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:bg-slate-100'}`}
                    >
                        <Calendar size={12} /> Fixtures
                        <span className="bg-slate-100 text-slate-500 px-1.5 rounded-full text-[9px]">{fixtures.length}</span>
                    </button>
                    <button 
                        onClick={() => setActiveTab('results')} 
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'results' ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:bg-slate-100'}`}
                    >
                        <CheckCircle size={12} /> Results
                        <span className="bg-slate-100 text-slate-500 px-1.5 rounded-full text-[9px]">{results.length}</span>
                    </button>
                    <Link href={`/standings?league=${encodeURIComponent(leagueName)}`} className="flex-1 py-1.5 text-xs font-bold rounded-lg text-slate-400 hover:bg-slate-100 flex items-center justify-center gap-2 transition-all">
                        <BarChart2 size={12} /> Table
                    </Link>
                </div>
            </div>

            {/* B. MATCH LIST */}
            <div className="divide-y divide-slate-50 min-h-[100px]">
                {!hasData ? (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                        <Calendar size={24} className="mb-2 opacity-50"/>
                        <p className="text-xs font-medium">No {activeTab} found.</p>
                    </div>
                ) : (
                    Object.keys(dateGroups).map((dateKey) => (
                        <div key={dateKey}>
                            {/* Sticky Date Header */}
                            <div className="bg-slate-100/80 backdrop-blur-sm px-4 py-1.5 border-b border-slate-50 sticky top-0 z-10">
                                <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                    <Clock size={10}/> {dateKey}
                                </span>
                            </div>

                            {dateGroups[dateKey].map((match) => {
                                const isLive = ['LIVE', 'HT', 'IN_PLAY'].includes(match.status);
                                const isScheduled = match.status === 'SCHEDULED' || match.status === 'PRE';
                                const isFinished = ['FT', 'FINISHED'].includes(match.status);

                                return (
                                <div key={match.id} className="block hover:bg-slate-50 transition p-4">
                                    <Link href={`/match/${match.id}`} className="flex items-center justify-between mb-3">
                                        {/* TEAMS */}
                                        <div className="flex-1 space-y-2">
                                            <div className="flex items-center gap-3">
                                                <div className="w-6 h-6 flex items-center justify-center shrink-0">
                                                    {match.home_logo ? <img src={match.home_logo} className="w-full h-full object-contain" /> : <div className="w-5 h-5 bg-slate-200 rounded-full"/>}
                                                </div>
                                                <span className={`text-xs font-bold ${isFinished && match.home_score > match.away_score ? 'text-slate-900' : 'text-slate-600'}`}>{match.home_team}</span>
                                                {!isScheduled && <span className="ml-auto font-black text-sm">{match.home_score}</span>}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="w-6 h-6 flex items-center justify-center shrink-0">
                                                    {match.away_logo ? <img src={match.away_logo} className="w-full h-full object-contain" /> : <div className="w-5 h-5 bg-slate-200 rounded-full"/>}
                                                </div>
                                                <span className={`text-xs font-bold ${isFinished && match.away_score > match.home_score ? 'text-slate-900' : 'text-slate-600'}`}>{match.away_team}</span>
                                                {!isScheduled && <span className="ml-auto font-black text-sm">{match.away_score}</span>}
                                            </div>
                                        </div>

                                        {/* TIME / STATUS */}
                                        <div className="flex flex-col items-end justify-center pl-4 border-l border-slate-100 ml-4 w-16 shrink-0">
                                            {isLive ? (
                                                <div className="flex flex-col items-center">
                                                    <span className="animate-pulse text-red-600 font-black text-xs">LIVE</span>
                                                    <span className="text-[9px] text-red-500 font-bold">{match.status === 'HT' ? 'HT' : 'On Going'}</span>
                                                </div>
                                            ) : isFinished ? (
                                                <div className="flex flex-col items-center">
                                                    <span className="text-slate-400 font-bold text-xs">FT</span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center bg-slate-50 p-1.5 rounded">
                                                    <span className="text-slate-900 font-bold text-xs">
                                                        {new Date(match.match_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </Link>

                                    {/* C. ACTION BUTTONS (The Logic You Requested) */}
                                    {/* Only show buttons if NOT finished */}
                                    {!isFinished && (
                                        <div className="flex gap-2 mt-2 pt-2 border-t border-slate-50">
                                            
                                            {/* PREDICT: Only for Scheduled (Not Live) */}
                                            {isScheduled && (
                                                <Link href={`/match/${match.id}`} className="flex-1 bg-slate-100 text-slate-600 rounded-lg py-1.5 text-[10px] font-bold flex items-center justify-center gap-1 hover:bg-slate-200 transition">
                                                    <Zap size={10}/> Predict
                                                </Link>
                                            )}
                                            
                                            {/* BET: Active for Scheduled AND Live */}
                                            {match.booking_code ? (
                                                <button className="flex-1 bg-[#1A1A1A] text-yellow-400 rounded-lg py-1.5 text-[10px] font-bold flex items-center justify-center gap-1">
                                                    <Ticket size={10}/> {match.booking_code}
                                                </button>
                                            ) : (
                                                <a href={match.affiliate_link || DEFAULT_AFFILIATE_LINK} target="_blank" className="flex-1 bg-green-100 text-green-700 border border-green-200 rounded-lg py-1.5 text-[10px] font-bold flex items-center justify-center gap-1 hover:bg-green-200 transition">
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
        </div>
    );
}