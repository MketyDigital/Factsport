'use client';
import { useEffect } from 'react';

export default function ScoreAxisWidget({ matchId }: { matchId?: string }) {
  useEffect(() => {
    if (!matchId) return;

    // 1. Find the container
    const container = document.getElementById(`scoreaxis-widget-${matchId}`);
    if (!container) return;

    // 2. Clear it completely (Hard Reset)
    container.innerHTML = '';

    // 3. Create the ScoreAxis specific DIV
    const widgetDiv = document.createElement('div');
    widgetDiv.className = "scoreaxis-widget";
    widgetDiv.setAttribute('data-widget-id', matchId);
    widgetDiv.setAttribute('data-auto-height', '1');
    widgetDiv.setAttribute('data-font', '0');
    widgetDiv.setAttribute('data-body-background', 'FFFFFF');
    widgetDiv.setAttribute('data-text-color', '000000');
    widgetDiv.setAttribute('data-links', '0'); // Remove external links
    widgetDiv.setAttribute('data-inst', '1181253'); // Your provided instruction ID
    
    container.appendChild(widgetDiv);

    // 4. Inject Script Freshly
    const script = document.createElement('script');
    script.src = "https://www.scoreaxis.com/widget/live-match-widget.js";
    script.async = true;
    container.appendChild(script);

  }, [matchId]);

  if (!matchId) return null;

  return (
    <div className="w-full bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm my-4 min-h-[150px]">
       {/* Unique ID ensures the script finds the right box */}
       <div id={`scoreaxis-widget-${matchId}`} className="w-full"></div>
       
       {/* Helper text if it takes too long */}
       <div className="text-center py-4 text-[10px] text-slate-300 pointer-events-none">
          Loading Live Data...
       </div>
    </div>
  );
}