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
        <img src={image} alt={title || "News"} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a1428]/90 via-[#0a1428]/20 to-transparent"></div>
      </div>
    );
  }

  // 2. VERSUS MODE: If two logos exist (e.g. "Man Utd vs Chelsea")
  if (team1Logo && team2Logo) {
    return (
      <div className={`relative overflow-hidden bg-[#0a1428] flex items-center justify-center ${className}`}>
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/30 to-red-900/30"></div>
        
        {/* Logos */}
        <div className="relative z-10 flex items-center gap-4 md:gap-8 px-4 w-full justify-center">
           <img src={team1Logo} className="w-14 h-14 md:w-24 md:h-24 object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]" alt="Team 1" />
           <div className="flex flex-col items-center">
             <Zap size={24} className="text-yellow-400 fill-yellow-400 animate-pulse drop-shadow-md" />
             <span className="text-[10px] md:text-xs font-black text-white/50 uppercase tracking-widest mt-1">VS</span>
           </div>
           <img src={team2Logo} className="w-14 h-14 md:w-24 md:h-24 object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]" alt="Team 2" />
        </div>
        
        {/* Overlay Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a1428] via-transparent to-transparent"></div>
      </div>
    );
  }

  // 3. CLUB SPOTLIGHT: If only one logo exists
  if (team1Logo) {
    return (
      <div className={`relative overflow-hidden bg-[#0a1428] flex items-center justify-center ${className}`}>
         <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 to-[#0a1428]"></div>
         {/* Big Faded Logo in Background */}
         <img src={team1Logo} className="absolute w-[150%] h-[150%] object-contain opacity-5 blur-md scale-150" alt="" />
         
         {/* Sharp Logo in Center */}
         <div className="relative z-10 w-full flex justify-center p-6">
            <img src={team1Logo} className="w-20 h-20 md:w-32 md:h-32 object-contain drop-shadow-[0_15px_30px_rgba(0,0,0,0.9)]" alt="Club" />
         </div>
         <div className="absolute inset-0 bg-gradient-to-t from-[#0a1428] via-transparent to-transparent"></div>
      </div>
    );
  }

  // 4. FALLBACK: Blurred Default Background with Factsport Text
  return (
    <div className={`relative overflow-hidden bg-[#0a1428] flex items-center justify-center ${className}`}>
      
      {/* Dynamic Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-tr from-blue-900 via-[#0a1428] to-slate-900"></div>
      <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
      
      {/* Factsport Branding Overlay */}
      <div className="relative z-10 flex flex-col items-center">
        <span className="text-white/20 text-4xl md:text-6xl font-black uppercase tracking-tighter absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          FACTSPORT
        </span>
        
        <div className="flex items-center gap-2 mt-2 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-2xl relative z-20">
          <Activity size={16} className="text-red-500 animate-pulse" />
          <span className="text-white text-[10px] md:text-xs font-black uppercase tracking-widest">
            Latest Update
          </span>
        </div>
      </div>

      <div className="absolute inset-0 bg-gradient-to-t from-[#0a1428] via-transparent to-transparent"></div>
    </div>
  );
}