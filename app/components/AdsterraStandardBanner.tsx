'use client';

import { useState } from 'react';
import { Gift, Copy, CheckCircle2, ArrowRight } from 'lucide-react';

export default function AdsterraStandardBanner() {
    const [copied, setCopied] = useState(false);

    const AFFILIATE_LINK = "https://refpa14435.com/L?tag=d_1181253m_1599c_&site=1181253&ad=1599&r=registration"; 
    const PROMO_CODE = "FACTSPORT";

    const copyToClipboard = (e: React.MouseEvent) => {
        e.preventDefault();
        navigator.clipboard.writeText(PROMO_CODE);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="w-full flex justify-center items-center my-4">
            <div className="bg-[#0a1428] border border-slate-800 shadow-sm rounded-xl p-2 md:p-2.5 flex items-center justify-between gap-2 w-full max-w-[400px] md:max-w-lg transition-transform hover:scale-[1.02] duration-300">
                
                <div className="flex items-center gap-2 md:gap-3 overflow-hidden w-full">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-full flex items-center justify-center shrink-0 shadow-inner">
                        <Gift className="text-[#1562a3] w-5 h-5 md:w-6 md:h-6 animate-pulse" />
                    </div>
                    
                    <div className="flex flex-col flex-1 overflow-hidden">
                        <span className="font-black text-white text-[11px] md:text-sm uppercase tracking-tight truncate drop-shadow-md">
                            300% Welcome Bonus!
                        </span>
                        
                        <div className="h-4 md:h-5 overflow-hidden relative mt-0.5">
                            <div className="animate-text-slide flex flex-col absolute w-full">
                                <span className="text-[10px] md:text-[11px] text-[#6ae045] font-black truncate h-4 md:h-5 flex items-center">
                                    Code: {PROMO_CODE}
                                </span>
                                <span className="text-[10px] md:text-[11px] text-slate-400 font-bold truncate h-4 md:h-5 flex items-center">
                                    Best global odds!
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                        <button 
                            onClick={copyToClipboard}
                            className={`flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full transition-all shadow-md ${copied ? 'bg-white text-[#6ae045]' : 'bg-[#1562a3] text-white hover:bg-[#0d477a]'}`}
                            title="Copy Promo Code"
                        >
                            {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                        </button>

                        <a 
                            href={AFFILIATE_LINK}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-[#6ae045] hover:bg-[#5bc23a] text-[#0a1428] px-3 md:px-4 py-2 md:py-2.5 rounded-full font-black text-[10px] md:text-xs uppercase tracking-widest flex items-center gap-1 shadow-[0_4px_15px_rgba(106,224,69,0.2)] active:scale-95 transition-transform"
                        >
                            Claim <ArrowRight size={14} className="hidden sm:block" />
                        </a>
                    </div>
                </div>
            </div>

            <style jsx>{`
                @keyframes text-slide {
                    0%, 40% { transform: translateY(0); }
                    50%, 90% { transform: translateY(-50%); }
                    100% { transform: translateY(0); }
                }
                .animate-text-slide { animation: text-slide 6s infinite ease-in-out; }
            `}</style>
        </div>
    );
}