'use client';

import { useState, useEffect } from 'react';
import { Play, ExternalLink, Loader2 } from 'lucide-react';

const AD_CONFIG = {
  image: "https://images.unsplash.com/photo-1518091043644-c1d4457512c6?q=80&w=1000&auto=format&fit=crop", 
  link: "https://bit.ly/your-affiliate-link",
  timer: 5 
};

export default function FactSportPlayer({ videoUrl }: { videoUrl: string }) {
  const [showAd, setShowAd] = useState(true);
  const [timer, setTimer] = useState(AD_CONFIG.timer);

  useEffect(() => {
    if (showAd && timer > 0) {
      const interval = setInterval(() => setTimer((t) => t - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [showAd, timer]);

  // Enhanced Embed Logic
  const getVideoContent = (url: string) => {
    // 1. YouTube (Strict Mode)
    // modestbranding=1, rel=0, controls=1, playsinline=1 (keeps it in div on mobile)
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      let videoId = '';
      if (url.includes('v=')) videoId = url.split('v=')[1]?.split('&')[0];
      else if (url.includes('.be/')) videoId = url.split('.be/')[1];
      else if (url.includes('embed/')) videoId = url.split('embed/')[1];
      
      return (
        <iframe 
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&modestbranding=1&rel=0&showinfo=0&controls=1&playsinline=1&fs=1`} 
          className="w-full h-full" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
          allowFullScreen
        ></iframe>
      );
    }

    // 2. Direct Video File (.mp4)
    if (url.match(/\.(mp4|webm|ogg)$/i)) {
      return (
        <video controls autoPlay playsInline className="w-full h-full bg-black">
          <source src={url} type="video/mp4" />
        </video>
      );
    }

    // 3. Generic Embed
    return <iframe src={url} className="w-full h-full" allowFullScreen allow="autoplay; fullscreen"></iframe>;
  };

  return (
    <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800 group">
      
      {/* AD OVERLAY */}
      {showAd && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black">
           <img src={AD_CONFIG.image} className="absolute inset-0 w-full h-full object-cover opacity-80" />
           <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black"></div>
           <div className="absolute bottom-6 right-6 z-40">
             {timer > 0 ? (
               <div className="bg-black/80 backdrop-blur text-white text-xs font-bold px-5 py-2.5 rounded-full border border-white/10 flex items-center gap-2">
                 <Loader2 size={12} className="animate-spin" /> Ad ending in {timer}s
               </div>
             ) : (
               <button onClick={() => setShowAd(false)} className="bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-black px-6 py-2.5 rounded-full shadow-[0_0_20px_rgba(234,179,8,0.5)] flex items-center gap-2 transition transform hover:scale-105">
                 Skip Ad <Play size={12} fill="black" />
               </button>
             )}
           </div>
           <a href={AD_CONFIG.link} target="_blank" className="absolute top-4 right-4 bg-blue-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg z-40 flex items-center gap-1 hover:bg-blue-500 shadow-lg">Visit Site <ExternalLink size={10} /></a>
        </div>
      )}

      {/* VIDEO CONTENT */}
      {!showAd && (
        <div className="w-full h-full relative">
            {getVideoContent(videoUrl)}
        </div>
      )}
    </div>
  );
}