'use client';
import { History } from 'lucide-react';

export default function HeadToHeadStats({ dbData }: { dbData: any }) {
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
    if (h2hTotal === 0) return null;

    const barTotal = actualMathTotal || 1;
    const homePct = (h2hHomeWins / barTotal) * 100;
    const drawPct = (h2hDraws / barTotal) * 100;
    const awayPct = (h2hAwayWins / barTotal) * 100;

    return (
        <div className="bg-white rounded-lg shadow-sm p-3 border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                    <History size={12} className="text-blue-600" />
                    <span className="text-[10px] md:text-xs font-black uppercase text-slate-800 tracking-wider">H2H (Last {h2hTotal})</span>
                </div>
                
                <div className="flex items-center gap-3 text-[11px] md:text-xs font-black">
                    <span className="text-blue-600 flex items-center gap-1">
                        {dbData?.home_team?.substring(0,3).toUpperCase()} <span className="text-sm md:text-base">{h2hHomeWins}</span>
                    </span>
                    <span className="text-slate-400 text-[9px] md:text-[10px] uppercase">Draw <span className="text-sm md:text-base text-slate-500">{h2hDraws}</span></span>
                    <span className="text-red-500 flex items-center gap-1">
                        <span className="text-sm md:text-base">{h2hAwayWins}</span> {dbData?.away_team?.substring(0,3).toUpperCase()}
                    </span>
                </div>
            </div>

            <div className="flex w-full h-2 rounded-full overflow-hidden bg-slate-100">
                <div style={{ width: `${homePct}%` }} className="bg-blue-600 transition-all duration-1000"></div>
                <div style={{ width: `${drawPct}%` }} className="bg-slate-300 transition-all duration-1000"></div>
                <div style={{ width: `${awayPct}%` }} className="bg-red-500 transition-all duration-1000"></div>
            </div>
        </div>
    );
}