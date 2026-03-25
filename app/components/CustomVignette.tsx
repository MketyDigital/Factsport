'use client';

import { useState, useEffect } from 'react';
import { X, Crown, ArrowRight, Gift, Sparkles, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/app/components/AuthProvider';

export default function CustomVignette() {
    const [isVisible, setIsVisible] = useState(false);
    const { isVip, loading } = useAuth(); 

    // 🟢 Simply change this URL to an external link (like 1xBet) to auto-switch the UI!
    const TARGET_URL = "/vip/upgrade"; 
    const isInternalVIP = TARGET_URL.includes('/vip');

    useEffect(() => {
        if (loading) return; 

        const hasSeenVignette = sessionStorage.getItem('factsport_modal_seen');
        if (hasSeenVignette) return; 

        if (isInternalVIP && isVip) {
            sessionStorage.setItem('factsport_modal_seen', 'true');
            return; 
        }

        const timer = setTimeout(() => setIsVisible(true), 10000);
        return () => clearTimeout(timer);
    }, [isInternalVIP, isVip, loading]);

    const handleClose = () => {
        setIsVisible(false);
        sessionStorage.setItem('factsport_modal_seen', 'true');
    };

    if (!isVisible) return null;

    return (
        // 🟢 KEPT: pointer-events-none so users can scroll and click the page behind the popup!
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 pointer-events-none animate-fade-in">
            
            {/* 🟢 REDUCED SIZE: max-w-[270px] for a tighter mobile footprint */}
            <div className="w-full max-w-[270px] relative pointer-events-auto animate-pop-up flex flex-col items-center text-center">
                
                {/* 🟢 REDUCED PADDING: p-4 instead of p-5 */}
                <div className="w-full bg-[#0a1428]/95 backdrop-blur-xl border border-white/10 rounded-3xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.9)] flex flex-col items-center">
                    
                    {/* 🛡️ UX FIX: Added p-2 (larger tap target) so mobile users don't miss the X */}
                    <button 
                        onClick={handleClose}
                        className="absolute -top-3 -right-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white rounded-full p-2 transition-colors z-20 shadow-xl"
                        aria-label="Close popup"
                    >
                        <X size={14} />
                    </button>
                    
                    {isInternalVIP ? (
                        <>
                            {/* 🟢 REDUCED ICON: w-14 h-14 */}
                            <div className="w-14 h-14 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl flex items-center justify-center shadow-[0_10px_30px_rgba(234,179,8,0.5)] mb-3 relative transform rotate-3">
                                <Crown className="text-black fill-black w-7 h-7" />
                                <Sparkles className="absolute -top-2 -right-2 text-yellow-300 w-4 h-4 animate-pulse" />
                            </div>
                            <h3 className="text-white font-black text-xl uppercase tracking-tight mb-1.5 drop-shadow-[0_2px_5px_rgba(0,0,0,1)] leading-none">
                                FactSport <span className="text-yellow-400 drop-shadow-[0_0_10px_rgba(234,179,8,0.8)]">VIP</span>
                            </h3>
                            <p className="text-slate-300 text-[10px] font-bold mb-4 drop-shadow-[0_2px_4px_rgba(0,0,0,1)] leading-relaxed px-1">
                                Stop guessing. Get daily expert betting slips, Pro AI analysis, and win monthly cash prizes!
                            </p>
                        </>
                    ) : (
                        <>
                            {/* 🟢 REDUCED ICON: w-14 h-14 */}
                            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-green-400 rounded-2xl flex items-center justify-center shadow-[0_10px_30px_rgba(59,130,246,0.5)] mb-3 relative transform -rotate-3">
                                <Gift className="text-white w-7 h-7 animate-bounce" />
                            </div>
                            <h3 className="text-white font-black text-xl uppercase tracking-tight mb-1.5 drop-shadow-[0_2px_5px_rgba(0,0,0,1)] leading-none">
                                💥 300% Bonus
                            </h3>
                            <p className="text-slate-300 text-[10px] font-bold mb-4 drop-shadow-[0_2px_4px_rgba(0,0,0,1)] leading-relaxed px-1">
                                Double your deposit instantly! Use promo code <span className="text-yellow-400">FACTSPORT</span> for the highest odds.
                            </p>
                        </>
                    )}

                    {isInternalVIP ? (
                        <Link 
                            href={TARGET_URL}
                            onClick={handleClose}
                            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black py-2.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-[0_10px_30px_rgba(234,179,8,0.4)] overflow-hidden group relative"
                        >
                            {/* 🛡️ FIX 3: Native Tailwind arbitrary animation for the shimmer to guarantee it works */}
                            <div className="absolute top-0 -left-[100%] h-full w-1/2 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white/40 group-hover:[animation:shimmer_1.5s_infinite]"></div>
                            <span className="relative z-10">Upgrade Now</span> <TrendingUp size={15} className="relative z-10" />
                        </Link>
                    ) : (
                        <a 
                            href={TARGET_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={handleClose}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-[0_10px_30px_rgba(37,99,235,0.5)] overflow-hidden group relative"
                        >
                            {/* 🛡️ FIX 3: Native Tailwind arbitrary animation for the shimmer to guarantee it works */}
                            <div className="absolute top-0 -left-[100%] h-full w-1/2 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white/30 group-hover:[animation:shimmer_1.5s_infinite]"></div>
                            <span className="relative z-10">Claim Bonus</span> <ArrowRight size={15} className="relative z-10" />
                        </a>
                    )}
                    
                    {/* 🛡️ UX FIX: Added py-2 px-4 to make this text much easier to tap with a thumb */}
                    <button 
                        onClick={handleClose}
                        className="mt-2.5 text-[9px] text-slate-400 uppercase font-black tracking-widest hover:text-white transition-colors py-2 px-4"
                    >
                        {isInternalVIP ? "No thanks, I'll pass" : "Maybe later"}
                    </button>
                </div>
            </div>

            <style jsx>{`
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
                
                @keyframes pop-up {
                    0% { transform: scale(0.9) translateY(20px); opacity: 0; }
                    100% { transform: scale(1) translateY(0); opacity: 1; }
                }
                .animate-pop-up { animation: pop-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                
                @keyframes shimmer { 
                    0% { left: -100%; }
                    100% { left: 200%; } 
                }
            `}</style>
        </div>
    );
}