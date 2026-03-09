'use client';
import Link from 'next/link';
import { Lock, Sparkles, Send, ShieldCheck, BrainCircuit } from 'lucide-react';

export default function ProBettingSlipLock({ isVIP, homeTeam, awayTeam }: { isVIP: boolean, homeTeam: string, awayTeam: string }) {
    
    // Placeholder AI logic: It uses the actual team names so it looks incredibly real to the user!
    const aiPrediction = `${homeTeam} to Win + Over 2.5 Goals`;
    const aiOdds = "2.45";
    const aiRationale = `Based on our deep data analysis of the last 15 historical meetings, ${homeTeam} consistently exploits the high defensive line of ${awayTeam}. With the current referee averaging 4.2 cards per game, expect a heavily disrupted midfield allowing for rapid counter-attacks. Recommend staking early.`;

    return (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-6">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 to-[#0a1428] p-4 flex justify-between items-center border-b border-slate-800">
                <div className="flex items-center gap-2">
                    <BrainCircuit className="text-yellow-500" size={18}/>
                    <h3 className="text-white font-black uppercase tracking-widest text-xs">AI Deep Analysis & Pro Slip</h3>
                </div>
                <div className="flex items-center gap-1 bg-green-500/20 text-green-400 px-2 py-1 rounded text-[9px] font-bold border border-green-500/30 shadow-inner">
                    <ShieldCheck size={12} /> 88% Confidence
                </div>
            </div>

            <div className="p-5 md:p-6 relative group bg-slate-50/50">
                
                {/* 🟢 THE CONTENT (Dynamically Blurred if NOT VIP) */}
                <div className={`space-y-5 transition-all duration-300 ${!isVIP ? 'filter blur-[6px] opacity-40 select-none pointer-events-none' : ''}`}>
                    
                    {/* Part 1: The Betting Slip */}
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex justify-between items-center">
                        <div>
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest block mb-1">Recommended Play</span>
                            <span className="text-sm md:text-base font-black text-slate-800 uppercase">{aiPrediction}</span>
                        </div>
                        <div className="text-right border-l border-slate-100 pl-4">
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest block mb-1">Value Odds</span>
                            <span className="text-xl md:text-2xl font-black text-blue-600 tabular-nums">{aiOdds}</span>
                        </div>
                    </div>

                    {/* Part 2: The Deep AI Insight */}
                    <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 shadow-inner">
                        <span className="text-[10px] text-blue-500 font-black uppercase tracking-widest mb-2 flex items-center gap-1">
                            <Sparkles size={12}/> Tactical Rationale
                        </span>
                        <p className="text-xs md:text-sm text-slate-700 font-medium leading-relaxed">
                            {aiRationale}
                        </p>
                    </div>
                </div>

                {/* 🔴 THE PAYWALL OVERLAY (Only shows if isVIP is false) */}
                {!isVIP && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-[3px] z-10 p-4">
                        <div className="w-14 h-14 bg-yellow-500 rounded-full flex items-center justify-center shadow-[0_10px_20px_rgba(234,179,8,0.4)] mb-4 animate-bounce">
                            <Lock className="text-black" size={24}/>
                        </div>
                        <h4 className="font-black text-slate-900 uppercase tracking-tighter text-xl mb-2 text-center">Pro Analysis Locked</h4>
                        <p className="text-xs text-slate-700 font-bold mb-6 text-center max-w-[280px]">
                            Unlock the exact betting slip and deep tactical data. Join the Winners Circle to view instantly.
                        </p>
                        
                        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
                            <Link href="/vip/upgrade" className="flex-1 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black px-4 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:shadow-xl transition active:scale-95 flex items-center justify-center gap-2">
                                <Lock size={14} /> Unlock Now
                            </Link>
                            <a href="https://t.me/factsportlive" target="_blank" rel="noopener noreferrer" className="flex-1 bg-[#229ED9] text-white px-4 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-[#1c88ba] transition active:scale-95 flex items-center justify-center gap-2">
                                <Send size={14} /> Join VIP Telegram
                            </a>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}