'use client';

import { History } from 'lucide-react';

const sanitizeUrl = (url: string | null | undefined) => {
    if (!url) return null;
    if (url.trim().toLowerCase().startsWith('javascript:')) return '#';
    return url;
};

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
                    const dbHomeName = (dbData.home_team || '').toLowerCase();
                    isHome = matchHomeName.includes(dbHomeName) || dbHomeName.includes(matchHomeName);
                }

                if (hScore === aScore) {
                    calcDraws++;
                } else if (hScore > aScore) {
                    isHome ? calcHomeWins++ : calcAwayWins++;
                } else {
                    isHome ? calcAwayWins++ : calcHomeWins++;
                }
            }
        });

        if (validMatchesCount > 0 && (h2hHomeWins + h2hAwayWins + h2hDraws === 0 || validMatchesCount === matchesArray.length)) {
            h2hHomeWins = calcHomeWins;
            h2hAwayWins = calcAwayWins;
            h2hDraws = calcDraws;
        }
    }

    const actualMathTotal = h2hHomeWins + h2hDraws + h2hAwayWins;
    if (actualMathTotal > 0) {
        h2hTotal = actualMathTotal;
    }

    if (h2hTotal === 0) return null;

    const barTotal = actualMathTotal || 1;
    const homePct = (h2hHomeWins / barTotal) * 100;
    const drawPct = (h2hDraws / barTotal) * 100;
    const awayPct = (h2hAwayWins / barTotal) * 100;

    return (
        <div className="bg-white rounded-xl shadow-md p-3 md:p-4 border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] md:text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                    <History size={12} className="text-blue-600" /> Head-to-Head
                </h3>
                <span className="text-[8px] md:text-[9px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded tracking-widest">
                    LAST {h2hTotal}
                </span>
            </div>
            
            <div className="flex items-center justify-between mb-3">
                 <div className="flex flex-col items-center flex-1">
                     {dbData.home_logo && <img src={sanitizeUrl(dbData.home_logo) || undefined} className="w-6 h-6 md:w-8 md:h-8 object-contain mb-1 drop-shadow-sm" alt="Home" />}
                     <span className="text-xl md:text-2xl font-black text-slate-800 leading-none">{h2hHomeWins}</span>
                     <span className="text-[8px] font-bold text-slate-400 uppercase mt-0.5 text-center line-clamp-1 w-full px-1">{dbData.home_team}</span>
                 </div>
                 
                 <div className="flex flex-col items-center flex-1 border-x border-slate-100 px-1">
                     <div className="w-6 h-6 flex items-center justify-center mb-1">
                         <span className="text-slate-200 font-black text-sm italic">VS</span>
                     </div>
                     <span className="text-lg md:text-xl font-black text-slate-400 leading-none">{h2hDraws}</span>
                     <span className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">Draws</span>
                 </div>

                 <div className="flex flex-col items-center flex-1">
                     {dbData.away_logo && <img src={sanitizeUrl(dbData.away_logo) || undefined} className="w-6 h-6 md:w-8 md:h-8 object-contain mb-1 drop-shadow-sm" alt="Away" />}
                     <span className="text-xl md:text-2xl font-black text-slate-800 leading-none">{h2hAwayWins}</span>
                     <span className="text-[8px] font-bold text-slate-400 uppercase mt-0.5 text-center line-clamp-1 w-full px-1">{dbData.away_team}</span>
                 </div>
            </div>

            <div className="relative pt-1">
                <div className="flex mb-1 items-center justify-between text-[8px] md:text-[9px] font-black">
                    <span className="text-blue-600">{homePct.toFixed(0)}%</span>
                    <span className="text-slate-400">{drawPct.toFixed(0)}%</span>
                    <span className="text-red-500">{awayPct.toFixed(0)}%</span>
                </div>
                <div className="flex w-full h-2 rounded-full overflow-hidden shadow-inner bg-slate-100">
                    <div style={{ width: `${homePct}%` }} className="bg-blue-600 transition-all duration-1000 ease-out relative">
                        <div className="absolute inset-0 bg-white/20 w-full h-full"></div>
                    </div>
                    <div style={{ width: `${drawPct}%` }} className="bg-slate-300 transition-all duration-1000 ease-out"></div>
                    <div style={{ width: `${awayPct}%` }} className="bg-red-500 transition-all duration-1000 ease-out relative">
                        <div className="absolute inset-0 bg-white/20 w-full h-full"></div>
                    </div>
                </div>
            </div>
        </div>
    );
}