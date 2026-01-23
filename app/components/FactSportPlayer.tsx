'use client';
import { useState, useEffect } from 'react';
import { Play, ExternalLink } from 'lucide-react';

export default function FactSportPlayer({ videoUrl }: { videoUrl: string }) {
  const [showAd, setShowAd] = useState(true);
  const [timer, setTimer] = useState(5);

  useEffect(() => {
    if (showAd && timer > 0) {
      const interval = setInterval(() => setTimer((t) => t - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [showAd, timer]);

  const getEmbedUrl = (url: string) => {
    if (url.includes('youtube.com/watch')) return `https://www.youtube.com/embed/${url.split('v=')[1]?.split('&')[0]}?autoplay=1`;
    if (url.includes('youtu.be')) return `https://www.youtube.com/embed/${url.split('.be/')[1]}?autoplay=1`;
    return url;
  };

  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-slate-800">
      {showAd && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black">
           <img src="https://images.unsplash.com/photo-1555861496-0666c8981751?q=80&w=1000&auto=format&fit=crop" className="absolute inset-0 w-full h-full object-cover opacity-60" />
           <div className="absolute bottom-4 right-4 z-30">
             {timer > 0 ? (
               <div className="bg-black/80 text-white text-xs font-bold px-4 py-2 rounded-full border border-white/20">Skip in {timer}s</div>
             ) : (
               <button onClick={() => setShowAd(false)} className="bg-yellow-500 text-black text-xs font-black px-6 py-2 rounded-full flex items-center gap-2">Skip Ad <Play size={12} fill="black" /></button>
             )}
           </div>
           <a href="https://bit.ly/your-affiliate-link" target="_blank" className="absolute top-4 right-4 bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded z-30 flex items-center gap-1">Visit Site <ExternalLink size={10} /></a>
        </div>
      )}
      {!showAd && <iframe src={getEmbedUrl(videoUrl)} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>}
    </div>
  );
}