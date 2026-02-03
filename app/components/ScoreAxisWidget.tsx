'use client';
import { useEffect, useRef } from 'react';

export default function ScoreAxisWidget({ matchId }: { matchId?: string }) {
  const widgetContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!matchId || !widgetContainerRef.current) return;

    // 1. Clear any existing widget to prevent duplicates
    widgetContainerRef.current.innerHTML = '';

    // 2. Create the wrapper DIV that ScoreAxis looks for
    const widgetDiv = document.createElement('div');
    // This class and attribute are vital for their script to find the element
    widgetDiv.className = "scoreaxis-widget"; 
    widgetDiv.setAttribute('data-widget-id', matchId);
    widgetDiv.setAttribute('data-auto-height', '1'); // Auto-resize height
    widgetDiv.setAttribute('data-font', '0'); // System font
    widgetDiv.setAttribute('data-body-background', 'FFFFFF');
    widgetDiv.setAttribute('data-text-color', '000000');
    widgetDiv.setAttribute('data-links', '0'); // Disable external links if possible

    // 3. Append the wrapper to our container
    widgetContainerRef.current.appendChild(widgetDiv);

    // 4. Inject the Script
    const script = document.createElement('script');
    script.src = "https://www.scoreaxis.com/widget/live-match-widget.js";
    script.async = true;
    widgetContainerRef.current.appendChild(script);

    return () => {
      // Cleanup on unmount
      if (widgetContainerRef.current) {
        widgetContainerRef.current.innerHTML = '';
      }
    };
  }, [matchId]);

  if (!matchId) return null;

  return (
    <div 
      ref={widgetContainerRef} 
      className="w-full bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm my-4 min-h-[200px]"
    >
      {/* Widget loads here */}
    </div>
  );
}