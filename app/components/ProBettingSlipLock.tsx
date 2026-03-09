'use client';
import Link from 'next/link';
import { Lock, Sparkles, Send, ShieldCheck, Ticket } from 'lucide-react';

export default function ProBettingSlipLock({ homeTeam, awayTeam }: { homeTeam: string, awayTeam: string }) {
    // In the future, you can pass `isVIP` to this component to unblur it for logged-in VIPs.
    // For now, it acts as a massive public billboard to drive Telegram conversions.
    const isVIP = false; 

    return (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-6">
            <div className="bg-gradient-to-r from-slate-900 to-[#0a1428] p-4 flex justify-between items-center border-b border-slate-800">
                <div className="flex items-center gap-2">
                    <Sparkles className="text-yellow-500" size={16}/>
                    <h3 className="text-white font-black uppercase tracking-widest text-xs">AI Pro Analysis</h3>
                </div>
                <div className="flex items-center gap-1 bg-green-500/20 text-green-400 px-2 py-1 rounded text-[9px] font-bold border border-green-500/30">
                    <ShieldCheck size={12} /> 88% Confidence
                </div>
            </div>

            <div className="p-5 relative group">
                {/* The "Fake" Slip Content (Blurred for non-VIPs) */}
                <div className={`space-y-4 ${!isVIP ? 'filter blur-[6px] opacity-40 select-none pointer-events-none' : ''}`}>
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                        <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Match Winner & Total</span>
                            <span className="text-sm font-black text-slate-800">{homeTeam} to Win + Over 2.5 Goals</span>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Odds</span>
                            <span className="text-lg font-black text-blue-600">2.45</span>
                        </div>
                    </div>
                    <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Tactical Rationale</span>
                        <p className="text-xs text-slate-600 font-medium leading-relaxed">Based on the last 5 H2H meetings, the home side exploits the high line. Expect early goals and a dominant second half.</p>
                    </div>
                </div>

                {/* The VIP Paywall Overlay */}
                {!isVIP && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-[2px] z-10 p-4">
                        <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center shadow-lg mb-3 animate-bounce">
                            <Lock className="text-black" size={20}/>
                        </div>
                        <h4 className="font-black text-slate-900 uppercase tracking-tighter text-lg mb-1">Premium Slip Locked</h4>
                        <p className="text-xs text-slate-700 font-bold mb-4 text-center max-w-[250px]">
                            Get today's guaranteed slips and accumulator codes in our VIP Telegram.
                        </p>
                        
                        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
                            <Link href="/vip/upgrade" className="flex-1 bg-[#229ED9] text-white px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-[#1c88ba] transition active:scale-95 flex items-center justify-center gap-2">
                                <Send size={14} /> Join VIP Telegram
                            </Link>
                            <Link href="/matches" className="flex-1 bg-slate-900 text-white px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-black transition active:scale-95 flex items-center justify-center gap-2">
                                Use Code FACTSPORT
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}