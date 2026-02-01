'use client'; // Error components must be Client Components
 
export const runtime = 'edge';

import { useEffect, useState } from 'react';
import { MonitorPlay, RefreshCw, AlertTriangle } from 'lucide-react';
 
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [blame, setBlame] = useState("Checking VAR...");

  useEffect(() => {
    console.error("Global Error:", error);
  }, [error]);

  const excuses = [
    "The referee lost his whistle.",
    "Pitch invasion in the server room.",
    "The developer missed a penalty.",
    "VAR check is taking too long.",
    "Floodlights failure."
  ];

  const generateExcuse = () => {
      const random = excuses[Math.floor(Math.random() * excuses.length)];
      setBlame(random);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-[#F0F2F5]">
      
      {/* VAR Screen Graphic */}
      <div className="bg-black p-1 rounded-2xl shadow-2xl mb-8 rotate-1">
          <div className="bg-slate-900 border-4 border-slate-800 rounded-xl p-8 w-64 md:w-80">
                <MonitorPlay size={48} className="text-red-500 mx-auto mb-4 animate-pulse" />
                <h2 className="text-red-500 font-black text-2xl uppercase tracking-widest mb-1">VAR CHECK</h2>
                <p className="text-white text-[10px] font-mono uppercase animate-pulse">Reviewing Server Error...</p>
          </div>
      </div>

      <h2 className="text-2xl font-black text-slate-900 mb-2">Technical Foul!</h2>
      
      <p className="text-slate-500 mb-4 max-w-xs mx-auto font-medium">
         {blame}
      </p>

      <button onClick={generateExcuse} className="text-xs text-blue-600 font-bold hover:underline mb-8">
          (Click for new excuse)
      </button>
      
      <button
        onClick={() => reset()}
        className="bg-red-600 hover:bg-red-700 text-white font-black py-4 px-8 rounded-2xl shadow-lg shadow-red-200 active:scale-95 transition flex items-center gap-2"
      >
        <RefreshCw size={18} /> REPLAY MATCH
      </button>

      {error.digest && (
        <p className="mt-8 text-[10px] font-mono text-slate-400 bg-slate-200 px-2 py-1 rounded">
          Ref ID: {error.digest}
        </p>
      )}
    </div>
  );
}