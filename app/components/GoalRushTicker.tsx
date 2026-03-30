'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Activity } from 'lucide-react';
import { useSmartInterval } from '@/app/hooks/useSmartInterval';
import { fetchLiveMatchDeduplicated } from '@/app/utils/liveFetcher';

const LIVE_STATUSES = ['LIVE', 'IN_PLAY', 'IN', '1H', '2H', 'HT', 'HALFTIME', 'ET', 'EXTRA TIME', 'P', 'PENALTIES'];
const FINISHED_STATUSES = ['FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD'];

// 🟢 COMPREHENSIVE PREMIUM BROADCAST DICTIONARY
const TEAM_ABBREVIATIONS: Record<string, string> = {
    'manchester city': 'MCI', 'man city': 'MCI', 'm. city': 'MCI',
    'manchester united': 'MUN', 'man united': 'MUN', 'man utd': 'MUN',
    'arsenal': 'ARS', 'arsenal fc': 'ARS',
    'chelsea': 'CHE', 'chelsea fc': 'CHE',
    'liverpool': 'LIV', 'liverpool fc': 'LIV',
    'tottenham hotspur': 'TOT', 'tottenham': 'TOT', 'spurs': 'TOT',
    'newcastle united': 'NEW', 'newcastle': 'NEW', 'newcastle utd': 'NEW',
    'aston villa': 'AVL', 'villa': 'AVL',
    'west ham united': 'WHU', 'west ham': 'WHU',
    'brighton & hove albion': 'BHA', 'brighton': 'BHA', 'brighton hove': 'BHA',
    'wolverhampton wanderers': 'WOL', 'wolverhampton': 'WOL', 'wolves': 'WOL',
    'nottingham forest': 'NFO', 'nottm forest': 'NFO', 'nottingham': 'NFO',
    'leicester city': 'LEI', 'leicester': 'LEI',
    'everton': 'EVE', 'everton fc': 'EVE',
    'crystal palace': 'CRY', 'palace': 'CRY',
    'brentford': 'BRE', 'brentford fc': 'BRE',
    'fulham': 'FUL', 'fulham fc': 'FUL',
    'afc bournemouth': 'BOU', 'bournemouth': 'BOU',
    'southampton': 'SOU', 'saints': 'SOU',
    'ipswich town': 'IPS', 'ipswich': 'IPS',
    'real madrid': 'RMA', 'madrid': 'RMA',
    'barcelona': 'BAR', 'barca': 'BAR', 'fc barcelona': 'BAR',
    'atletico madrid': 'ATM', 'atlético': 'ATM', 'atletico': 'ATM', 'atlético de madrid': 'ATM',
    'athletic club': 'ATH', 'athletic bilbao': 'ATH', 'athletic': 'ATH',
    'real sociedad': 'RSO', 'sociedad': 'RSO',
    'real betis': 'BET', 'betis': 'BET',
    'sevilla': 'SEV', 'sevilla fc': 'SEV',
    'valencia': 'VAL', 'valencia cf': 'VAL',
    'villarreal': 'VIL', 'villarreal cf': 'VIL',
    'celta vigo': 'CEL', 'celta': 'CEL', 'celta de vigo': 'CEL',
    'girona': 'GIR', 'girona fc': 'GIR',
    'osasuna': 'OSA', 'ca osasuna': 'OSA',
    'mallorca': 'MLL', 'rcd mallorca': 'MLL',
    'juventus': 'JUV', 'juve': 'JUV',
    'ac milan': 'MIL', 'milan': 'MIL',
    'inter milan': 'INT', 'inter': 'INT', 'internazionale': 'INT',
    'ssc napoli': 'NAP', 'napoli': 'NAP',
    'as roma': 'ROM', 'roma': 'ROM',
    'ss lazio': 'LAZ', 'lazio': 'LAZ',
    'atalanta': 'ATA', 'atalanta bc': 'ATA',
    'fiorentina': 'FIO', 'acf fiorentina': 'FIO',
    'bologna': 'BOL', 'bologna fc': 'BOL',
    'torino': 'TOR', 'torino fc': 'TOR',
    'bayern munich': 'BAY', 'bayern': 'BAY', 'fc bayern': 'BAY', 'bayern münchen': 'BAY',
    'borussia dortmund': 'BVB', 'dortmund': 'BVB',
    'bayer 04 leverkusen': 'B04', 'leverkusen': 'B04', 'bayer leverkusen': 'B04',
    'rb leipzig': 'RBL', 'leipzig': 'RBL',
    'eintracht frankfurt': 'SGE', 'frankfurt': 'SGE', 'eintracht': 'SGE',
    'borussia monchengladbach': 'BMG', 'gladbach': 'BMG', 'mgladbach': 'BMG', 'mönchengladbach': 'BMG',
    'vfb stuttgart': 'VFB', 'stuttgart': 'VFB',
    'wolfsburg': 'WOB', 'vfl wolfsburg': 'WOB',
    'sc freiburg': 'SCF', 'freiburg': 'SCF',
    'union berlin': 'FCU', 'fc union berlin': 'FCU',
    'paris saint germain': 'PSG', 'psg': 'PSG', 'paris sg': 'PSG', 'paris saint-germain': 'PSG',
    'olympique de marseille': 'MAR', 'marseille': 'MAR', 'om': 'MAR',
    'olympique lyonnais': 'LYO', 'lyon': 'LYO', 'ol': 'LYO',
    'as monaco': 'ASM', 'monaco': 'ASM',
    'lille osc': 'LOSC', 'lille': 'LOSC',
    'rc lens': 'RCL', 'lens': 'RCL',
    'ogc nice': 'OGCN', 'nice': 'OGCN',
    'ajax': 'AJA', 'afc ajax': 'AJA',
    'psv eindhoven': 'PSV', 'psv': 'PSV',
    'feyenoord': 'FEY',
    'sporting cp': 'SCP', 'sporting': 'SCP', 'sporting lisbon': 'SCP',
    'sl benfica': 'SLB', 'benfica': 'SLB',
    'fc porto': 'FCP', 'porto': 'FCP',
    'celtic': 'CEL', 'celtic fc': 'CEL',
    'rangers': 'RAN', 'rangers fc': 'RAN',
    'galatasaray': 'GAL', 'galatasaray sk': 'GAL',
    'fenerbahce': 'FEN', 'fenerbahçe': 'FEN',
    'besiktas': 'BES', 'beşiktaş': 'BES',
    'argentina': 'ARG',
    'brazil': 'BRA', 'brasil': 'BRA',
    'france': 'FRA',
    'england': 'ENG',
    'spain': 'ESP', 'españa': 'ESP',
    'germany': 'GER', 'deutschland': 'GER',
    'italy': 'ITA', 'italia': 'ITA',
    'portugal': 'POR',
    'netherlands': 'NED', 'holland': 'NED',
    'belgium': 'BEL',
    'croatia': 'CRO',
    'uruguay': 'URU',
    'colombia': 'COL',
    'united states': 'USA', 'usa': 'USA', 'usmnt': 'USA',
    'mexico': 'MEX',
    'nigeria': 'NGA', 'super eagles': 'NGA',
    'senegal': 'SEN',
    'morocco': 'MAR',
    'egypt': 'EGY',
    'ghana': 'GHA',
    'ivory coast': 'CIV', "cote d'ivoire": 'CIV',
    'japan': 'JPN',
    'south korea': 'KOR', 'korea republic': 'KOR'
};

const getShortName = (name: string) => {
    if (!name) return 'TBA';
    const normalizedName = name.toLowerCase().trim();
    
    // Check dictionary first
    if (TEAM_ABBREVIATIONS[normalizedName]) {
        return TEAM_ABBREVIATIONS[normalizedName];
    }
    
    // Smart Fallback if not in dictionary
    return name.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 3);
};

// 🟢 LIGHTWEIGHT TICKER ITEM
function TickerItem({ initialMatch }: { initialMatch: any }) {
    const [match, setMatch] = useState(initialMatch);
    const isFetching = useRef(false);

    const fetchUpdates = async () => {
        if (isFetching.current || !match.espn_id) return;
        if (FINISHED_STATUSES.includes((match.status || '').toUpperCase())) return;

        isFetching.current = true;
        try {
            const data = await fetchLiveMatchDeduplicated(match.espn_id);
            if (data && !data.error) {
                setMatch((prev: any) => ({ ...prev, status: data.status, home_score: data.home_score, away_score: data.away_score, displayClock: data.displayClock }));
            }
        } catch (e) {} finally {
            isFetching.current = false;
        }
    };

    useEffect(() => { setMatch(initialMatch); }, [initialMatch]);

    const status = (match.status || '').toUpperCase();
    const isLive = LIVE_STATUSES.includes(status);
    const isFinished = FINISHED_STATUSES.includes(status);
    const isScheduled = !isLive && !isFinished;

    // 🟢 Fast 30-second polling for live matches. Safe because of Deduplicator!
    useSmartInterval(fetchUpdates, isLive ? 30000 : null);

    return (
        <div className="flex items-center mx-3 md:mx-4 shrink-0">
            <Link href={`/match/${match.id}`} className="flex items-center group hover:opacity-75 transition-opacity">
                {isLive && <span className="w-1 h-1 bg-red-500 rounded-full animate-pulse mr-1.5 shadow-[0_0_5px_rgba(239,68,68,0.8)]"></span>}
                
                <div className="flex items-center gap-1.5">
                    <span className="text-white font-bold text-[8px] md:text-[9px] uppercase tracking-wider">{getShortName(match.home_team)}</span>
                    
                    {isScheduled ? (
                        <span className="text-slate-400 font-bold text-[7px] md:text-[8px] bg-white/10 px-1 py-0.5 rounded leading-none">
                            {new Date(match.match_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    ) : (
                        <div className="flex items-center gap-1 bg-black/40 px-1.5 py-0.5 rounded shadow-inner leading-none">
                            <span className={`font-black text-[9px] md:text-[10px] ${isLive ? 'text-yellow-400' : 'text-white'}`}>{match.home_score}</span>
                            <span className="text-slate-500 text-[8px]">-</span>
                            <span className={`font-black text-[9px] md:text-[10px] ${isLive ? 'text-yellow-400' : 'text-white'}`}>{match.away_score}</span>
                        </div>
                    )}

                    <span className="text-white font-bold text-[8px] md:text-[9px] uppercase tracking-wider">{getShortName(match.away_team)}</span>
                    
                    {isLive && <span className="text-red-400 font-black text-[7px] md:text-[8px] ml-1 tracking-tighter">{match.displayClock || 'LIVE'}</span>}
                    {isFinished && <span className="text-slate-500 font-black text-[7px] md:text-[8px] ml-1">FT</span>}
                </div>
            </Link>
            <span className="text-white/10 ml-3 md:ml-4 font-black text-[8px]">|</span>
        </div>
    );
}

// 🟢 MAIN TICKER CONTAINER
export default function GoalRushTicker({ allMatches, currentMatchId }: { allMatches: any[], currentMatchId: string }) {
    const [tickerData, setTickerData] = useState<any[]>([]);

    useEffect(() => {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

        let todaysMatches = allMatches.filter(m => {
            if (m.id === currentMatchId) return false; 
            const matchTime = new Date(m.match_date).getTime();
            const isLive = LIVE_STATUSES.includes((m.status || '').toUpperCase());
            return isLive || (matchTime >= startOfDay && matchTime <= endOfDay);
        });

        todaysMatches.sort((a, b) => {
            const aLive = LIVE_STATUSES.includes((a.status || '').toUpperCase());
            const bLive = LIVE_STATUSES.includes((b.status || '').toUpperCase());
            if (aLive && !bLive) return -1;
            if (!aLive && bLive) return 1;
            return new Date(a.match_date).getTime() - new Date(b.match_date).getTime();
        });

        todaysMatches = todaysMatches.slice(0, 15);
        setTickerData([...todaysMatches, ...todaysMatches]);
    }, [allMatches, currentMatchId]);

    if (tickerData.length === 0) return null;

    return (
        // 🟢 h-6 is extremely slim (24px). Zero vertical padding.
        <div className="bg-[#050a14] border-b border-white/10 h-6 md:h-8 flex items-center overflow-hidden relative z-40 shadow-sm m-0 p-0">
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes goal-rush-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
                /* 🟢 Pauses animation instantly when touched or hovered */
                .animate-goal-rush { display: flex; width: max-content; animation: goal-rush-scroll 90s linear infinite; }
                .animate-goal-rush:hover, .animate-goal-rush:active { animation-play-state: paused; }
            `}} />

            {/* Sticky Label */}
            <div className="absolute left-0 h-full bg-gradient-to-r from-blue-700 to-blue-900 px-2 md:px-3 flex items-center z-20 shadow-[2px_0_10px_rgba(0,0,0,0.8)] border-r border-blue-500/50 whitespace-nowrap">
                <Activity size={10} className="mr-1 text-yellow-400 animate-pulse" />
                <span className="text-white font-black text-[7px] md:text-[8px] uppercase tracking-widest italic">Goal Rush</span>
            </div>

            <div className="absolute left-[65px] md:left-[80px] w-6 h-full bg-gradient-to-r from-[#050a14] to-transparent z-10 pointer-events-none"></div>

            {/* Scrolling Content */}
            <div className="w-full h-full overflow-hidden flex pl-[70px] md:pl-[90px] overflow-x-auto scrollbar-hide">
                <div className="animate-goal-rush flex items-center h-full">
                    {tickerData.map((match, i) => (
                        <TickerItem key={`${match.id}-${i}`} initialMatch={match} />
                    ))}
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{__html: `.scrollbar-hide::-webkit-scrollbar { display: none; } .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }`}} />
        </div>
    );
}