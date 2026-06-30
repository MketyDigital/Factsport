'use client';

import { useState, useRef } from 'react';
import { X, Square, Maximize2, Play, Pause } from 'lucide-react';
import { useGlobalMedia } from '@/app/providers/GlobalMediaProvider'; 
import Link from 'next/link';

export default function StickyAffiliateBanner() {
    const { activeMatchId, mediaType: contextMediaType, videoUrl: rawVideoUrl, isPageActive, stopMedia } = useGlobalMedia();
    
    const [isPlaying, setIsPlaying] = useState(true);
    const pipVideoRef = useRef<HTMLVideoElement>(null);
    const pipIframeRef = useRef<HTMLIFrameElement>(null);

    const isForcedAudio = rawVideoUrl?.includes('#is-audio-mode');
    const videoUrl = rawVideoUrl?.replace('#is-audio-mode', '');
    
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

    const getYouTubeWhiteLabelUrl = (url: string) => {
        const autoPlayUrl = getAutoPlayUrl(url);
        return `${autoPlayUrl}&controls=0&modestbranding=1&rel=0&disablekb=1&fs=0&showinfo=0&iv_load_policy=3&enablejsapi=1`;
    };

    const togglePlay = () => {
        if (isYouTube && pipIframeRef.current) {
            pipIframeRef.current.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: isPlaying ? 'pauseVideo' : 'playVideo' }), '*');
        } else if (pipVideoRef.current) {
            if (isPlaying) pipVideoRef.current.pause();
            else pipVideoRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    return (
        <div className="fixed bottom-4 left-0 right-0 z-[100] w-full flex flex-col items-center justify-end px-4 pointer-events-none gap-3">
            
            {showFloatingAudio && (
                <div className="absolute top-[-9999px] left-[-9999px] w-[10px] h-[10px] opacity-[0.01] overflow-hidden pointer-events-none">
                    {isRawMedia && <video ref={pipVideoRef} src={videoUrl!} autoPlay playsInline controls={false} />}
                    {isYouTube && <iframe ref={pipIframeRef} src={getYouTubeWhiteLabelUrl(videoUrl!)} allow="autoplay; encrypted-media" title="Background Audio" />}
                </div>
            )}

            {showFloatingVideo && (
                <div className="w-full max-w-[320px] md:max-w-[400px] aspect-video bg-black rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] border border-blue-500/50 overflow-hidden pointer-events-auto relative animate-in slide-in-from-bottom-10 group self-end md:self-center flex flex-col">
                    <div className="absolute top-0 left-0 w-full h-12 bg-gradient-to-b from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-end gap-2 p-2 z-30 pointer-events-none">
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
                        <div className="relative w-full h-full overflow-hidden flex items-center justify-center">
                            <div className="absolute inset-0 z-20 pointer-events-auto"></div>
                            <iframe ref={pipIframeRef} src={getYouTubeWhiteLabelUrl(videoUrl!)} className="absolute inset-0 w-[104%] h-[104%] left-[-2%] top-[-2%] pointer-events-none z-10 object-cover" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen title="PIP Video" />
                        </div>
                    ) : isRawMedia ? (
                        <video ref={pipVideoRef} src={videoUrl!} className="w-full h-full object-contain relative z-10" autoPlay playsInline controls={false} />
                    ) : (
                        <div className="relative w-full h-full">
                           <div className="absolute inset-0 z-20 pointer-events-auto"></div>
                           <iframe src={videoUrl!} className="w-full h-full relative z-10 pointer-events-none" allow="autoplay; encrypted-media; fullscreen" title="PIP Video" />
                        </div>
                    )}
                </div>
            )}

            {showFloatingAudio && (
                <div className="bg-[#0a1428]/95 backdrop-blur-xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.9)] rounded-full px-5 py-2.5 flex items-center justify-between gap-4 max-w-[240px] pointer-events-auto animate-in slide-in-from-bottom-10 mx-auto">
                    <Link href={activeMatchId === 'global-goal-rush' ? '/live' : `/match/${activeMatchId}`} className="flex flex-col hover:opacity-70 transition-opacity">
                        <span className="text-[10px] text-red-500 font-black uppercase tracking-widest flex items-center gap-1.5 drop-shadow-md">
                            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_red]"></span> LIVE RADIO
                        </span>
                        <div className="flex items-end gap-[2px] h-3 mt-1 opacity-80 justify-center">
                            {isPlaying ? (
                                <>
                                    <div className="w-1 bg-blue-500 rounded-t animate-[bounce_1s_infinite_ease-in-out_0.1s] h-[60%]"></div>
                                    <div className="w-1 bg-blue-500 rounded-t animate-[bounce_1s_infinite_ease-in-out_0.3s] h-[100%]"></div>
                                    <div className="w-1 bg-blue-500 rounded-t animate-[bounce_1s_infinite_ease-in-out_0.2s] h-[40%]"></div>
                                    <div className="w-1 bg-blue-500 rounded-t animate-[bounce_1s_infinite_ease-in-out_0.5s] h-[80%]"></div>
                                </>
                            ) : (
                                <div className="w-full h-[2px] bg-blue-500 rounded-full mt-auto"></div>
                            )}
                        </div>
                    </Link>
                    
                    <div className="w-[1px] h-6 bg-white/10"></div>

                    <div className="flex items-center gap-2">
                        <button 
                            onClick={togglePlay} 
                            className="w-8 h-8 bg-blue-500/20 text-blue-500 rounded-full flex items-center justify-center hover:bg-blue-500 hover:text-white transition-all shadow-sm"
                            title={isPlaying ? "Pause Audio" : "Play/Resume Audio"}
                        >
                            {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                        </button>
                        <button 
                            onClick={stopMedia} 
                            className="w-8 h-8 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm"
                            title="Stop Audio"
                        >
                            <Square size={14} fill="currentColor" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}