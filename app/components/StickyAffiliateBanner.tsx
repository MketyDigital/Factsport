'use client';

import { X, Square, Maximize2 } from 'lucide-react';
import { useGlobalMedia } from '@/app/providers/GlobalMediaProvider'; 
import Link from 'next/link';

export default function StickyAffiliateBanner() {
    const { activeMatchId, mediaType: contextMediaType, videoUrl: rawVideoUrl, isPageActive, stopMedia } = useGlobalMedia();

    // 🔥 THE GHOST PROTOCOL: Extract the hidden tag to accurately detect forced audio mode
    const isForcedAudio = rawVideoUrl?.includes('#is-audio-mode');
    const videoUrl = rawVideoUrl?.replace('#is-audio-mode', ''); // Strip the tag so it doesn't break the iframe
    
    // Override the context's mediaType if the URL explicitly demands audio UI
    const mediaType = isForcedAudio ? 'audio' : contextMediaType;

    const showFloatingAudio = mediaType === 'audio' && !isPageActive && !!videoUrl;
    const showFloatingVideo = mediaType === 'video' && !isPageActive && !!videoUrl;

    if (!showFloatingAudio && !showFloatingVideo) return null;

    const isYouTube = videoUrl?.includes('youtube.com') || videoUrl?.includes('youtu.be') || videoUrl?.includes('embed/');
    const isRawMedia = !!videoUrl?.match(/\.(mp4|webm|ogg|mp3|m3u8|wav)$/i);

    const getAutoPlayUrl = (url: string) => {
        if (!url) return '';
        const separator = url.includes('?') ? '&' : '?';
        return `${url.replace(/[?&]autoplay=0/, '')}${separator}autoplay=1&playsinline=1&mute=0`;
    };

    return (
        <div className="fixed bottom-4 left-0 right-0 z-[100] w-full flex flex-col items-center justify-end px-4 pointer-events-none gap-3">
            
            {/* 🟢 UNIVERSAL BACKGROUND AUDIO PLAYER 
                Opacity is 0.01 instead of 0. True '0' causes desktop browsers 
                to immediately pause the iframe. This keeps it technically visible to the DOM.
            */}
            {showFloatingAudio && (
                <div className="absolute top-[-9999px] left-[-9999px] w-[10px] h-[10px] opacity-[0.01] overflow-hidden pointer-events-none">
                    {isRawMedia && <video src={videoUrl!} autoPlay playsInline controls={false} />}
                    {isYouTube && <iframe src={getAutoPlayUrl(videoUrl!)} allow="autoplay; encrypted-media" title="Background Audio" />}
                </div>
            )}

            {/* 🟢 FLOATING VIDEO PLAYER (PIP Mode) */}
            {showFloatingVideo && (
                <div className="w-full max-w-[320px] md:max-w-[400px] aspect-video bg-black rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] border border-blue-500/50 overflow-hidden pointer-events-auto relative animate-in slide-in-from-bottom-10 group self-end md:self-center flex flex-col">
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

                    {isYouTube ? (
                        <iframe src={getAutoPlayUrl(videoUrl!)} className="w-full h-full relative z-10" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen title="PIP Video" />
                    ) : isRawMedia ? (
                        <video src={videoUrl!} className="w-full h-full object-contain relative z-10" autoPlay playsInline controls={false} />
                    ) : (
                        <iframe src={videoUrl!} className="w-full h-full relative z-10" allow="autoplay; encrypted-media; fullscreen" title="PIP Video" />
                    )}
                </div>
            )}

            {/* 🟢 FLOATING AUDIO CONTROLS (Live Radio Only) */}
            {showFloatingAudio && (
                <div className="bg-[#0a1428]/95 backdrop-blur-xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.9)] rounded-full px-5 py-2.5 flex items-center justify-between gap-4 max-w-[220px] pointer-events-auto animate-in slide-in-from-bottom-10 mx-auto">
                    <Link href={activeMatchId === 'global-goal-rush' ? '/live' : `/match/${activeMatchId}`} className="flex flex-col hover:opacity-70 transition-opacity">
                        <span className="text-[10px] text-red-500 font-black uppercase tracking-widest flex items-center gap-1.5 drop-shadow-md">
                            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_red]"></span> LIVE RADIO
                        </span>
                        <div className="flex items-end gap-[2px] h-3 mt-1 opacity-80 justify-center">
                            <div className="w-1 bg-blue-500 rounded-t animate-[bounce_1s_infinite_ease-in-out_0.1s] h-[60%]"></div>
                            <div className="w-1 bg-blue-500 rounded-t animate-[bounce_1s_infinite_ease-in-out_0.3s] h-[100%]"></div>
                            <div className="w-1 bg-blue-500 rounded-t animate-[bounce_1s_infinite_ease-in-out_0.2s] h-[40%]"></div>
                            <div className="w-1 bg-blue-500 rounded-t animate-[bounce_1s_infinite_ease-in-out_0.5s] h-[80%]"></div>
                        </div>
                    </Link>
                    
                    <div className="w-[1px] h-6 bg-white/10"></div>

                    <button onClick={stopMedia} className="w-8 h-8 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm">
                        <Square size={14} fill="currentColor" />
                    </button>
                </div>
            )}
        </div>
    );
}