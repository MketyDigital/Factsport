'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, Calendar, MapPin, Play, Tv, ChevronRight, Activity, Award, Star, Compass } from 'lucide-react';
import Link from 'next/link';

interface Match {
    id?: string;
    api_id?: number;
    home_team: string;
    away_team: string;
    home_score: number;
    away_score: number;
    match_date: string;
    status: string;
    home_logo?: string;
    away_logo?: string;
    stage?: string | null;
    match_group?: string | null;
    venue?: string | null;
}

interface LeagueMatchGroupProps {
    leagueName: string;
    matches: Match[];
}

// Map stage names to beautiful display titles
const STAGE_DISPLAY_MAP: Record<string, string> = {
    'ROUND_OF_32': 'Round of 32',
    'ROUND_OF_16': 'Round of 16',
    'QUARTER_FINALS': 'Quarter-Finals',
    'SEMI_FINALS': 'Semi-Finals',
    'FINAL': 'The Grand Final',
    'GROUP_STAGE': 'Group Stage',
};

export default function LeagueMatchGroup({ leagueName, matches }: LeagueMatchGroupProps) {
    const cleanLeagueName = leagueName.replace(' Matches', '');
    const isCup = ['World Cup', 'Euros', 'Champions League', 'Copa America', 'AFCON'].includes(cleanLeagueName);
    
    const normalizeStage = (stage: string) => {
        if (!stage) return '';
        let norm = String(stage).toUpperCase().replace(/-/g, '_').replace(/ /g, '_');
        
        // Map API variations to our standard keys
        if (norm.includes('16TH') || norm.includes('1/16') || norm.includes('LAST_32') || norm.includes('ROUND_OF_32')) {
            return 'ROUND_OF_32';
        }
        if (norm.includes('8TH') || norm.includes('1/8') || norm.includes('LAST_16') || norm.includes('ROUND_OF_16')) {
            return 'ROUND_OF_16';
        }
        if (norm.includes('QUARTER') || norm.includes('1/4') || norm.includes('LAST_8') || norm === 'QF') {
            return 'QUARTER_FINALS';
        }
        if (norm.includes('SEMI') || norm.includes('1/2') || norm.includes('LAST_4') || norm === 'SF') {
            return 'SEMI_FINALS';
        }
        if (norm === 'FINAL' || norm === 'FINALS' || norm === 'F' || norm === 'CHAMPIONSHIP' || norm === 'FINAL_STAGE') {
            return 'FINAL';
        }
        
        return norm;
    };

    const hasRoundOf32 = cleanLeagueName === 'World Cup' || matches.some(m => normalizeStage(m.stage || '') === 'ROUND_OF_32');

    // Filter matches
    const knockoutStages = ['ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL'];
    
    const knockoutMatches = matches.filter(m => {
        const stageUpper = normalizeStage(m.stage || '');
        return knockoutStages.includes(stageUpper);
    });

    const [activeTab, setActiveTab] = useState<'fixtures' | 'bracket'>(
        isCup && knockoutMatches.length > 0 ? 'bracket' : 'fixtures'
    );

    const groupStageMatches = matches.filter(m => {
        const stageUpper = normalizeStage(m.stage || '');
        return !knockoutStages.includes(stageUpper);
    });

    // Group knockout matches by stage
    const groupedKnockout: Record<string, Match[]> = {
        'ROUND_OF_32': [],
        'ROUND_OF_16': [],
        'QUARTER_FINALS': [],
        'SEMI_FINALS': [],
        'FINAL': []
    };

    knockoutMatches.forEach(m => {
        const stageUpper = normalizeStage(m.stage || '');
        if (groupedKnockout[stageUpper]) {
            groupedKnockout[stageUpper].push(m);
        }
    });

    // Sort knockout stage matches chronologically
    Object.keys(groupedKnockout).forEach(key => {
        groupedKnockout[key].sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime());
    });

    // Group group stage/fixtures by date or matchday
    const groupedFixtures: Record<string, Match[]> = {};
    groupStageMatches.forEach(m => {
        // Use group name or date as key
        const key = m.match_group || (m.match_date ? new Date(m.match_date).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }) : 'Scheduled Matches');
        if (!groupedFixtures[key]) groupedFixtures[key] = [];
        groupedFixtures[key].push(m);
    });

    const formatMatchTime = (isoString: string) => {
        if (!isoString) return '';
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getWinnerBadge = (m: Match) => {
        if (!['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED'].includes(m.status)) return null;
        if (m.home_score > m.away_score) return 'home';
        if (m.away_score > m.home_score) return 'away';
        return null;
    };

    return (
        <div className="space-y-6">
            {/* COMPOSITE SELECTOR TABS FOR CUPS */}
            {isCup && knockoutMatches.length > 0 && (
                <div className="flex bg-[#0a1428] p-1 rounded-2xl border border-slate-800 shadow-lg max-w-md mx-auto">
                    <button
                        onClick={() => setActiveTab('bracket')}
                        className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                            activeTab === 'bracket' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <Trophy size={14} className={activeTab === 'bracket' ? 'text-yellow-400' : ''} /> Knockout Bracket
                    </button>
                    <button
                        onClick={() => setActiveTab('fixtures')}
                        className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                            activeTab === 'fixtures' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <Calendar size={14} /> Group Stage & Matches
                    </button>
                </div>
            )}

            {/* BRACKET DISPLAY */}
            {activeTab === 'bracket' && isCup && (
                <div className="w-full overflow-x-auto pb-6 scrollbar-hide select-none rounded-3xl bg-[#0b1329] border border-slate-800 p-4 md:p-6 shadow-2xl">
                    <div className="flex items-center gap-2 mb-6 px-1 border-b border-slate-800 pb-3">
                        <Compass className="text-blue-500 animate-spin" size={16} style={{ animationDuration: '8s' }} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Tournament Bracket Explorer &bull; Scroll Horizontally
                        </span>
                    </div>

                    <div 
                        className="grid gap-4 md:gap-6 px-1 relative"
                        style={{
                            gridTemplateColumns: `repeat(${hasRoundOf32 ? 5 : 4}, minmax(220px, 1fr))`,
                            minWidth: hasRoundOf32 ? '1250px' : '1000px'
                        }}
                    >
                        {/* Column 1: Round of 32 (Optional) */}
                        {hasRoundOf32 && (
                            <div className="space-y-6 flex flex-col justify-around bg-[#0a1428]/45 p-3 rounded-2xl border border-slate-800/60">
                                <div className="text-center bg-slate-900/80 border border-slate-800 rounded-xl py-2 px-3 mb-2 shadow-sm">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 block">Round of 32</span>
                                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block mt-0.5">16 Matchups</span>
                                </div>
                                {groupedKnockout['ROUND_OF_32'].length > 0 ? (
                                    groupedKnockout['ROUND_OF_32'].map((m) => (
                                        <BracketMatchCard key={m.id || m.api_id} match={m} getWinnerBadge={getWinnerBadge} formatMatchTime={formatMatchTime} />
                                    ))
                                ) : (
                                    <BracketPlaceholder count={8} text="Matches to be determined" />
                                )}
                            </div>
                        )}

                        {/* Column 2: Round of 16 */}
                        <div className="space-y-6 flex flex-col justify-around bg-[#0a1428]/45 p-3 rounded-2xl border border-slate-800/60">
                            <div className="text-center bg-slate-900/80 border border-slate-800 rounded-xl py-2 px-3 mb-2 shadow-sm">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 block">Round of 16</span>
                                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block mt-0.5">8 Matchups</span>
                            </div>
                            {groupedKnockout['ROUND_OF_16'].length > 0 ? (
                                groupedKnockout['ROUND_OF_16'].map((m) => (
                                    <BracketMatchCard key={m.id || m.api_id} match={m} getWinnerBadge={getWinnerBadge} formatMatchTime={formatMatchTime} />
                                ))
                            ) : (
                                <BracketPlaceholder count={hasRoundOf32 ? 4 : 8} text="Matches to be announced" />
                            )}
                        </div>

                        {/* Column 3: Quarter-Finals */}
                        <div className="space-y-6 flex flex-col justify-around bg-[#0a1428]/45 p-3 rounded-2xl border border-slate-800/60">
                            <div className="text-center bg-slate-900/80 border border-slate-800 rounded-xl py-2 px-3 mb-2 shadow-sm">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 block">Quarter-Finals</span>
                                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block mt-0.5">4 Matchups</span>
                            </div>
                            {groupedKnockout['QUARTER_FINALS'].length > 0 ? (
                                groupedKnockout['QUARTER_FINALS'].map((m) => (
                                    <BracketMatchCard key={m.id || m.api_id} match={m} getWinnerBadge={getWinnerBadge} formatMatchTime={formatMatchTime} />
                                ))
                            ) : (
                                <BracketPlaceholder count={4} text="TBD" />
                            )}
                        </div>

                        {/* Column 4: Semi-Finals */}
                        <div className="space-y-6 flex flex-col justify-around bg-[#0a1428]/45 p-3 rounded-2xl border border-slate-800/60">
                            <div className="text-center bg-slate-900/80 border border-slate-800 rounded-xl py-2 px-3 mb-2 shadow-sm">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 block">Semi-Finals</span>
                                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block mt-0.5">2 Matchups</span>
                            </div>
                            {groupedKnockout['SEMI_FINALS'].length > 0 ? (
                                groupedKnockout['SEMI_FINALS'].map((m) => (
                                    <BracketMatchCard key={m.id || m.api_id} match={m} getWinnerBadge={getWinnerBadge} formatMatchTime={formatMatchTime} />
                                ))
                            ) : (
                                <BracketPlaceholder count={2} text="TBD" />
                            )}
                        </div>

                        {/* Column 5: Final */}
                        <div className="space-y-6 flex flex-col justify-center bg-[#0d1630]/65 p-4 rounded-2xl border border-yellow-500/15">
                            <div className="text-center bg-yellow-500/10 border border-yellow-500/30 rounded-xl py-2.5 px-3 mb-4 shadow-[0_0_20px_rgba(234,179,8,0.05)]">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-500 flex items-center justify-center gap-1">
                                    <Trophy size={12} className="text-yellow-400" /> Grand Final
                                </span>
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mt-0.5">1 Matchup</span>
                            </div>
                            {groupedKnockout['FINAL'].length > 0 ? (
                                groupedKnockout['FINAL'].map((m) => (
                                    <BracketMatchCard key={m.id || m.api_id} match={m} getWinnerBadge={getWinnerBadge} formatMatchTime={formatMatchTime} isFinal={true} />
                                ))
                            ) : (
                                <BracketPlaceholder count={1} text="TBD" isFinal={true} />
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* NORMAL CHRONOLOGICAL MATCH LISTINGS / FIXTURES */}
            {(activeTab === 'fixtures' || !isCup || knockoutMatches.length === 0) && (
                <div className="space-y-8 animate-in fade-in duration-300">
                    {Object.keys(groupedFixtures).length === 0 ? (
                        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 flex flex-col items-center">
                            <Calendar size={48} className="text-slate-400 mb-4 opacity-50" />
                            <h3 className="text-lg font-black uppercase tracking-tight text-slate-700">No Fixtures Available</h3>
                            <p className="text-slate-500 text-xs font-medium mt-1">There are no matches currently scheduled in this bracket.</p>
                        </div>
                    ) : (
                        Object.keys(groupedFixtures).map((groupKey) => (
                            <div key={groupKey} className="space-y-3.5">
                                <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
                                    <div className="w-1.5 h-4 bg-blue-600 rounded-full"></div>
                                    <h3 className="font-black text-slate-700 uppercase tracking-widest text-[10px] md:text-xs">
                                        {groupKey}
                                    </h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {groupedFixtures[groupKey].map((m) => {
                                        const isLive = ['LIVE', '1H', '2H', 'HT', 'ET', 'P', 'IN_PLAY'].includes(m.status);
                                        const winner = getWinnerBadge(m);

                                        return (
                                            <div 
                                                key={m.id || m.api_id} 
                                                className="bg-white hover:bg-slate-50/50 border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer"
                                            >
                                                <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                                    <span>{m.stage ? STAGE_DISPLAY_MAP[m.stage] || m.stage.replace(/_/g, ' ') : 'Match'}</span>
                                                    {isLive ? (
                                                        <span className="bg-red-500 text-white text-[8px] font-black tracking-widest px-2 py-0.5 rounded-md flex items-center gap-1 animate-pulse">
                                                            <Activity size={10} /> LIVE
                                                        </span>
                                                    ) : (
                                                        <span>{m.match_date ? new Date(m.match_date).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}</span>
                                                    )}
                                                </div>

                                                <div className="my-4 space-y-2.5">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            {m.home_logo ? (
                                                                <img src={m.home_logo} className="w-4.5 h-4.5 object-contain" alt="" />
                                                            ) : (
                                                                <div className="w-4.5 h-4.5 bg-slate-100 rounded-full flex items-center justify-center text-[8px] font-black">H</div>
                                                            )}
                                                            <span className={`text-xs font-black ${winner === 'home' ? 'text-blue-600' : 'text-slate-800'}`}>
                                                                {m.home_team}
                                                            </span>
                                                        </div>
                                                        <span className="text-xs font-black text-slate-900">{m.home_score}</span>
                                                    </div>

                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            {m.away_logo ? (
                                                                <img src={m.away_logo} className="w-4.5 h-4.5 object-contain" alt="" />
                                                            ) : (
                                                                <div className="w-4.5 h-4.5 bg-slate-100 rounded-full flex items-center justify-center text-[8px] font-black">A</div>
                                                            )}
                                                            <span className={`text-xs font-black ${winner === 'away' ? 'text-blue-600' : 'text-slate-800'}`}>
                                                                {m.away_team}
                                                            </span>
                                                        </div>
                                                        <span className="text-xs font-black text-slate-900">{m.away_score}</span>
                                                    </div>
                                                </div>

                                                <div className="border-t border-slate-100 pt-2.5 flex justify-between items-center">
                                                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
                                                        <MapPin size={10} /> {m.venue || 'Stadium Arena'}
                                                    </span>
                                                    <div className="flex gap-1.5">
                                                        <Link 
                                                            href={`/matches?id=${m.api_id || m.id}`}
                                                            className="text-[9px] font-black uppercase text-blue-600 hover:text-blue-700 flex items-center gap-0.5 group-hover:translate-x-1 transition-transform"
                                                        >
                                                            Details <ChevronRight size={10} />
                                                        </Link>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

// Sub-component: Bracket Placeholder Card
function BracketPlaceholder({ count, text, isFinal }: { count: number; text: string; isFinal?: boolean }) {
    return (
        <div className="space-y-4 my-auto w-full">
            {Array.from({ length: count }).map((_, i) => (
                <div 
                    key={i} 
                    className={`rounded-2xl border border-slate-850 bg-[#0c1428]/45 p-4 flex flex-col items-center justify-center text-center opacity-40 select-none ${
                        isFinal ? 'border-dashed border-yellow-500/50 min-h-[110px]' : 'min-h-[85px]'
                    }`}
                >
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-1">MATCH {i + 1}</span>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{text}</span>
                </div>
            ))}
        </div>
    );
}

// Sub-component: Bracket Match Card
function BracketMatchCard({ match, getWinnerBadge, formatMatchTime, isFinal }: { match: Match; getWinnerBadge: (m: Match) => string | null; formatMatchTime: (s: string) => string; isFinal?: boolean }) {
    const isLive = ['LIVE', '1H', '2H', 'HT', 'ET', 'P', 'IN_PLAY'].includes(match.status);
    const winner = getWinnerBadge(match);

    return (
        <div 
            className={`rounded-2xl p-3 shadow-md border bg-[#0a1428] relative overflow-hidden transition-all duration-300 hover:border-blue-500/50 ${
                isFinal 
                    ? 'border-yellow-500/40 bg-gradient-to-br from-[#0c1630] to-[#1e1c25] shadow-[0_4px_30px_rgba(234,179,8,0.15)] ring-1 ring-yellow-500/20' 
                    : 'border-slate-800/80 hover:shadow-[0_4px_25px_rgba(37,99,235,0.15)]'
            }`}
        >
            {/* Ambient decoration */}
            <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-full blur-xl"></div>
            
            <div className="flex justify-between items-center text-[7px] font-black text-slate-500 uppercase tracking-widest mb-2.5">
                <span>{match.match_date ? new Date(match.match_date).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Date TBD'}</span>
                {isLive ? (
                    <span className="bg-red-600 text-white text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest animate-pulse">LIVE</span>
                ) : (
                    <span>{match.match_date ? formatMatchTime(match.match_date) : ''}</span>
                )}
            </div>

            <div className="space-y-2 relative z-10">
                {/* Home Team Row */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 truncate max-w-[80%]">
                        {match.home_logo ? (
                            <img src={match.home_logo} className="w-4 h-4 object-contain" alt="" />
                        ) : (
                            <div className="w-4 h-4 bg-slate-800 rounded-full flex items-center justify-center text-[6px] font-bold">H</div>
                        )}
                        <span className={`text-[10px] font-black truncate ${winner === 'home' ? 'text-yellow-400 font-extrabold' : 'text-slate-300'}`}>
                            {match.home_team}
                        </span>
                    </div>
                    <span className={`text-[10px] font-black ${winner === 'home' ? 'text-yellow-400' : 'text-slate-400'}`}>
                        {match.home_score}
                    </span>
                </div>

                {/* Away Team Row */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 truncate max-w-[80%]">
                        {match.away_logo ? (
                            <img src={match.away_logo} className="w-4 h-4 object-contain" alt="" />
                        ) : (
                            <div className="w-4 h-4 bg-slate-800 rounded-full flex items-center justify-center text-[6px] font-bold">A</div>
                        )}
                        <span className={`text-[10px] font-black truncate ${winner === 'away' ? 'text-yellow-400 font-extrabold' : 'text-slate-300'}`}>
                            {match.away_team}
                        </span>
                    </div>
                    <span className={`text-[10px] font-black ${winner === 'away' ? 'text-yellow-400' : 'text-slate-400'}`}>
                        {match.away_score}
                    </span>
                </div>
            </div>

            {/* Bottom Details Action */}
            <div className="border-t border-slate-800/80 mt-2.5 pt-2 flex items-center justify-between">
                <span className="text-[7px] text-slate-500 font-bold uppercase truncate max-w-[65%]">
                    {match.venue || 'Stadium Arena'}
                </span>
                <Link 
                    href={`/matches?id=${match.api_id || match.id}`}
                    className="text-[7px] font-black uppercase text-blue-400 hover:text-blue-300 flex items-center gap-0.5"
                >
                    Match <ChevronRight size={8} />
                </Link>
            </div>
        </div>
    );
}