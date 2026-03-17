'use client';

import { useState, useEffect } from 'react';
import { X, Crown, ArrowRight, Gift, Sparkles, TrendingUp } from 'lucide-react';
import Link from 'next/link';

export default function CustomVignette() {
    const [isVisible, setIsVisible] = useState(false);

    // 🟢 THE MASTER CONFIG: Change this URL to switch the ad entirely!
    // Set to '/vip/upgrade' for your internal VIP ad.
    // Set to 'https://melbet.com' (or any betting link) for the external Affiliate ad.
    const TARGET_URL = "/vip/upgrade"; 
    
    // Determine if the link is internal (VIP) or external (Affiliate)
    const isInternalVIP = TARGET_URL.includes('/vip');

    useEffect(() => {
        // Only show once per session to avoid annoying users
        const hasSeenVignette = sessionStorage.getItem('factsport_modal_seen');
        
        if (!hasSeenVignette) {
            // Pops up 10 seconds after they load the page
            const timer = setTimeout(() => setIsVisible(true), 10000);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        sessionStorage.setItem('factsport_modal_seen', 'true');
    };

    if (!isVisible) return null;

    return (
        // 🟢 Backdrop: Subtle dark blur so they can still see the site behind it
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
            
            {/* 🟢 The Modal Card: Animates up and scales in */}
            <div className="bg-[#0a1428] w-full max-w-[340px] rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] border border-slate-700/50 overflow-hidden relative animate-pop-up">
                
                {/* Glowing Top Border based on type */}
                <div className={`h-1.5 w-full bg-gradient-to-r ${isInternalVIP ? 'from-yellow-600 via-yellow-400 to-yellow-600' : 'from-blue-600 via-green-400 to-blue-600'}`}></div>

                {/* Close Button */}
                <button 
                    onClick={handleClose}
                    className="absolute top-3 right-3 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-full p-1.5 transition-colors z-20"
                >
                    <X size={18} />
                </button>

                <div className="p-6 md:p-8 text-center relative overflow-hidden">
                    
                    {/* Background Glow */}
                    <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 rounded-full blur-[50px] opacity-20 pointer-events-none ${isInternalVIP ? 'bg-yellow-500' : 'bg-blue-500'}`}></div>
                    
                    {/* 🟢 DYNAMIC CONTENT: VIP MODE vs AFFILIATE MODE */}
                    {isInternalVIP ? (
                        <>
                            {/* VIP Icon */}
                            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl flex items-center justify-center shadow-[0_0_25px_rgba(234,179,8,0.4)] mb-5 relative z-10 transform rotate-3">
                                <Crown className="text-black fill-black w-8 h-8" />
                                <Sparkles className="absolute -top-2 -right-2 text-yellow-300 w-5 h-5 animate-pulse" />
                            </div>
                            
                            {/* VIP Text */}
                            <h3 className="text-white font-black text-2xl uppercase tracking-tight mb-2 relative z-10 leading-none">
                                FactSport <span className="text-yellow-500">VIP</span>
                            </h3>
                            <p className="text-slate-300 text-[11px] font-medium mb-6 relative z-10 leading-relaxed px-2">
                                Stop guessing. Get daily expert betting slips, Pro AI analysis, and climb the leaderboard to win monthly cash prizes!
                            </p>
                        </>
                    ) : (
                        <>
                            {/* Affiliate Icon */}
                            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-blue-500 to-green-400 rounded-2xl flex items-center justify-center shadow-[0_0_25px_rgba(59,130,246,0.4)] mb-5 relative z-10 transform -rotate-3">
                                <Gift className="text-white w-8 h-8 animate-bounce" />
                            </div>
                            
                            {/* Affiliate Text */}
                            <h3 className="text-white font-black text-xl md:text-2xl uppercase tracking-tight mb-2 relative z-10 leading-none">
                                💥 300% <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-400">Bonus</span> 💥
                            </h3>
                            <p className="text-slate-300 text-[11px] font-medium mb-4 relative z-10 leading-relaxed px-2">
                                Double your deposit instantly! Use promo code <span className="text-yellow-400 font-bold uppercase tracking-wider">FACTSPORT</span> for the highest global odds.
                            </p>
                        </>
                    )}

                    {/* 🟢 DYNAMIC BUTTON */}
                    {isInternalVIP ? (
                        <Link 
                            href={TARGET_URL}
                            onClick={handleClose}
                            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black py-3.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-transform active:scale-95 relative z-10 shadow-[0_0_20px_rgba(234,179,8,0.3)] overflow-hidden group"
                        >
                            <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-40 group-hover:animate-shimmer"></div>
                            <span className="relative z-10">Upgrade Now</span> <TrendingUp size={16} className="relative z-10" />
                        </Link>
                    ) : (
                        <a 
                            href={TARGET_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={handleClose}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-transform active:scale-95 relative z-10 shadow-[0_0_20px_rgba(37,99,235,0.4)] overflow-hidden group"
                        >
                            <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-30 group-hover:animate-shimmer"></div>
                            <span className="relative z-10">Claim Bonus</span> <ArrowRight size={16} className="relative z-10" />
                        </a>
                    )}
                    
                    {/* Ghost Cancel Button */}
                    <button 
                        onClick={handleClose}
                        className="mt-4 text-[10px] text-slate-500 uppercase font-bold tracking-widest hover:text-slate-300 transition-colors relative z-10"
                    >
                        {isInternalVIP ? "No thanks, I'll pass" : "Maybe later"}
                    </button>
                </div>
            </div>

            {/* Custom Animations */}
            <style jsx>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fade-in {
                    animation: fade-in 0.3s ease-out forwards;
                }
                @keyframes pop-up {
                    0% { transform: scale(0.9) translateY(20px); opacity: 0; }
                    100% { transform: scale(1) translateY(0); opacity: 1; }
                }
                .animate-pop-up {
                    animation: pop-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                @keyframes shimmer {
                    100% { left: 125%; }
                }
                .animate-shimmer {
                    animation: shimmer 1.5s infinite;
                }
            `}</style>
        </div>
    );
}