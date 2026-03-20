'use client';

import { useState, useEffect } from 'react';
import { X, Crown, ArrowRight, Gift, Sparkles, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/app/lib/supabase/client';

export default function CustomVignette() {
    const [isVisible, setIsVisible] = useState(false);

    // 🟢 THE MASTER CONFIG: Change this URL to switch the ad entirely!
    const TARGET_URL = "/vip/upgrade"; 
    const isInternalVIP = TARGET_URL.includes('/vip');

    useEffect(() => {
        const checkStatusAndShow = async () => {
            // 1. 🛡️ THE ZERO-COST GUARD: If they already saw it or are marked VIP this session, abort immediately!
            const hasSeenVignette = sessionStorage.getItem('factsport_modal_seen');
            if (hasSeenVignette) return; 

            // 2. Fetch the user session securely
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            
            let isVipUser = false;

            // 3. THE VIP CHECK (Only runs ONCE per session because of the guard above)
            if (user) {
                // Check local metadata first (fastest)
                isVipUser = user.user_metadata?.is_vip === true || user.user_metadata?.vip === true || user.user_metadata?.role === 'admin';

                // If not found in metadata, do ONE database check to be absolutely sure
                if (!isVipUser) {
                    const { data: profile } = await supabase.from('profiles').select('role, is_vip').eq('id', user.id).single();
                    isVipUser = profile?.role === 'admin' || profile?.is_vip === true;
                }
            }

            // 4. THE ABORT: If this is a VIP ad, and they are already VIP, hide it permanently!
            if (isInternalVIP && isVipUser) {
                sessionStorage.setItem('factsport_modal_seen', 'true');
                return; 
            }

            // 5. Start the timer to show the ad
            const timer = setTimeout(() => setIsVisible(true), 10000);
            return () => clearTimeout(timer);
        };

        checkStatusAndShow();
    }, [isInternalVIP]);

    const handleClose = () => {
        setIsVisible(false);
        sessionStorage.setItem('factsport_modal_seen', 'true');
    };

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 pointer-events-none animate-fade-in">
            
            {/* 🟢 REDUCED WIDTH: max-w-[300px] makes it smaller and sleeker */}
            <div className="w-full max-w-[300px] relative pointer-events-auto animate-pop-up flex flex-col items-center text-center">
                
                {/* 🟢 THE TEXT BACKGROUND SHIELD: Black/70 frosted glass ensures text pops against any background */}
                <div className="w-full bg-black/70 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.9)] flex flex-col items-center">
                    
                    <button 
                        onClick={handleClose}
                        className="absolute -top-3 -right-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white rounded-full p-1.5 transition-colors z-20 shadow-xl"
                    >
                        <X size={16} />
                    </button>
                    
                    {isInternalVIP ? (
                        <>
                            <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl flex items-center justify-center shadow-[0_10px_30px_rgba(234,179,8,0.5)] mb-3 relative transform rotate-3">
                                <Crown className="text-black fill-black w-8 h-8" />
                                <Sparkles className="absolute -top-2 -right-2 text-yellow-300 w-5 h-5 animate-pulse" />
                            </div>
                            <h3 className="text-white font-black text-2xl uppercase tracking-tight mb-2 drop-shadow-[0_2px_5px_rgba(0,0,0,1)] leading-none">
                                FactSport <span className="text-yellow-400 drop-shadow-[0_0_10px_rgba(234,179,8,0.8)]">VIP</span>
                            </h3>
                            <p className="text-slate-200 text-[11px] font-bold mb-5 drop-shadow-[0_2px_4px_rgba(0,0,0,1)] leading-relaxed">
                                Stop guessing. Get daily expert betting slips, Pro AI analysis, and win monthly cash prizes!
                            </p>
                        </>
                    ) : (
                        <>
                            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-green-400 rounded-2xl flex items-center justify-center shadow-[0_10px_30px_rgba(59,130,246,0.5)] mb-3 relative transform -rotate-3">
                                <Gift className="text-white w-8 h-8 animate-bounce" />
                            </div>
                            <h3 className="text-white font-black text-2xl uppercase tracking-tight mb-2 drop-shadow-[0_2px_5px_rgba(0,0,0,1)] leading-none">
                                💥 300% Bonus
                            </h3>
                            <p className="text-slate-200 text-[11px] font-bold mb-5 drop-shadow-[0_2px_4px_rgba(0,0,0,1)] leading-relaxed">
                                Double your deposit instantly! Use promo code <span className="text-yellow-400">FACTSPORT</span> for the highest odds.
                            </p>
                        </>
                    )}

                    {isInternalVIP ? (
                        <Link 
                            href={TARGET_URL}
                            onClick={handleClose}
                            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-[0_10px_30px_rgba(234,179,8,0.4)] overflow-hidden group"
                        >
                            <div className="absolute top-0 -inset-full h-full w-1/2 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-40 group-hover:animate-shimmer"></div>
                            <span className="relative z-10">Upgrade Now</span> <TrendingUp size={16} className="relative z-10" />
                        </Link>
                    ) : (
                        <a 
                            href={TARGET_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={handleClose}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-[0_10px_30px_rgba(37,99,235,0.5)] overflow-hidden group"
                        >
                            <div className="absolute top-0 -inset-full h-full w-1/2 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-30 group-hover:animate-shimmer"></div>
                            <span className="relative z-10">Claim Bonus</span> <ArrowRight size={16} className="relative z-10" />
                        </a>
                    )}
                    
                    <button 
                        onClick={handleClose}
                        className="mt-4 text-[10px] text-slate-400 uppercase font-black tracking-widest hover:text-white transition-colors"
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
                @keyframes shimmer { 100% { left: 125%; } }
                .animate-shimmer { animation: shimmer 1.5s infinite; }
            `}</style>
        </div>
    );
}