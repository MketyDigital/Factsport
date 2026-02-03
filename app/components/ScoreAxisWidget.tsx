'use client';
import { useEffect, useRef } from 'react';

export default function ScoreAxisWidget({ matchId }: { matchId?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!matchId || !containerRef.current) return;

    // 1. Wipe container clean
    containerRef.current.innerHTML = '';

    // 2. Create the wrapper DIV
    const widgetDiv = document.createElement('div');
    widgetDiv.className = "scoreaxis-widget";
    widgetDiv.setAttribute('data-widget-id', matchId);
    widgetDiv.setAttribute('data-auto-height', '1');
    widgetDiv.setAttribute('data-font', '0');
    widgetDiv.setAttribute('data-body-background', 'FFFFFF');
    widgetDiv.setAttribute('data-text-color', '000000');
    widgetDiv.setAttribute('data-links', '0'); 
    
    // 3. Append DIV first
    containerRef.current.appendChild(widgetDiv);

    // 4. Inject Script (Force Reload)
    const script = document.createElement('script');
    script.src = "https://www.scoreaxis.com/widget/live-match-widget.js";
    script.async = true;
    containerRef.current.appendChild(script);

  }, [matchId]);

  if (!matchId) return null;

  return (
    <div className="w-full bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm my-4 min-h-[400px]">
       {/* 🟢 Container for the widget */}
       <div ref={containerRef} className="w-full"></div>
       
       {/* 🟢 Fallback Text (Shows only if widget is loading slowly) */}
       <div className="text-center py-2 text-[10px] text-slate-300">
          Loading Match Data...
       </div>
    </div>
  );
}