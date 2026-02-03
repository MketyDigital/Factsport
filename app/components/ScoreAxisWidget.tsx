'use client';
import { useState } from 'react';
import Script from 'next/script';

export default function ScoreAxisWidget({ matchId }: { matchId?: string }) {
  // State to track if the script has finished loading
  const [isLoaded, setIsLoaded] = useState(false);

  if (!matchId) return null;

  return (
    <div className="w-full bg-white rounded-xl border border-slate-200 shadow-sm my-4 overflow-hidden relative">
       
       {/* 1. The Container ScoreAxis Looks For */}
       {/* We enforce a minimum height so it can't collapse to 0px */}
       <div 
         id={`scoreaxis-widget-${matchId}`}
         className="scoreaxis-widget" 
         data-widget-id={matchId}
         data-auto-height="1"
         data-font="0"
         data-body-background="FFFFFF"
         data-text-color="000000"
         data-links="1" 
         style={{ width: '100%', minHeight: '500px', display: 'block' }}
       ></div>

       {/* 2. Loading State */}
       {!isLoaded && (
         <div className="absolute inset-0 flex items-center justify-center bg-slate-50 text-slate-400 text-xs">
            Loading Live Match Data...
         </div>
       )}

       {/* 3. The Script Loader (Next.js Native) */}
       {/* strategy="lazyOnload" loads it after the page is ready, preventing conflicts */}
       <Script 
         src="https://www.scoreaxis.com/widget/live-match-widget.js"
         strategy="lazyOnload"
         onLoad={() => {
           console.log('ScoreAxis Script Loaded');
           setIsLoaded(true);
         }}
         onError={(e) => {
           console.error('ScoreAxis Script Failed', e);
         }}
       />
    </div>
  );
}