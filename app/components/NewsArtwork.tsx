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

  // 4. FALLBACK: Blurred Default Background with Factsport Text
  return (
    <div className={`relative overflow-hidden bg-slate-900 flex items-center justify-center ${className}`}>
      
      {/* Blurred Default Background */}
      <div className="absolute inset-0 bg-[url('/tournaments/default-bg.jpg')] bg-cover bg-center opacity-50 blur-[3px] scale-105"></div>
      
      {/* Factsport Breaking News Overlay */}
      <div className="relative z-10 flex flex-col items-center">
        <span className="text-white text-xl md:text-3xl font-black uppercase tracking-widest drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">
          Factsport
        </span>
        
        <div className="flex items-center gap-2 mt-2">
          <Activity size={16} className="text-red-500 animate-pulse" />
          <span className="text-white text-[10px] md:text-xs font-bold uppercase tracking-widest bg-red-600/80 border border-red-500 px-3 py-1 rounded shadow-lg backdrop-blur-sm">
            Breaking News
          </span>
        </div>
      </div>

      {/* Bottom Gradient for readability if text sits on top of this container elsewhere */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
    </div>
  );
}