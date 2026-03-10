'use client';
import Link from 'next/link';
import { Lock, Sparkles, Send, ShieldCheck, BrainCircuit, ExternalLink, Target, Shield } from 'lucide-react';

interface ProBettingSlipProps {
    isVIP: boolean;
    homeTeam: string;
    awayTeam: string;
    status?: string;
    proAnalysis?: any;
}

export default function ProBettingSlipLock({ isVIP, homeTeam, awayTeam, status = 'SCHEDULED', proAnalysis }: ProBettingSlipProps) {
    
    const currentStatus = status?.toUpperCase() || '';
    const isScheduled = ['SCHEDULED', 'PRE'].includes(currentStatus);
    const isFinished = ['FT', 'FINISHED', 'AET', 'PEN', 'ABD'].includes(currentStatus);

    if (!proAnalysis || Object.keys(proAnalysis).length === 0) {
        if (isScheduled) {
            return (
                <div className="bg-white border border-slate-200 rounded-xl p-4 md:p-6 text-center shadow-sm flex flex-col items-center justify-center">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-50 rounded-full flex items-center justify-center shadow-inner border border-blue-100 mb-2 md:mb-3 relative">
                        <BrainCircuit className="text-blue-500 relative z-10" size={18} />
                        <div className="absolute inset-0 border-2 border-blue-400 rounded-full animate-ping opacity-20"></div>
                    </div>
                    <h4 className="text-slate-800 font-black uppercase tracking-widest text-[10px] md:text-xs mb-1">AI Analysis Pending</h4>
                    <p className="text-[9px] md:text-[10px] font-bold text-slate-500 max-w-[250px] leading-snug md:leading-relaxed">
                        Our tactical engine is gathering the latest squad data and H2H metrics.
                    </p>
                </div>
            );
        }
        return null; 
    }

    return (
        <div className="bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 to-[#0a1428] p-2.5 md:p-4 flex justify-between items-center border-b border-slate-800">
                <div className="flex items-center gap-1.5 md:gap-2">
                    <BrainCircuit className="text-yellow-500" size={16}/>
                    <h3 className="text-white font-black uppercase tracking-widest text-[10px] md:text-xs">
                        Verified AI Analysis
                    </h3>
                </div>
                <div className="flex items-center gap-1 bg-green-500/20 text-green-400 px-1.5 py-0.5 md:px-2 md:py-1 rounded text-[8px] md:text-[9px] font-bold border border-green-500/30 shadow-inner">
                    <ShieldCheck className="w-2.5 h-2.5 md:w-3 md:h-3" /> 92% Edge
                </div>
            </div>

            {/* The Content (Blurred for non-VIPs) */}
            <div className="p-3 md:p-5 relative group bg-slate-50/50">
                <div className={`space-y-2.5 md:space-y-4 transition-all duration-300 ${!isVIP ? 'filter blur-[5px] opacity-40 select-none pointer-events-none' : ''}`}>
                    
                    {/* The Bets */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                        <div className="bg-white border border-blue-200 rounded-lg p-2 md:p-3 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                            <span className="text-[8px] md:text-[9px] text-blue-600 font-black uppercase tracking-widest flex items-center gap-1 mb-1 md:mb-1.5 pl-2"><Target size={10}/> Pro Value Play</span>
                            <div className="pl-2 flex justify-between items-center">
                                <span className="text-xs md:text-sm font-black text-slate-800 leading-tight pr-2">{proAnalysis.primary}</span>
                                <span className="text-base md:text-lg font-black text-blue-600 tabular-nums shrink-0">{proAnalysis.odds}</span>
                            </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-lg p-2 md:p-3 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-slate-400"></div>
                            <span className="text-[8px] md:text-[9px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1 mb-1 md:mb-1.5 pl-2"><Shield size={10}/> Safe Builder</span>
                            <div className="pl-2 flex justify-between items-center">
                                <span className="text-[10px] md:text-xs font-bold text-slate-700 leading-tight pr-2">{proAnalysis.safe}</span>
                                <span className="text-xs md:text-sm font-black text-slate-500 tabular-nums shrink-0">{proAnalysis.safeOdds}</span>
                            </div>
                        </div>
                    </div>

                    {/* The Rationale */}
                    <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-2.5 md:p-4 shadow-inner">
                        <span className="text-[9px] md:text-[10px] text-blue-500 font-black uppercase tracking-widest mb-1.5 flex items-center gap-1"><Sparkles size={10}/> Tactical Rationale</span>
                        <p className="text-[10px] md:text-xs text-slate-700 font-medium leading-snug md:leading-relaxed">
                            {proAnalysis.rationale} {isFinished ? " 🔒 Archived Match." : ""}
                        </p>
                    </div>
                    
                    {/* Tiny Affiliates */}
                    <div className="pt-2 md:pt-3 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-slate-400">Max Value At:</span>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[8px] md:text-[9px] font-bold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-sm">Code: <span className="font-black text-black tracking-wider">FACTSPORT</span></span>
                            <div className="flex gap-1">
                                <a href="https://refpa58144.com/L?tag=d_1181253m_1599c_&site=1181253&ad=1599" target="_blank" rel="noopener noreferrer" className="text-[8px] bg-[#1A1A1A] hover:bg-black text-white px-1.5 py-0.5 rounded flex items-center gap-1 font-bold transition shadow-sm">1xBet <ExternalLink size={8}/></a>
                                <a href="https://refpa54566.com/L?tag=d_1181253m_45415c_&site=1181253&ad=45415" target="_blank" rel="noopener noreferrer" className="text-[8px] bg-yellow-500 hover:bg-yellow-400 text-black px-1.5 py-0.5 rounded flex items-center gap-1 font-bold transition shadow-sm">Melbet <ExternalLink size={8}/></a>
                            </div>
                        </div>
                    </div>
                </div>

                {/* VIP PAYWALL OVERLAY */}
                {!isVIP && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-[4px] z-10 p-3">
                        <div className="w-10 h-10 md:w-14 md:h-14 bg-yellow-500 rounded-full flex items-center justify-center shadow-[0_10px_20px_rgba(234,179,8,0.4)] mb-2 md:mb-4 animate-bounce"><Lock className="w-[18px] h-[18px] md:w-6 md:h-6 text-black" /></div>
                        <h4 className="font-black text-slate-900 uppercase tracking-tighter text-sm md:text-xl mb-1 md:mb-2 text-center">Pro Analysis Locked</h4>
                        <p className="text-[9px] md:text-xs text-slate-700 font-bold mb-3 md:mb-6 text-center max-w-[260px] leading-tight">Unlock the primary bet, safe builder, and tactical data.</p>
                        <div className="flex flex-row gap-2 w-full max-w-sm">
                            <Link href="/vip/upgrade" className="flex-1 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black px-2 py-2 md:py-3.5 rounded-lg font-black text-[9px] md:text-[10px] uppercase tracking-widest shadow-lg hover:shadow-xl transition active:scale-95 flex items-center justify-center gap-1.5"><Lock size={12} /> Unlock Now</Link>
                            <a href="https://t.me/factsportlive" target="_blank" rel="noopener noreferrer" className="flex-1 bg-[#229ED9] text-white px-2 py-2 md:py-3.5 rounded-lg font-black text-[9px] md:text-[10px] uppercase tracking-widest shadow-lg hover:bg-[#1c88ba] transition active:scale-95 flex items-center justify-center gap-1.5"><Send size={12} /> VIP Telegram</a>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}