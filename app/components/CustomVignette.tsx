'use client';

import { useState, useEffect } from 'react';
import { X, Crown, ArrowRight, Gift, Sparkles, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

export default function CustomVignette() {
    const [isVisible, setIsVisible] = useState(false);

    // 🟢 THE MASTER CONFIG: Change this URL to switch the ad entirely!
    const TARGET_URL = "/vip/upgrade"; 
    const isInternalVIP = TARGET_URL.includes('/vip');

    useEffect(() => {
        const checkStatusAndShow = async () => {
            // 1. Check if they have already dismissed it this session
            const hasSeenVignette = sessionStorage.getItem('factsport_modal_seen');
            
            // 2. ZERO-COST CHECK: Use getSession() instead of getUser(). 
            // This reads directly from the device's Local Storage. 0 Database calls!
            const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            
            const isVipUser = user?.user_metadata?.is_vip === true || user?.user_metadata?.vip === true;

            // 3. THE VIP SHIELD: If this is a VIP ad, and they are already VIP, abort completely!
            if (isInternalVIP && isVipUser) {
                return; 
            }

            // 4. If they aren't VIP (or if it's an external ad) and haven't seen it, start the timer
            if (!hasSeenVignette) {
                const timer = setTimeout(() => setIsVisible(true), 10000);
                return () => clearTimeout(timer);
            }
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
            
            <div className="w-full max-w-[340px] relative pointer-events-auto animate-pop-up flex flex-col items-center text-center">
                
                <button 
                    onClick={handleClose}
                    className="absolute -top-4 -right-2 bg-black/40 backdrop-blur text-white rounded-full p-1.5 transition-colors z-20 shadow-lg"
                >
                    <X size={16} />
                </button>
                
                {isInternalVIP ? (
                    <>
                        <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-3xl flex items-center justify-center shadow-[0_10px_30px_rgba(234,179,8,0.6)] mb-4 relative transform rotate-3">
                            <Crown className="text-black fill-black w-10 h-10" />
                            <Sparkles className="absolute -top-2 -right-2 text-yellow-300 w-6 h-6 animate-pulse" />
                        </div>
                        <h3 className="text-white font-black text-3xl uppercase tracking-tight mb-2 drop-shadow-[0_2px_5px_rgba(0,0,0,0.9)] leading-none">
                            FactSport <span className="text-yellow-400 drop-shadow-[0_0_10px_rgba(234,179,8,0.8)]">VIP</span>
                        </h3>
                        <p className="text-white text-xs font-bold mb-6 drop-shadow-[0_2px_4px_rgba(0,0,0,1)] leading-relaxed px-4">
                            Stop guessing. Get daily expert betting slips, Pro AI analysis, and win monthly cash prizes!
                        </p>
                    </>
                ) : (
                    <>
                        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-green-400 rounded-3xl flex items-center justify-center shadow-[0_10px_30px_rgba(59,130,246,0.6)] mb-4 relative transform -rotate-3">
                            <Gift className="text-white w-10 h-10 animate-bounce" />
                        </div>
                        <h3 className="text-white font-black text-2xl md:text-3xl uppercase tracking-tight mb-2 drop-shadow-[0_2px_5px_rgba(0,0,0,0.9)] leading-none">
                            💥 300% Bonus 💥
                        </h3>
                        <p className="text-white text-xs font-bold mb-6 drop-shadow-[0_2px_4px_rgba(0,0,0,1)] leading-relaxed px-4">
                            Double your deposit instantly! Use promo code <span className="text-yellow-400">FACTSPORT</span> for the highest odds.
                        </p>
                    </>
                )}

                {isInternalVIP ? (
                    <Link 
                        href={TARGET_URL}
                        onClick={handleClose}
                        className="w-full bg-yellow-500 hover:bg-yellow-400 text-black py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-[0_10px_30px_rgba(234,179,8,0.5)] overflow-hidden group"
                    >
                        <div className="absolute top-0 -inset-full h-full w-1/2 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-40 group-hover:animate-shimmer"></div>
                        <span className="relative z-10">Upgrade Now</span> <TrendingUp size={18} className="relative z-10" />
                    </Link>
                ) : (
                    <a 
                        href={TARGET_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={handleClose}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-[0_10px_30px_rgba(37,99,235,0.6)] overflow-hidden group"
                    >
                        <div className="absolute top-0 -inset-full h-full w-1/2 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-30 group-hover:animate-shimmer"></div>
                        <span className="relative z-10">Claim Bonus</span> <ArrowRight size={18} className="relative z-10" />
                    </a>
                )}
                
                <button 
                    onClick={handleClose}
                    className="mt-4 text-[11px] text-white/70 uppercase font-black tracking-widest hover:text-white transition-colors drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                >
                    {isInternalVIP ? "No thanks, I'll pass" : "Maybe later"}
                </button>
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