'use client';

import { useState, useEffect } from 'react';
import { X, ArrowRight, Gift, Copy, CheckCircle2, Square, Maximize2 } from 'lucide-react';
import { useGlobalMedia } from '@/app/providers/GlobalMediaProvider'; 
import Link from 'next/link';

export default function StickyAffiliateBanner() {
    const [isVisible, setIsVisible] = useState(false);
    const [copied, setCopied] = useState(false);
    
    const { activeMatchId, mediaType, videoUrl, isPageActive, stopMedia } = useGlobalMedia();

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

    // Determine if we need to show the Picture-in-Picture logic
    const showFloatingAudio = mediaType === 'audio' && !isPageActive;
    const showFloatingVideo = mediaType === 'video' && !isPageActive && videoUrl;

    // Helper to ensure autoplay parameters are attached safely
    const getAutoPlayUrl = (url: string) => {
        if (!url) return '';
        const separator = url.includes('?') ? '&' : '?';
        // Removes any existing autoplay tag to prevent duplicates, then forces it ON with playsinline
        return `${url.replace(/[?&]autoplay=0/, '')}${separator}autoplay=1&playsinline=1&mute=0`;
    };

    return (
        <div className="fixed bottom-4 left-0 right-0 z-[100] w-full flex flex-col items-center justify-end px-4 pointer-events-none gap-3">
            
            {/* 🟢 THE FLOATING VIDEO MINI-PLAYER (Twitch Style) */}
            {showFloatingVideo && (
                <div className="w-full max-w-[320px] md:max-w-[400px] aspect-video bg-black rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] border border-blue-500/50 overflow-hidden pointer-events-auto relative animate-in slide-in-from-bottom-10 group self-end md:self-center flex flex-col">
                    
                    {/* TOP-RIGHT CONTROLS: Placed out of the way of the center Play button! */}
                    <div className="absolute top-0 left-0 w-full h-12 bg-gradient-to-b from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-end gap-2 p-2 z-20 pointer-events-none">
                        <Link 
                            href={activeMatchId === 'global-goal-rush' ? '/live' : `/match/${activeMatchId}`} 
                            className="p-1.5 bg-blue-600/80 backdrop-blur rounded text-white hover:bg-blue-600 hover:scale-105 transition-all shadow-lg pointer-events-auto"
                            title="Expand to Full Page"
                        >
                            <Maximize2 size={16} />
                        </Link>
                        <button 
                            onClick={stopMedia} 
                            className="p-1.5 bg-red-600/80 backdrop-blur rounded text-white hover:bg-red-600 hover:scale-105 transition-all shadow-lg pointer-events-auto"
                            title="Close Video"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* THE IFRAME: Removed pointer-events-none so users can tap the center to play! */}
                    <iframe 
                        src={getAutoPlayUrl(videoUrl)} 
                        className="w-full h-full relative z-10" 
                        allow="autoplay; encrypted-media; picture-in-picture; fullscreen" 
                        allowFullScreen
                    />
                </div>
            )}

            {/* 🟢 DYNAMIC WIDTH: Expands when audio is playing */}
            <div className={`w-full pointer-events-auto relative transition-all duration-300 ${showFloatingAudio ? 'max-w-[480px]' : 'max-w-[420px]'}`}>
                
                <button 
                    onClick={() => setIsVisible(false)}
                    className="absolute -top-3 -right-2 bg-slate-800 text-slate-400 hover:text-white border border-slate-600 rounded-full p-1 transition-colors shadow-xl z-20"
                    aria-label="Close"
                >
                    <X size={14} />
                </button>

                <div className="bg-[#0a1428]/95 backdrop-blur-xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.9)] rounded-full p-1.5 flex items-center justify-between gap-2 w-full h-[52px]">
                    
                    {/* LEFT SIDE: Affiliate Banner */}
                    <div className={`flex items-center gap-2 h-full transition-all overflow-hidden ${showFloatingAudio ? 'w-[65%] border-r border-white/10 pr-2' : 'w-full'}`}>
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shrink-0 shadow-inner">
                            <Gift className="text-[#1562a3] w-5 h-5 animate-pulse" />
                        </div>
                        
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

                    {/* RIGHT SIDE: Mini Audio Player */}
                    {showFloatingAudio && (
                        <div className="flex shrink-0 w-[35%] items-center justify-between pl-2 pr-1 animate-in fade-in slide-in-from-right-4">
                            <Link href={activeMatchId === 'global-goal-rush' ? '/live' : `/match/${activeMatchId}`} className="flex flex-col hover:opacity-70 transition-opacity">
                                <span className="text-[8px] text-red-500 font-black uppercase tracking-widest flex items-center gap-1 drop-shadow-md">
                                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_red]"></span> LIVE RADIO
                                </span>
                                <div className="flex items-end gap-[1px] md:gap-0.5 h-3 mt-0.5 opacity-80">
                                    <div className="w-1 bg-blue-500 rounded-t animate-[bounce_1s_infinite_ease-in-out_0.1s] h-[60%]"></div>
                                    <div className="w-1 bg-blue-500 rounded-t animate-[bounce_1s_infinite_ease-in-out_0.3s] h-[100%]"></div>
                                    <div className="w-1 bg-blue-500 rounded-t animate-[bounce_1s_infinite_ease-in-out_0.2s] h-[40%]"></div>
                                    <div className="w-1 bg-blue-500 rounded-t animate-[bounce_1s_infinite_ease-in-out_0.5s] h-[80%]"></div>
                                </div>
                            </Link>
                            
                            <button onClick={stopMedia} className="w-8 h-8 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm">
                                <Square size={14} fill="currentColor" />
                            </button>
                        </div>
                    )}
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