'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Zap, Target, ArrowRight, ShieldCheck, Cpu, Quote } from 'lucide-react';
import { useSmartInterval } from '@/app/hooks/useSmartInterval';
import { fetchLiveMatchDeduplicated } from '@/app/utils/liveFetcher';

const LIVE_STATUSES = ['LIVE', 'IN_PLAY', 'IN', '1H', '2H', 'HT', 'HALFTIME', 'ET', 'EXTRA TIME', 'P', 'PENALTIES'];
const FINISHED_STATUSES = ['FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD'];

const KNOWN_TEAMS: Record<string, string> = {
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
    'ivory coast': 'CIV', 'cote d\'ivoire': 'CIV',
    'japan': 'JPN',
    'south korea': 'KOR', 'korea republic': 'KOR'
};

const getTla = (name: string) => {
    if (!name) return 'UNK';
    const normalized = name.replace(/['"]/g, '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    if (KNOWN_TEAMS[normalized]) return KNOWN_TEAMS[normalized];
    return name.replace(/ fc| cf| united| city/ig, '').replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
};

export default function BetOfTheDay({ initialMatch }: { initialMatch: any }) {
    const [match, setMatch] = useState(initialMatch);
    const isFetching = useRef(false);

    const fetchUpdates = async () => {
        if (isFetching.current || !match?.espn_id) return;
        const currentStatus = (match.status || '').toUpperCase();
        if (FINISHED_STATUSES.includes(currentStatus)) return;

        isFetching.current = true;
        try {
            const data = await fetchLiveMatchDeduplicated(match.espn_id);
            if (data && !data.error) {
                setMatch((prev: any) => ({
                    ...prev,
                    status: data.status,
                    home_score: data.home_score,
                    away_score: data.away_score,
                    displayClock: data.displayClock
                }));
            }
        } catch (e) {}
        finally {
            isFetching.current = false;
        }
    };

    useEffect(() => { fetchUpdates(); }, []);
    
    const isLive = LIVE_STATUSES.includes((match?.status || '').toUpperCase());
    const isFinished = FINISHED_STATUSES.includes((match?.status || '').toUpperCase());
    
    useSmartInterval(fetchUpdates, isLive ? 10000 : 60000);

    if (!match) return null;

    const aiData = match.pro_analysis;
    const hasAiData = aiData && typeof aiData === 'object' && aiData.primary;

    const primaryBet = hasAiData ? aiData.primary : `${match.home_team} to Win or Draw`;
    const odds = hasAiData ? aiData.odds : 'View Odds';
    const rationale = hasAiData ? aiData.rationale : `Based on recent tactical trends and squad form, ${match.home_team} holds the momentum heading into this crucial fixture.`;

    const cleanHome = encodeURIComponent(match.home_team.replace(/['"]/g, ''));
    const cleanAway = encodeURIComponent(match.away_team.replace(/['"]/g, ''));

    const homeTla = getTla(match.home_team);
    const awayTla = getTla(match.away_team);

    return (
        <div className="bg-gradient-to-br from-[#0f1c3a] to-[#050a14] rounded-2xl shadow-2xl border border-blue-500/30 overflow-hidden relative group mt-8 mb-6 max-w-5xl mx-auto">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 blur-[100px] opacity-10 pointer-events-none group-hover:opacity-20 transition-opacity duration-700"></div>
            
            <div className="px-5 py-3 border-b border-white/5 flex justify-between items-center bg-black/40 backdrop-blur-sm relative z-10">
                <div className="flex items-center gap-2.5">
                    <div className="bg-yellow-500 text-black p-1.5 rounded-lg shadow-[0_0_10px_rgba(234,179,8,0.3)]">
                        <Zap size={14} className="fill-black"/>
                    </div>
                    <h3 className="font-black text-xs md:text-sm text-white uppercase tracking-widest">Free Bet of the Day</h3>
                </div>
                <span className="text-[9px] md:text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-1.5 bg-blue-900/30 px-2.5 py-1 rounded-md border border-blue-500/30">
                    <Cpu size={12} /> AI Verified
                </span>
            </div>

            <div className="p-5 md:p-8 flex flex-col lg:flex-row items-center justify-between gap-8 relative z-10">
                
                {/* MATCHUP VISUAL */}
                <div className="flex flex-col items-center justify-center w-full lg:w-auto shrink-0">
                    {/* Live Clock Injection */}
                    {isLive && (
                        <div className="bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded animate-pulse mb-3 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-white rounded-full"></span> {match.displayClock || 'LIVE'}
                        </div>
                    )}
                    
                    <div className="flex items-center justify-center gap-4 md:gap-8">
                        <Link href={`/matches?team=${cleanHome}`} className="flex flex-col items-center group active:scale-95 transition">
                            {match.home_logo ? <img src={match.home_logo} className="w-14 h-14 md:w-16 md:h-16 object-contain mb-3 drop-shadow-xl group-hover:scale-110 transition"/> : <div className="w-14 h-14 bg-white/10 rounded-full mb-3" />}
                            <span className="text-xs md:text-sm font-black text-white uppercase tracking-wider text-center max-w-[100px] truncate">{homeTla}</span>
                        </Link>
                        
                        <div className="flex flex-col items-center justify-center px-2">
                            {isLive || isFinished ? (
                                <span className="text-2xl md:text-3xl font-black text-yellow-400 drop-shadow-md tabular-nums tracking-widest">
                                    {match.home_score} - {match.away_score}
                                </span>
                            ) : (
                                <span className="text-slate-600 font-black text-lg md:text-xl italic">VS</span>
                            )}
                        </div>

                        <Link href={`/matches?team=${cleanAway}`} className="flex flex-col items-center group active:scale-95 transition">
                            {match.away_logo ? <img src={match.away_logo} className="w-14 h-14 md:w-16 md:h-16 object-contain mb-3 drop-shadow-xl group-hover:scale-110 transition"/> : <div className="w-14 h-14 bg-white/10 rounded-full mb-3" />}
                            <span className="text-xs md:text-sm font-black text-white uppercase tracking-wider text-center max-w-[100px] truncate">{awayTla}</span>
                        </Link>
                    </div>
                </div>

                {/* AI ANALYSIS DATA */}
                <div className="flex-1 w-full flex flex-col items-center lg:items-start">
                    <div className="bg-blue-950/40 border border-blue-500/20 rounded-xl p-4 md:p-5 w-full mb-4 shadow-inner">
                        <div className="flex justify-between items-start mb-3 border-b border-blue-500/20 pb-3">
                            <div>
                                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Elite Prediction</p>
                                <p className="text-white font-black text-sm md:text-base uppercase tracking-tight flex items-center gap-2">
                                    <Target size={16} className="text-yellow-400" /> {primaryBet}
                                </p>
                            </div>
                            {hasAiData && (
                                <div className="bg-[#0a1428] border border-slate-700 px-3 py-1.5 rounded-lg flex flex-col items-center shadow-md shrink-0 ml-4">
                                    <span className="text-[8px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Odds</span>
                                    <span className="text-yellow-400 font-black text-sm">{odds}</span>
                                </div>
                            )}
                        </div>
                        
                        <div className="relative pl-6">
                            <Quote className="absolute left-0 top-0 text-blue-500/30 rotate-180" size={20} />
                            <p className="text-slate-300 text-[11px] md:text-xs font-medium leading-relaxed italic pr-2">
                                {rationale}
                            </p>
                        </div>
                    </div>
                    
                    <a 
                        href="/vip/upgrade" 
                        className="w-full bg-gradient-to-r from-yellow-500 to-yellow-400 hover:from-yellow-400 hover:to-yellow-300 text-black font-black text-xs uppercase tracking-widest py-3.5 md:py-4 rounded-xl shadow-[0_4px_15px_rgba(234,179,8,0.3)] transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        Join Our Winners Circle For More <ArrowRight size={14} />
                    </a>
                </div>
            </div>
        </div>
    );
}