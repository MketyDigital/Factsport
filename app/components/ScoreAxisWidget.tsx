'use client';
import { useEffect, useRef } from 'react';

export default function ScoreAxisWidget({ matchId }: { matchId?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. Safety Check
    if (!matchId || !containerRef.current) return;

    // 2. Clear previous widget to prevent duplicates
    containerRef.current.innerHTML = '';

    // 3. Create the widget container required by ScoreAxis
    // Their script looks for a div with a specific class or ID usually, 
    // but the modern script creates an iframe inside the script tag's location.
    const widgetDiv = document.createElement('div');
    widgetDiv.className = "scoreaxis-widget";
    widgetDiv.setAttribute('data-react-widget', 'true');
    containerRef.current.appendChild(widgetDiv);

    // 4. Create the Script
    const script = document.createElement('script');
    script.src = "https://www.scoreaxis.com/widget/live-match-widget.js";
    script.async = true;
    
    // 5. Set Attributes (Crucial for the "New Version")
    script.setAttribute('data-widget-id', matchId);
    script.setAttribute('data-auto-height', '1'); // Fixes the height/overlap issue!
    script.setAttribute('data-font', '0');
    script.setAttribute('data-body-background', 'FFFFFF');
    script.setAttribute('data-text-color', '000000');
    
    // 6. Append to our container
    widgetDiv.appendChild(script);

    return () => {
      // Cleanup
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [matchId]);

  if (!matchId) return null;

  return (
    <div 
        ref={containerRef} 
        className="w-full bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm my-4 min-h-[100px]"
    >
        {/* The Script will inject the widget here automatically */}
    </div>
  );
}