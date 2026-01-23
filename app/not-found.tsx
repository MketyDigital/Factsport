'use client'; // Needed for the mini-game state

import Link from 'next/link';
import { Home, Flag, Trophy } from 'lucide-react';
import { useState } from 'react';

export default function NotFound() {
  const [result, setResult] = useState<string | null>(null);

  const shoot = () => {
    const outcomes = ["GOAL! ⚽", "MISSED! ❌", "SAVED! 🧤", "POST! 🥅"];
    const random = outcomes[Math.floor(Math.random() * outcomes.length)];
    setResult(random);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a1428] text-white p-6 font-sans relative overflow-hidden">
      
      {/* Background Texture */}
      <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/grass.png')] opacity-10"></div>
      
      <div className="relative z-10 text-center max-w-md">
        
        {/* Animated Icon */}
        <div className="bg-red-600 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(220,38,38,0.5)] animate-bounce">
            <Flag size={48} className="text-white fill-white" />
        </div>

        <h2 className="text-5xl font-black italic tracking-tighter mb-2">OFFSIDE!</h2>
        <p className="text-slate-400 mb-8 text-lg">
            The linesman raised his flag. We couldn't find that page.
        </p>

        {/* --- MINI GAME --- */}
        <div className="bg-white/5 border border-white/10 p-6 rounded-2xl mb-8 backdrop-blur-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">While you're here, take a penalty</p>
            
            {result ? (
                <div className="mb-4">
                    <div className={`text-3xl font-black ${result.includes("GOAL") ? "text-green-400" : "text-red-400"} animate-in zoom-in duration-300`}>
                        {result}
                    </div>
                    {result.includes("GOAL") && <p className="text-xs text-yellow-400 mt-1">What a finish! 🏆</p>}
                </div>
            ) : (
                <div className="h-10 mb-4 flex items-center justify-center text-slate-600 text-sm italic">
                    Waiting for whistle...
                </div>
            )}

            <button 
                onClick={shoot}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl shadow-lg active:scale-95 transition"
            >
                SHOOT! ⚽
            </button>
        </div>
        {/* ---------------- */}

        <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-slate-300 hover:text-white font-bold transition hover:underline"
        >
            <Home size={18} /> Return to the Pitch
        </Link>
      </div>
    </div>
  );
}