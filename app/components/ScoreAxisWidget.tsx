'use client';
import { ExternalLink, DollarSign } from 'lucide-react';

export default function ScoreAxisWidget({ matchId, affiliateLink }: { matchId?: string, affiliateLink?: string }) {
  if (!matchId) return null;

  const isRawId = /^\d+$/.test(matchId.trim());
  let widgetContent = '';

  if (isRawId) {
    widgetContent = `
      <div class="scoreaxis-widget" 
           data-widget-id="${matchId}" 
           data-auto-height="0" 
           data-font="0" 
           data-body-background="FFFFFF" 
           data-text-color="000000"
           data-links="1"> 
      </div>
      <script src="https://www.scoreaxis.com/widget/live-match-widget.js"></script>
    `;
  } else {
    widgetContent = matchId;
  }

  const widgetHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            /* 1. Reset & Scroll */
            body { 
                margin: 0; 
                padding: 0; 
                background: white; 
                font-family: sans-serif; 
                overflow-y: auto; /* Allow scrolling if content is long */
                
                /* 🟢 SCALE DOWN THE WIDGET (Zoom 85%) */
                transform: scale(0.85);
                transform-origin: top left;
                width: 117.6%; /* Compensate width (100% / 0.85) to fill screen */
                height: 100%;
            }
            
            /* 2. Constrain */
            .scoreaxis-widget, iframe { display: block; }

            /* 3. Freeze Links (Disable clicks on logo) */
            a { pointer-events: none !important; cursor: default !important; text-decoration: none !important; }
            
            /* 4. Pad bottom so content isn't hidden behind the Bet Button */
            body { padding-bottom: 50px; } 
        </style>
      </head>
      <body>
        ${widgetContent}
      </body>
    </html>
  `;

  return (
    <div className="w-full bg-white rounded-xl border border-slate-200 shadow-sm my-4 overflow-hidden relative">
      
      {/* 1. THE WIDGET (With Scroll Enabled) */}
      <iframe
        srcDoc={widgetHtml}
        style={{ 
            width: '100%', 
            height: '550px', // Fixed height that fits nicely on mobile
            border: 'none', 
            display: 'block' 
        }}
        title="Match Widget"
        loading="lazy"
        // 🟢 'yes' allows the user to scroll inside the box to see Lineups/Stats
        scrolling="yes" 
      />

      {/* 🟢 2. MASKING BUTTON (Overlaps the bottom) */}
      {/* Solid white background hides the ScoreAxis footer/logo behind it */}
      {affiliateLink && (
        <div className="absolute bottom-0 left-0 w-full bg-white border-t border-slate-100 p-2 flex justify-between items-center z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
            <div className="flex items-center gap-2 pl-2">
                <div className="bg-green-500 text-white p-1 rounded-full animate-pulse">
                    <DollarSign size={10} />
                </div>
                <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide">Live Odds</span>
            </div>
            <a 
                href={affiliateLink} 
                target="_blank" 
                className="bg-[#0a1428] text-white text-[10px] font-black uppercase px-6 py-2.5 rounded-lg flex items-center gap-2 shadow hover:bg-blue-900 transition active:scale-95"
            >
                Bet on 1xBet <ExternalLink size={10} />
            </a>
        </div>
      )}
    </div>
  );
}