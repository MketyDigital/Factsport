'use client';

import { Zap, Activity } from 'lucide-react';

interface NewsArtworkProps {
  image?: string | null;
  team1Logo?: string | null;
  team2Logo?: string | null;
  title?: string;
  className?: string;
}

export default function NewsArtwork({ image, team1Logo, team2Logo, title, className = "" }: NewsArtworkProps) {
  
  // 1. PRIORITY: If a real photo exists, show it.
  if (image) {
    return (
      <div className={`relative overflow-hidden bg-slate-900 ${className}`}>
        <img src={image} alt={title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
      </div>
    );
  }

  // 2. VERSUS MODE: If two logos exist (e.g. "Man Utd vs Chelsea")
  if (team1Logo && team2Logo) {
    return (
      <div className={`relative overflow-hidden bg-[#0a1428] flex items-center justify-center ${className}`}>
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10 bg-[url('/tournaments/default-bg.jpg')]"></div>
        
        {/* Logos */}
        <div className="relative z-10 flex items-center gap-4 md:gap-8">
           <img src={team1Logo} className="w-12 h-12 md:w-20 md:h-20 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]" />
           <div className="flex flex-col items-center">
             <Zap size={24} className="text-yellow-400 fill-yellow-400 animate-pulse" />
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">VS</span>
           </div>
           <img src={team2Logo} className="w-12 h-12 md:w-20 md:h-20 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]" />
        </div>
        
        {/* Overlay Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent"></div>
      </div>
    );
  }

  // 3. CLUB SPOTLIGHT: If only one logo exists
  if (team1Logo) {
    return (
      <div className={`relative overflow-hidden bg-slate-900 flex items-center justify-center ${className}`}>
         <div className="absolute inset-0 bg-gradient-to-br from-red-900/20 to-blue-900/20"></div>
         {/* Big Faded Logo in Background */}
         <img src={team1Logo} className="absolute w-[120%] h-[120%] object-contain opacity-10 blur-sm scale-150" />
         
         {/* Sharp Logo in Center */}
         <div className="relative z-10">
            <img src={team1Logo} className="w-16 h-16 md:w-24 md:h-24 object-contain drop-shadow-2xl" />
         </div>
         <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent"></div>
      </div>
    );
  }

  // 4. FALLBACK: Generic Breaking News
  return (
    <div className={`relative overflow-hidden bg-slate-800 flex items-center justify-center ${className}`}>
      <Activity size={48} className="text-slate-700 opacity-50" />
      <div className="absolute bottom-4 left-4">
        <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest border border-slate-600 px-2 py-1 rounded">
            Breaking News
        </span>
      </div>
    </div>
  );
}