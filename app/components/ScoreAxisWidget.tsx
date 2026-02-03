'use client';
import { useEffect, useRef } from 'react';

export default function ScoreAxisWidget({ matchId }: { matchId?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!matchId || !containerRef.current) return;

    // 1. Clean up previous instance
    containerRef.current.innerHTML = '';

    // 2. Create the widget container
    const widgetDiv = document.createElement('div');
    widgetDiv.className = "scoreaxis-widget";
    widgetDiv.setAttribute('data-widget-id', matchId);
    widgetDiv.setAttribute('data-auto-height', '1'); // Keeps it responsive
    widgetDiv.setAttribute('data-font', '0');
    widgetDiv.setAttribute('data-body-background', 'FFFFFF');
    widgetDiv.setAttribute('data-text-color', '000000');
    // 🔴 REMOVED 'data-links="0"' - This causes blank screens on free plans
    
    containerRef.current.appendChild(widgetDiv);

    // 3. Inject Script
    const script = document.createElement('script');
    script.src = "https://www.scoreaxis.com/widget/live-match-widget.js";
    script.async = true;
    containerRef.current.appendChild(script);

  }, [matchId]);

  if (!matchId) return null;

  return (
    <div className="w-full bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm my-4 min-h-[200px]">
       <div ref={containerRef} className="w-full"></div>
       <p className="text-center text-[9px] text-slate-300 py-2">Loading Live Data...</p>
    </div>
  );
}