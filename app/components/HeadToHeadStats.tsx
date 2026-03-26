'use client';
import { useState, useMemo } from 'react';
import { History, CalendarDays, ChevronDown, ChevronUp } from 'lucide-react';

const sanitizeUrl = (url: string | null | undefined) => {
    if (!url) return null;
    if (url.trim().toLowerCase().startsWith('javascript:')) return '#';
    return url;
};

export default function HeadToHeadStats({ dbData }: { dbData: any }) {
    const [isExpanded, setIsExpanded] = useState(false);

    // 🟢 OPTIMIZATION: useMemo prevents the math from re-running when the dropdown is clicked
    const stats = useMemo(() => {
        let parsedH2h = dbData?.h2h;
        if (typeof parsedH2h === 'string') {
            try { parsedH2h = JSON.parse(parsedH2h); } catch (e) { parsedH2h = {}; }
        }

        const h2hObj = parsedH2h?.aggregates || parsedH2h || {};
        const matchesArray = parsedH2h?.matches || [];
        let h2hTotal = h2hObj.numberOfMatches ?? h2hObj.played ?? h2hObj.count ?? 0;
        const homeData = typeof h2hObj.homeTeam === 'object' ? h2hObj.homeTeam : {};
        const awayData = typeof h2hObj.awayTeam === 'object' ? h2hObj.awayTeam : {};

        let h2hHomeWins = Number(homeData.wins ?? h2hObj.homeWins ?? h2hObj.home_wins ?? 0);
        let h2hDraws = Number(homeData.draws ?? h2hObj.draws ?? 0);
        let h2hAwayWins = Number(awayData.wins ?? homeData.losses ?? h2hObj.awayWins ?? h2hObj.away_wins ?? 0);

        if (matchesArray.length > 0) {
            let calcHomeWins = 0, calcDraws = 0, calcAwayWins = 0;
            let validMatchesCount = 0;
            const currentHomeId = homeData?.id;
            const currentAwayId = awayData?.id;
            
            matchesArray.forEach((m: any) => {
                if (m.status !== 'FINISHED' && m.status !== 'AWARDED') return;
                let hScore = m.score?.fullTime?.home ?? m.score?.regularTime?.home;
                let aScore = m.score?.fullTime?.away ?? m.score?.regularTime?.away;
                
                if (typeof hScore === 'number' && typeof aScore === 'number') {
                    validMatchesCount++;
                    let isHome = false;
                    if (currentHomeId && m.homeTeam?.id) {
                        isHome = (m.homeTeam.id === currentHomeId);
                    } else if (currentAwayId && m.homeTeam?.id) {
                        isHome = (m.homeTeam.id !== currentAwayId);
                    } else {
                        const matchHomeName = (m.homeTeam?.shortName || m.homeTeam?.name || '').toLowerCase();
                        const dbHomeName = (dbData?.home_team || '').toLowerCase();
                        isHome = matchHomeName.includes(dbHomeName) || dbHomeName.includes(matchHomeName);
                    }
                    if (hScore === aScore) calcDraws++;
                    else if (hScore > aScore) isHome ? calcHomeWins++ : calcAwayWins++;
                    else isHome ? calcAwayWins++ : calcHomeWins++;
                }
            });

            if (validMatchesCount > 0 && (h2hHomeWins + h2hAwayWins + h2hDraws === 0 || validMatchesCount === matchesArray.length)) {
                h2hHomeWins = calcHomeWins;
                h2hAwayWins = calcAwayWins;
                h2hDraws = calcDraws;
            }
        }

        const actualMathTotal = h2hHomeWins + h2hDraws + h2hAwayWins;
        if (actualMathTotal > 0) h2hTotal = actualMathTotal;

        const barTotal = actualMathTotal || 1;
        const homePct = (h2hHomeWins / barTotal) * 100;
        const drawPct = (h2hDraws / barTotal) * 100;
        const awayPct = (h2hAwayWins / barTotal) * 100;

        const recentMeetings = matchesArray
            .filter((m: any) => m.status === 'FINISHED' || m.status === 'AWARDED')
            .slice(0, 5);

        return {
            h2hTotal, h2hHomeWins, h2hDraws, h2hAwayWins,
            homePct, drawPct, awayPct, recentMeetings,
            isEmpty: h2hTotal === 0
        };
    }, [dbData?.h2h, dbData?.home_team]); // Only re-runs if the database prop changes

    if (stats.isEmpty) return null;

    return (
        <div className="w-full bg-white border-b border-slate-200 px-3 py-3 md:py-4 flex flex-col gap-3 shadow-sm">
            
            <div className="flex items-center gap-1.5">
                <History size={14} className="text-blue-600" />
                <span className="text-[10px] md:text-xs font-black uppercase text-slate-800 tracking-wider">H2H (LAST {stats.h2hTotal})</span>
            </div>
            
            <div className="flex items-center justify-between text-[11px] md:text-xs font-black px-1">
                <div className="flex items-center justify-between w-[33%] pr-2">
                    <div className="flex items-center gap-1.5">
                        {dbData?.home_logo && <img src={sanitizeUrl(dbData.home_logo) || undefined} className="w-4 h-4 md:w-5 md:h-5 object-contain" alt="" />}
                        <span className="truncate text-slate-900">{dbData?.home_team?.substring(0,3).toUpperCase()}</span>
                    </div>
                    <span className="text-blue-600 text-sm md:text-base">{stats.h2hHomeWins}</span>
                </div>
                
                <div className="w-[33%] flex items-center justify-center gap-1.5 text-center">
                    <span className="text-slate-400 text-[9px] md:text-[10px] uppercase">DRAW</span>
                    <span className="text-slate-600 text-sm md:text-base">{stats.h2hDraws}</span>
                </div>
                
                <div className="flex items-center justify-between w-[33%] pl-2">
                    <span className="text-red-500 text-sm md:text-base">{stats.h2hAwayWins}</span>
                    <div className="flex items-center gap-1.5">
                        <span className="truncate text-slate-900">{dbData?.away_team?.substring(0,3).toUpperCase()}</span>
                        {dbData?.away_logo && <img src={sanitizeUrl(dbData.away_logo) || undefined} className="w-4 h-4 md:w-5 md:h-5 object-contain" alt="" />}
                    </div>
                </div>
            </div>

            <div className="flex w-full h-2 rounded-full overflow-hidden bg-slate-200 mt-1">
                <div style={{ width: `${stats.homePct}%` }} className="bg-blue-600 transition-all duration-1000"></div>
                <div style={{ width: `${stats.drawPct}%` }} className="bg-slate-300 transition-all duration-1000"></div>
                <div style={{ width: `${stats.awayPct}%` }} className="bg-red-500 transition-all duration-1000"></div>
            </div>

            {/* 🟢 THE DROPDOWN TOGGLE */}
            {stats.recentMeetings.length > 0 && (
                <div className="mt-1 flex flex-col">
                    <button 
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="flex items-center justify-between w-full py-2 px-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                    >
                        <span>Recent Meetings</span>
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>

                    {isExpanded && (
                        <div className="flex flex-col gap-1.5 mt-1 animate-in fade-in slide-in-from-top-2 duration-300">
                            {stats.recentMeetings.map((match: any, idx: number) => {
                                const mDate = new Date(match.utcDate || match.match_date);
                                const formattedDate = mDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
                                const hName = match.homeTeam?.shortName || match.homeTeam?.name || 'Home';
                                const aName = match.awayTeam?.shortName || match.awayTeam?.name || 'Away';
                                const hScore = match.score?.fullTime?.home ?? match.score?.regularTime?.home ?? '-';
                                const aScore = match.score?.fullTime?.away ?? match.score?.regularTime?.away ?? '-';

                                return (
                                    <div key={idx} className="flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors p-2 rounded-lg text-[10px] md:text-xs">
                                        <div className="w-[20%] text-slate-400 font-bold flex items-center gap-1">
                                            <CalendarDays size={10} /> <span className="hidden md:inline">{formattedDate}</span><span className="md:hidden">{formattedDate.replace(/ /g, '/')}</span>
                                        </div>
                                        <div className="w-[30%] text-right font-bold text-slate-700 truncate pr-2">{hName}</div>
                                        <div className="w-[15%] flex justify-center">
                                            <div className="bg-slate-800 text-white font-black px-2 py-0.5 rounded shadow-sm tracking-widest text-[9px] md:text-[10px]">
                                                {hScore} - {aScore}
                                            </div>
                                        </div>
                                        <div className="w-[30%] text-left font-bold text-slate-700 truncate pl-2">{aName}</div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}