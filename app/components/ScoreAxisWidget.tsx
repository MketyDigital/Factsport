'use client';
import { useEffect } from 'react';

export default function ScoreAxisWidget({ matchId }: { matchId?: string }) {
  useEffect(() => {
    if (!matchId) return;

    // 1. Target the specific container for this match
    const containerId = `scoreaxis-widget-${matchId}`;
    const container = document.getElementById(containerId);
    
    if (!container) return;

    // 2. Clear previous content
    container.innerHTML = '';

    // 3. Create the widget wrapper
    const widgetDiv = document.createElement('div');
    widgetDiv.className = "scoreaxis-widget";
    widgetDiv.setAttribute('data-widget-id', matchId);
    widgetDiv.setAttribute('data-auto-height', '1');
    widgetDiv.setAttribute('data-font', '0');
    widgetDiv.setAttribute('data-body-background', 'FFFFFF');
    widgetDiv.setAttribute('data-text-color', '000000');
    widgetDiv.setAttribute('data-links', '0');
    widgetDiv.setAttribute('data-inst', '1181253'); // Your provided instruction ID

    container.appendChild(widgetDiv);

    // 4. Inject script
    const script = document.createElement('script');
    script.src = "https://www.scoreaxis.com/widget/live-match-widget.js";
    script.async = true;
    container.appendChild(script);

  }, [matchId]);

  if (!matchId) return null;

  return (
    <div className="w-full bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm my-4 min-h-[150px]">
       <div id={`scoreaxis-widget-${matchId}`} className="w-full"></div>
    </div>
  );
}