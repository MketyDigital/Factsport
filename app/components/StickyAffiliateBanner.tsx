'use client';

import { useState, useEffect } from 'react';
import { X, ArrowRight, Gift, Copy, CheckCircle2 } from 'lucide-react';

export default function StickyAffiliateBanner() {
    const [isVisible, setIsVisible] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), 1500);
        return () => clearTimeout(timer);
    }, []);

    if (!isVisible) return null;

    const AFFILIATE_LINK = "https://refpa14435.com/L?tag=d_1181253m_1599c_&site=1181253&ad=1599&r=registration"; 
    const PROMO_CODE = "FACTSPORT";

    const copyToClipboard = (e: React.MouseEvent) => {
        e.preventDefault();
        navigator.clipboard.writeText(PROMO_CODE);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed bottom-3 left-3 right-3 z-[100] max-w-2xl mx-auto animate-slide-up pointer-events-none">
            
            {/* 🟢 Completely Transparent Wrapper - Only inner items catch pointer events */}
            <div className="relative overflow-visible w-full flex items-center justify-between gap-2 px-1">
                
                {/* Floating Close Button */}
                <button 
                    onClick={() => setIsVisible(false)}
                    className="absolute -top-4 -right-1 text-slate-400 hover:text-slate-600 bg-white/50 backdrop-blur rounded-full p-0.5 z-20 pointer-events-auto transition-colors shadow-sm"
                    aria-label="Close"
                >
                    <X size={14} />
                </button>

                <div className="flex items-center gap-2 flex-1 pointer-events-auto">
                    {/* Floating Icon */}
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-full flex items-center justify-center shrink-0 shadow-[0_4px_15px_rgba(0,0,0,0.3)] relative">
                        <Gift className="text-[#1562a3] w-5 h-5 md:w-6 md:h-6 animate-pulse" />
                    </div>
                    
                    {/* Floating Text with Heavy Shadows for visibility */}
                    <div className="flex flex-col flex-1 overflow-hidden drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                        <span className="font-black text-white text-xs md:text-sm uppercase tracking-tight truncate">
                            300% Welcome Bonus!
                        </span>
                        
                        <div className="h-4 overflow-hidden relative mt-0.5">
                            <div className="animate-text-slide flex flex-col absolute w-full">
                                <span className="text-[10px] md:text-[11px] text-[#6ae045] font-black truncate h-4 flex items-center">
                                    Code: {PROMO_CODE}
                                </span>
                                <span className="text-[10px] md:text-[11px] text-white font-bold truncate h-4 flex items-center">
                                    Best global odds!
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Floating Buttons */}
                <div className="flex items-center gap-2 shrink-0 pointer-events-auto">
                    <button 
                        onClick={copyToClipboard}
                        className={`flex items-center justify-center w-8 h-8 rounded-full transition-all shadow-[0_4px_10px_rgba(0,0,0,0.4)] ${copied ? 'bg-white text-[#6ae045]' : 'bg-[#1562a3] text-white hover:bg-[#0d477a]'}`}
                        title="Copy Promo Code"
                    >
                        {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                    </button>

                    <a 
                        href={AFFILIATE_LINK}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-[#6ae045] hover:bg-[#5bc23a] text-[#052b4d] px-4 py-2 rounded-full font-black text-[10px] md:text-xs uppercase tracking-widest flex items-center gap-1 shadow-[0_4px_15px_rgba(106,224,69,0.5)] active:scale-95 transition-transform"
                    >
                        Claim <ArrowRight size={12} className="hidden sm:block" />
                    </a>
                </div>
            </div>

            <style jsx>{`
                @keyframes slide-up {
                    0% { transform: translateY(150%); opacity: 0; }
                    100% { transform: translateY(0); opacity: 1; }
                }
                .animate-slide-up {
                    animation: slide-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                @keyframes text-slide {
                    0%, 40% { transform: translateY(0); }
                    50%, 90% { transform: translateY(-16px); }
                    100% { transform: translateY(0); }
                }
                .animate-text-slide {
                    animation: text-slide 6s infinite ease-in-out;
                }
            `}</style>
        </div>
    );
}