'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, ExternalLink, Loader2, Info 
} from 'lucide-react';

// --- 🔧 AD CONFIGURATION ---
const AD_CONFIG = {
  image: "https://images.unsplash.com/photo-1518091043644-c1d4457512c6?q=80&w=1000&auto=format&fit=crop",
  link: "https://bit.ly/your-affiliate-link",
  timer: 5 
};
// ---------------------------

export default function FactSportPlayer({ videoUrl }: { videoUrl: string }) {
  const [viewState, setViewState] = useState<'thumbnail' | 'ad' | 'playing'>('thumbnail');
  const [timer, setTimer] = useState(AD_CONFIG.timer);
  
  // Custom Player State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);

  // --- AD TIMER LOGIC ---
  useEffect(() => {
    if (viewState === 'ad' && timer > 0) {
      const interval = setInterval(() => setTimer((t) => t - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [viewState, timer]);

  // --- CUSTOM PLAYER LOGIC (For MP4s) ---
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const total = videoRef.current.duration;
      setProgress((current / total) * 100);
    }
  };

  const handleFullscreen = () => {
    const container = document.getElementById('factsport-player-container');
    if (container) {
      if (!document.fullscreenElement) container.requestFullscreen();
      else document.exitFullscreen();
    }
  };

  // --- RENDERERS ---

  // 1. YouTube Renderer (Max Privacy)
  const renderYouTube = (url: string) => {
    let videoId = '';
    if (url.includes('v=')) videoId = url.split('v=')[1]?.split('&')[0];
    else if (url.includes('.be/')) videoId = url.split('.be/')[1];
    else if (url.includes('embed/')) videoId = url.split('embed/')[1];

    return (
      <div className="w-full h-full bg-black relative">
        <iframe 
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&modestbranding=1&rel=0&showinfo=0&controls=1&playsinline=1&fs=1&color=white&iv_load_policy=3`} 
          className="w-full h-full" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
          allowFullScreen
        ></iframe>
      </div>
    );
  };

  // 2. Third-Party Iframe (Robust Container)
  const renderGenericIframe = (url: string) => {
    return (
      <div className="w-full h-full bg-black relative">
        <iframe 
          src={url} 
          className="w-full h-full" 
          allowFullScreen 
          allow="autoplay; fullscreen; picture-in-picture"
          referrerPolicy="no-referrer"
        ></iframe>
        {/* Branding Overlay (Bottom Right) */}
        <div className="absolute bottom-2 right-2 bg-black/50 text-white/50 text-[8px] px-2 py-1 rounded pointer-events-none z-10">
          Powered by FactSport
        </div>
      </div>
    );
  };

  // 3. Custom HTML5 Player (The "White Label" King)
  const renderCustomPlayer = (url: string) => {
    return (
      <div className="w-full h-full bg-black relative group" id="factsport-player-container">
        <video 
          ref={videoRef}
          src={url} 
          className="w-full h-full object-contain" 
          autoPlay 
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setIsPlaying(false)}
          onClick={togglePlay}
        />
        
        {/* Custom Controls Overlay */}
        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/90 to-transparent px-4 py-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          {/* Progress Bar */}
          <div className="w-full h-1 bg-white/20 rounded-full mb-3 cursor-pointer overflow-hidden">
            <div className="h-full bg-red-600 transition-all duration-100" style={{ width: `${progress}%` }}></div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={togglePlay} className="text-white hover:text-red-500 transition">
                {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
              </button>
              <button onClick={toggleMute} className="text-white hover:text-gray-300 transition">
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <span className="text-white text-xs font-bold tracking-widest"><span className="text-red-600">LIVE</span> HIGHLIGHTS</span>
            </div>
            
            <button onClick={handleFullscreen} className="text-white hover:text-red-500 transition">
              <Maximize size={20} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // --- MAIN RENDER LOGIC ---
  const renderContent = () => {
    // A. THUMBNAIL (Premium Start)
    if (viewState === 'thumbnail') {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a1428] cursor-pointer group" onClick={() => setViewState('ad')}>
           {/* Fallback pattern if no image */}
           <div className="absolute inset-0 opacity-30 bg-[radial-gradient(#ffffff33_1px,transparent_1px)] [background-size:16px_16px]"></div>
           <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
           
           <div className="relative z-10 flex flex-col items-center">
              <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(220,38,38,0.6)] group-hover:scale-110 transition duration-300 animate-pulse">
                  <Play className="text-white fill-white ml-1" size={32} />
              </div>
              <p className="text-white text-xs font-bold mt-4 tracking-widest uppercase opacity-80 group-hover:opacity-100">Watch Highlights</p>
           </div>
        </div>
      );
    }

    // B. ADVERTISEMENT (Revenue)
    if (viewState === 'ad') {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-50">
           <img src={AD_CONFIG.image} className="absolute inset-0 w-full h-full object-cover opacity-80" />
           <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black"></div>

           <div className="absolute bottom-6 right-6 z-50">
             {timer > 0 ? (
               <div className="bg-black/90 backdrop-blur text-white text-xs font-bold px-5 py-2.5 rounded-full border border-white/10 flex items-center gap-2 shadow-xl">
                 <Loader2 size={12} className="animate-spin text-yellow-500" /> Ad ends in {timer}s
               </div>
             ) : (
               <button onClick={() => setViewState('playing')} className="bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-black px-8 py-3 rounded-full shadow-[0_0_20px_rgba(234,179,8,0.6)] flex items-center gap-2 transition transform hover:scale-105 animate-bounce">
                 SKIP AD <Play size={12} fill="black" />
               </button>
             )}
           </div>
           
           <a href={AD_CONFIG.link} target="_blank" className="absolute top-4 right-4 bg-blue-600 text-white text-[10px] font-bold px-4 py-2 rounded-lg z-50 flex items-center gap-1 hover:bg-blue-500 shadow-lg border border-white/10">
             Open Site <ExternalLink size={10} />
           </a>
        </div>
      );
    }

    // C. VIDEO PLAYER (The Content)
    if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
      return renderYouTube(videoUrl);
    } 
    
    if (videoUrl.match(/\.(mp4|webm|ogg)$/i)) {
      return renderCustomPlayer(videoUrl);
    }

    // Fallback for generic iframes (Streamable, etc.)
    return renderGenericIframe(videoUrl);
  };

  return (
    <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800 ring-1 ring-white/10">
      {renderContent()}
    </div>
  );
}