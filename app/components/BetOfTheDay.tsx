'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Zap, Target, ArrowRight, ShieldCheck, Cpu, Quote } from 'lucide-react';
import { useSmartInterval } from '@/app/hooks/useSmartInterval';
import { fetchLiveMatchDeduplicated } from '@/app/utils/liveFetcher';

const LIVE_STATUSES = ['LIVE', 'IN_PLAY', 'IN', '1H', '2H', 'HT', 'HALFTIME', 'ET', 'EXTRA TIME', 'P', 'PENALTIES'];
const FINISHED_STATUSES = ['FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD'];

export default function BetOfTheDay({ initialMatch }: { initialMatch: any }) {
    const [match, setMatch] = useState(initialMatch);
    const isFetching = useRef(false);

    // 🟢 SAFE LIVE POLLING: Keeps the score updated if the match is live
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
                            <span className="text-xs md:text-sm font-black text-white uppercase tracking-wider text-center max-w-[100px] truncate">{match.home_team.substring(0, 3)}</span>
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
                            <span className="text-xs md:text-sm font-black text-white uppercase tracking-wider text-center max-w-[100px] truncate">{match.away_team.substring(0, 3)}</span>
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
                        href={match.affiliate_link || "https://refpa58144.com/L?tag=d_1181253m_1599c_&site=1181253&ad=1599"} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="w-full bg-gradient-to-r from-yellow-500 to-yellow-400 hover:from-yellow-400 hover:to-yellow-300 text-black font-black text-xs uppercase tracking-widest py-3.5 md:py-4 rounded-xl shadow-[0_4px_15px_rgba(234,179,8,0.3)] transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        Unlock VIP Bets & Play Now <ArrowRight size={14} />
                    </a>
                </div>
            </div>
        </div>
    );
}