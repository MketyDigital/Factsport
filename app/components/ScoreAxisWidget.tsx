'use client';
import { useEffect, useRef } from 'react';

export default function ScoreAxisWidget({ matchId }: { matchId?: string }) {
  const widgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!matchId || !widgetRef.current) return;

    // 1. Cleanup: Clear previous widget content
    widgetRef.current.innerHTML = '';

    // 2. Setup the widget container
    const widgetDiv = document.createElement('div');
    widgetDiv.className = "scoreaxis-widget";
    widgetDiv.setAttribute('data-widget-id', matchId);
    widgetDiv.setAttribute('data-auto-height', '1');
    widgetDiv.setAttribute('data-font', '0');
    widgetDiv.setAttribute('data-body-background', 'FFFFFF');
    widgetDiv.setAttribute('data-text-color', '000000');
    widgetDiv.setAttribute('data-links', '0');
    
    // 3. Append container first
    widgetRef.current.appendChild(widgetDiv);

    // 4. Inject script with a tiny delay to ensure React has rendered the Div
    const timer = setTimeout(() => {
        const script = document.createElement('script');
        script.src = "https://www.scoreaxis.com/widget/live-match-widget.js";
        script.async = true;
        if (widgetRef.current) {
            widgetRef.current.appendChild(script);
        }
    }, 100);

    return () => clearTimeout(timer);
  }, [matchId]);

  if (!matchId) return null;

  return (
    <div className="w-full bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm my-4 min-h-[150px]">
       {/* Widget Container */}
       <div ref={widgetRef} className="w-full"></div>
    </div>
  );
}