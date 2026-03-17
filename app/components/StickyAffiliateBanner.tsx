'use client';

import { useState, useEffect } from 'react';
import { X, ArrowRight, Gift, Copy, CheckCircle2 } from 'lucide-react';

export default function StickyAffiliateBanner() {
    const [isVisible, setIsVisible] = useState(false);
    const [copied, setCopied] = useState(false);

    // 🟢 Delay appearance so it slides up beautifully after the page loads
    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), 1500);
        return () => clearTimeout(timer);
    }, []);

    if (!isVisible) return null;

    // 🟢 YOUR 1XBET DIRECT LINK
    const AFFILIATE_LINK = "https://refpa14435.com/L?tag=d_1181253m_1599c_&site=1181253&ad=1599&r=registration"; 
    const PROMO_CODE = "FACTSPORT";

    const copyToClipboard = (e: React.MouseEvent) => {
        e.preventDefault();
        navigator.clipboard.writeText(PROMO_CODE);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        // 🟢 FLOATING WRAPPER: bottom-3, left-3, right-3 makes it hover with curvy edges!
        <div className="fixed bottom-3 left-3 right-3 z-[100] max-w-2xl mx-auto animate-slide-up">
            
            {/* 🟢 1XBET BRANDING: Deep blue gradients and lime green accents */}
            <div className="bg-gradient-to-r from-[#0d477a] via-[#1562a3] to-[#0d477a] text-white rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.6)] border border-[#2fa1ff]/30 relative overflow-hidden">
                
                {/* Slim Close Button */}
                <button 
                    onClick={() => setIsVisible(false)}
                    className="absolute top-1 right-1 bg-[#093052] text-blue-200 hover:text-white rounded-full p-1 z-10 transition-colors"
                    aria-label="Close"
                >
                    <X size={12} />
                </button>

                {/* Extremely compact padding to reduce height */}
                <div className="px-2 py-2 md:px-3 md:py-2.5 flex items-center justify-between gap-2">
                    
                    {/* Small Icon */}
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-white rounded-lg flex items-center justify-center shrink-0 shadow-lg relative">
                        <Gift className="text-[#1562a3] w-4 h-4 md:w-5 md:h-5 animate-pulse" />
                    </div>
                    
                    {/* Text Area with Slider */}
                    <div className="flex flex-col flex-1 overflow-hidden pr-2">
                        <div className="flex items-center gap-1.5">
                            <span className="font-black text-[11px] md:text-sm uppercase tracking-tight drop-shadow-sm truncate">
                                300% Welcome Bonus On 1xbet!
                            </span>
                        </div>
                        
                        {/* 🟢 ANIMATED TEXT SLIDER */}
                        <div className="h-3.5 md:h-4 overflow-hidden relative mt-0.5">
                            <div className="animate-text-slide flex flex-col absolute w-full">
                                {/* Slide 1 */}
                                <span className="text-[9px] md:text-[10px] text-blue-100 truncate h-3.5 md:h-4 flex items-center">
                                    Use Code: <strong className="text-[#6ae045] mx-1">{PROMO_CODE}</strong> for up to $100
                                </span>
                                {/* Slide 2 */}
                                <span className="text-[9px] md:text-[10px] text-blue-100 truncate h-3.5 md:h-4 flex items-center">
                                    Best global odds & instant payouts!
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* CTA & Copy Area */}
                    <div className="flex items-center gap-1.5 shrink-0 pr-3 md:pr-0">
                        {/* Tiny Copy Code Button */}
                        <button 
                            onClick={copyToClipboard}
                            className={`flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded-lg border transition-all ${copied ? 'bg-[#6ae045]/20 border-[#6ae045]/50 text-[#6ae045]' : 'bg-white/10 border-white/20 text-[#6ae045] hover:bg-white/20'}`}
                            title="Copy Promo Code"
                        >
                            {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                        </button>

                        {/* 1xBet Lime Green Button */}
                        <a 
                            href={AFFILIATE_LINK}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-[#6ae045] hover:bg-[#5bc23a] text-[#052b4d] px-3 py-1.5 md:px-4 md:py-2 rounded-lg font-black text-[10px] md:text-xs uppercase tracking-widest flex items-center gap-1 shadow-lg active:scale-95 transition-transform"
                        >
                            Claim <ArrowRight size={12} className="hidden sm:block" />
                        </a>
                    </div>
                </div>
            </div>

            {/* Custom Animations for the Slide-Up and the Text Ticker */}
            <style jsx>{`
                @keyframes slide-up {
                    0% { transform: translateY(150%); opacity: 0; }
                    100% { transform: translateY(0); opacity: 1; }
                }
                .animate-slide-up {
                    animation: slide-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                
                /* The Text Slider Animation */
                @keyframes text-slide {
                    0%, 40% { transform: translateY(0); }
                    50%, 90% { transform: translateY(-14px); } /* Mobile height */
                    100% { transform: translateY(0); }
                }
                @media (min-width: 768px) {
                    @keyframes text-slide {
                        0%, 40% { transform: translateY(0); }
                        50%, 90% { transform: translateY(-16px); } /* Desktop height */
                        100% { transform: translateY(0); }
                    }
                }
                .animate-text-slide {
                    animation: text-slide 6s infinite ease-in-out;
                }
            `}</style>
        </div>
    );
}