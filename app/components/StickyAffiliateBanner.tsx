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
        <div className="fixed bottom-4 left-0 right-0 z-[100] w-full flex justify-center px-4 pointer-events-none animate-slide-up">
            
            {/* 🟢 REDUCED WIDTH: max-w-[420px] makes it compact and centered */}
            <div className="w-full max-w-[420px] pointer-events-auto relative">
                
                {/* Close Button overlapping slightly on the top right */}
                <button 
                    onClick={() => setIsVisible(false)}
                    className="absolute -top-3 -right-2 bg-slate-800 text-slate-400 hover:text-white border border-slate-600 rounded-full p-1 transition-colors shadow-xl z-20"
                    aria-label="Close"
                >
                    <X size={14} />
                </button>

                {/* 🟢 THE UNIFIED SHIELD: A heavily shadowed, dark frosted pill */}
                <div className="bg-[#0a1428]/95 backdrop-blur-xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.9)] rounded-full p-1.5 flex items-center justify-between gap-2 w-full">
                    
                    {/* Icon */}
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shrink-0 shadow-inner">
                        <Gift className="text-[#1562a3] w-5 h-5 animate-pulse" />
                    </div>
                    
                    {/* Text Block */}
                    <div className="flex flex-col flex-1 overflow-hidden">
                        <span className="font-black text-white text-[11px] md:text-xs uppercase tracking-tight truncate drop-shadow-md">
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

                    {/* Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
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
                            className="bg-[#6ae045] hover:bg-[#5bc23a] text-[#052b4d] px-3.5 py-2 rounded-full font-black text-[10px] uppercase tracking-widest flex items-center gap-1 shadow-[0_4px_15px_rgba(106,224,69,0.5)] active:scale-95 transition-transform"
                        >
                            Claim <ArrowRight size={12} className="hidden sm:block" />
                        </a>
                    </div>
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