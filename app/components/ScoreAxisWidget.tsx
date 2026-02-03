'use client';
import { ExternalLink, DollarSign } from 'lucide-react';

// 🟢 FALLBACK LINK (Ensures button always shows)
const DEFAULT_LINK = "https://refpa58144.com/L?tag=d_1181253m_1599c_&site=1181253&ad=1599";

export default function ScoreAxisWidget({ matchId, affiliateLink }: { matchId?: string, affiliateLink?: string }) {
  if (!matchId) return null;

  // Use the specific match link if available, otherwise use default
  const finalLink = affiliateLink || DEFAULT_LINK;
  
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
            /* 1. Page Reset */
            body { 
                margin: 0; 
                padding: 0; 
                background: white; 
                font-family: sans-serif;
                overflow-x: hidden;
            }

            /* 2. SCALE DOWN (Zoom Out) */
            /* This shrinks the widget to 85% size so more lineups fit on screen */
            .widget-wrapper {
                transform: scale(0.85);
                transform-origin: top left;
                width: 117.65%; /* 100% / 0.85 = 117.65% (Compensates for the shrink) */
                padding-bottom: 80px; /* Space for the button */
            }

            /* 3. Disable Logo Clicks */
            a { pointer-events: none !important; cursor: default !important; text-decoration: none !important; }
            
            /* 4. Hide Footer Text */
            .sa-footer, .sa-copyright { opacity: 0; display: none; }
        </style>
      </head>
      <body>
        <div class="widget-wrapper">
            ${widgetContent}
        </div>
      </body>
    </html>
  `;

  return (
    <div className="w-full bg-white rounded-xl border border-slate-200 shadow-sm my-4 overflow-hidden relative">
      
      {/* 1. THE WIDGET FRAME */}
      <iframe
        srcDoc={widgetHtml}
        style={{ 
            width: '100%', 
            height: '600px', // Taller height to accommodate lineups
            border: 'none', 
            display: 'block' 
        }}
        title="Match Widget"
        loading="lazy"
        scrolling="yes"
      />

      {/* 🟢 2. MASKING BUTTON (Pinned to Bottom) */}
      <div className="absolute bottom-0 left-0 w-full bg-white/95 backdrop-blur-sm border-t border-slate-100 p-2 flex justify-between items-center z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.1)] h-[60px]">
          <div className="flex items-center gap-2 pl-2">
              <div className="bg-green-500 text-white p-1.5 rounded-full animate-pulse">
                  <DollarSign size={12} />
              </div>
              <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-800 uppercase tracking-wide leading-none">Best Odds</span>
                  <span className="text-[8px] font-bold text-slate-400">Instant Payouts</span>
              </div>
          </div>
          <a 
              href={finalLink} 
              target="_blank" 
              className="bg-[#0a1428] text-white text-[10px] font-black uppercase px-6 py-2.5 rounded-lg flex items-center gap-2 shadow hover:bg-blue-900 transition active:scale-95"
          >
              Bet on 1xBet <ExternalLink size={10} />
          </a>
      </div>
    </div>
  );
}