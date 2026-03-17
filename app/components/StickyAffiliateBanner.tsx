'use client';

import { useState, useEffect } from 'react';
import { X, ArrowRight, Gift, Copy, CheckCircle2 } from 'lucide-react';

export default function StickyAffiliateBanner() {
    const [isVisible, setIsVisible] = useState(false);
    const [copied, setCopied] = useState(false);

    // 🟢 Delay the appearance slightly so it slides in and grabs attention
    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), 1500);
        return () => clearTimeout(timer);
    }, []);

    if (!isVisible) return null;

    // 🟢 YOUR DIRECT AFFILIATE LINK
    const AFFILIATE_LINK = "https://refpa14435.com/L?tag=d_1181253m_1599c_&site=1181253&ad=1599&r=registration"; 
    const PROMO_CODE = "FACTSPORT";

    const copyToClipboard = (e: React.MouseEvent) => {
        e.preventDefault();
        navigator.clipboard.writeText(PROMO_CODE);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed bottom-0 left-0 w-full z-[100] animate-slide-up">
            {/* The glowing top border */}
            <div className="h-1 w-full bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600"></div>
            
            <div className="bg-gradient-to-b from-[#0f1c3a] text-white to-[#0a1428] shadow-[0_-15px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl border-t border-white/10 relative">
                <div className="max-w-7xl mx-auto px-2 py-3 md:px-4 md:py-4 flex items-center justify-between gap-2">
                    
                    {/* Close Button */}
                    <button 
                        onClick={() => setIsVisible(false)}
                        className="absolute -top-3 -right-1 md:-top-4 md:-right-2 bg-slate-800 text-slate-400 hover:text-white border border-slate-600 rounded-full p-1 md:p-1.5 shadow-xl z-10 transition-colors"
                        aria-label="Close Ad"
                    >
                        <X size={14} />
                    </button>

                    {/* Icon & Offer Text */}
                    <div className="flex items-center gap-2 md:gap-4 flex-1 overflow-hidden">
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-xl flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(234,179,8,0.4)] relative">
                            <Gift className="text-black w-5 h-5 md:w-6 md:h-6 animate-pulse" />
                            {/* Little notification dot to draw the eye */}
                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-white border border-yellow-500"></span>
                            </span>
                        </div>
                        
                        <div className="flex flex-col truncate">
                            <div className="flex items-center gap-2">
                                <span className="font-black text-xs md:text-sm lg:text-base uppercase tracking-tight text-white drop-shadow-md truncate">
                                    Unlock 300% Welcome Bonus!
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[9px] md:text-[11px] text-slate-300 font-medium hidden sm:inline">
                                    Register & deposit to claim up to $100.
                                </span>
                                <span className="text-[10px] md:text-xs text-yellow-400 font-bold uppercase tracking-widest hidden sm:inline ml-1">
                                    Code:
                                </span>
                                
                                {/* Click to Copy Promo Code Button */}
                                <button 
                                    onClick={copyToClipboard}
                                    className={`flex items-center gap-1 px-2 py-0.5 rounded border transition-all ${copied ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'bg-white/10 border-white/20 text-yellow-400 hover:bg-white/20'}`}
                                >
                                    <span className="font-black text-[10px] md:text-xs tracking-wider">{PROMO_CODE}</span>
                                    {copied ? <CheckCircle2 size={10} /> : <Copy size={10} />}
                                </button>
                            </div>
                            {/* Mobile only subtext */}
                            <span className="text-[9px] text-slate-300 sm:hidden mt-0.5 truncate">
                                Use code <span className="text-yellow-400 font-bold">{PROMO_CODE}</span> for up to $100 free!
                            </span>
                        </div>
                    </div>

                    {/* The CTA Button */}
                    <a 
                        href={AFFILIATE_LINK}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2.5 md:px-8 md:py-3 rounded-xl font-black text-[11px] md:text-sm uppercase tracking-widest flex items-center gap-2 transition-transform active:scale-95 shadow-[0_0_15px_rgba(234,179,8,0.3)] relative overflow-hidden group"
                    >
                        {/* Shimmer effect */}
                        <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-40 group-hover:animate-shimmer"></div>
                        <span className="relative z-10">Claim Now</span> 
                        <ArrowRight size={14} className="relative z-10 hidden sm:block" />
                    </a>
                </div>
            </div>
            
            {/* Tailwind custom animation classes to add to your globals.css if needed, or it defaults to standard display */}
            <style jsx>{`
                @keyframes slide-up {
                    0% { transform: translateY(100%); }
                    100% { transform: translateY(0); }
                }
                .animate-slide-up {
                    animation: slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
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