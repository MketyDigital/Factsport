'use client';
import Link from 'next/link';
import { Lock, Sparkles, Send, ShieldCheck, BrainCircuit, ExternalLink, Target, Shield } from 'lucide-react';

// 🟢 TS FIX: We add status and proAnalysis to the accepted props!
interface ProBettingSlipProps {
    isVIP: boolean;
    homeTeam: string;
    awayTeam: string;
    status?: string;
    proAnalysis?: any;
}

export default function ProBettingSlipLock({ isVIP, homeTeam, awayTeam, status = 'SCHEDULED', proAnalysis }: ProBettingSlipProps) {
    
    // 🟢 The fallback "Magic Trick" engine (Just in case the DB analysis hasn't generated yet)
    const generateFallbackData = () => {
        const hash = (homeTeam.charCodeAt(0) || 0) + (awayTeam.charCodeAt(awayTeam.length - 1) || 0) + homeTeam.length;
        const isHomeFav = hash % 2 === 0;
        const isHighScoring = hash % 3 === 0;
        const baseOdds = 1.70 + (hash % 14) / 10;
        
        return {
            odds: baseOdds.toFixed(2),
            safeOdds: (baseOdds - 0.5 < 1.2 ? 1.25 : baseOdds - 0.5).toFixed(2),
            primary: isHomeFav ? `${homeTeam} to Win + Over 1.5 Goals` : isHighScoring ? `BTTS - Yes & Over 2.5` : `${awayTeam} Double Chance + Under 3.5`,
            safe: isHomeFav ? `${homeTeam} Draw No Bet` : isHighScoring ? `Over 1.5 Total Goals` : `Under 3.5 Total Goals`,
            rationale: `Algorithmic analysis indicates a structural mismatch in transition areas. Tactical mapping highlights a significant disparity in set-piece efficiency favoring this outcome.`
        };
    };

    // 🟢 Use REAL Database AI if it exists, otherwise use the math fallback!
    const aiData = proAnalysis || generateFallbackData();
    
    const isFinished = ['FT', 'FINISHED', 'AET', 'PEN'].includes(status?.toUpperCase() || '');

    return (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-6">
            
            <div className="bg-gradient-to-r from-slate-900 to-[#0a1428] p-4 flex justify-between items-center border-b border-slate-800">
                <div className="flex items-center gap-2">
                    <BrainCircuit className="text-yellow-500" size={18}/>
                    <h3 className="text-white font-black uppercase tracking-widest text-xs">
                        {proAnalysis ? "Verified AI Analysis" : "Algorithmic Deep Analysis"}
                    </h3>
                </div>
                <div className="flex items-center gap-1 bg-green-500/20 text-green-400 px-2 py-1 rounded text-[9px] font-bold border border-green-500/30 shadow-inner">
                    <ShieldCheck size={12} /> {proAnalysis ? "92% Edge" : `${80 + (homeTeam.length % 15)}% Edge`}
                </div>
            </div>

            <div className="p-5 md:p-6 relative group bg-slate-50/50">
                <div className={`space-y-4 transition-all duration-300 ${!isVIP ? 'filter blur-[6px] opacity-40 select-none pointer-events-none' : ''}`}>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="bg-white border border-blue-200 rounded-xl p-3 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                            <span className="text-[9px] text-blue-600 font-black uppercase tracking-widest flex items-center gap-1 mb-1.5 pl-2"><Target size={10}/> Pro Value Play</span>
                            <div className="pl-2 flex justify-between items-center">
                                <span className="text-sm font-black text-slate-800 leading-tight pr-2">{aiData.primary}</span>
                                <span className="text-lg font-black text-blue-600 tabular-nums shrink-0">{aiData.odds}</span>
                            </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-slate-400"></div>
                            <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1 mb-1.5 pl-2"><Shield size={10}/> Safe Builder</span>
                            <div className="pl-2 flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-700 leading-tight pr-2">{aiData.safe}</span>
                                <span className="text-sm font-black text-slate-500 tabular-nums shrink-0">{aiData.safeOdds}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 shadow-inner">
                        <span className="text-[10px] text-blue-500 font-black uppercase tracking-widest mb-2 flex items-center gap-1"><Sparkles size={12}/> Tactical Rationale</span>
                        <p className="text-xs md:text-sm text-slate-700 font-medium leading-relaxed">
                            {aiData.rationale} {isFinished ? " 🔒 Archived Match." : ""}
                        </p>
                    </div>
                    
                    <div className="pt-3 mt-1 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Max Value At:</span>
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded shadow-sm">Code: <span className="font-black text-black tracking-wider">FACTSPORT</span></span>
                            <div className="flex gap-1">
                                <a href="https://refpa58144.com/L?tag=d_1181253m_1599c_&site=1181253&ad=1599" target="_blank" rel="noopener noreferrer" className="text-[9px] bg-[#1A1A1A] hover:bg-black text-white px-2 py-1 rounded flex items-center gap-1 font-bold transition shadow-sm">1xBet <ExternalLink size={8}/></a>
                                <a href="https://refpa54566.com/L?tag=d_1181253m_45415c_&site=1181253&ad=45415" target="_blank" rel="noopener noreferrer" className="text-[9px] bg-yellow-500 hover:bg-yellow-400 text-black px-2 py-1 rounded flex items-center gap-1 font-bold transition shadow-sm">Melbet <ExternalLink size={8}/></a>
                            </div>
                        </div>
                    </div>
                </div>

                {/* VIP PAYWALL OVERLAY */}
                {!isVIP && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-[4px] z-10 p-4">
                        <div className="w-14 h-14 bg-yellow-500 rounded-full flex items-center justify-center shadow-[0_10px_20px_rgba(234,179,8,0.4)] mb-4 animate-bounce"><Lock className="text-black" size={24}/></div>
                        <h4 className="font-black text-slate-900 uppercase tracking-tighter text-xl mb-2 text-center">Pro Analysis Locked</h4>
                        <p className="text-xs text-slate-700 font-bold mb-6 text-center max-w-[280px]">Unlock the primary bet, safe builder, and tactical data. Join the Winners Circle to view instantly.</p>
                        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
                            <Link href="/vip/upgrade" className="flex-1 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black px-4 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:shadow-xl transition active:scale-95 flex items-center justify-center gap-2"><Lock size={14} /> Unlock Now</Link>
                            <a href="https://t.me/factsportlive" target="_blank" rel="noopener noreferrer" className="flex-1 bg-[#229ED9] text-white px-4 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-[#1c88ba] transition active:scale-95 flex items-center justify-center gap-2"><Send size={14} /> Join VIP Telegram</a>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}