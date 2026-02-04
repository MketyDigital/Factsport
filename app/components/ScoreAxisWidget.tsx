'use client';
import { ExternalLink, DollarSign } from 'lucide-react';

const DEFAULT_LINK = "https://refpa58144.com/L?tag=d_1181253m_1599c_&site=1181253&ad=1599";

export default function ScoreAxisWidget({ matchId, affiliateLink }: { matchId?: string, affiliateLink?: string }) {
  if (!matchId) return null;

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
    // 🟢 FULL CODE STRATEGY (Uses your specific minimum size embed)
    widgetContent = matchId;
  }

  const widgetHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            /* 1. ROBUST RESET */
            body, html { 
                margin: 0; 
                padding: 0; 
                height: 100%; /* Ensure full height */
                background: white; 
                font-family: sans-serif;
                overflow-x: hidden; /* No horizontal scroll */
            }

            /* 2. PUSH CONTENT UP */
            /* We add padding to the bottom so the last item isn't hidden behind the button */
            body { 
                padding-bottom: 70px !important; 
                box-sizing: border-box;
            }

            /* 3. WIDGET SIZING */
            .scoreaxis-widget, iframe { 
                width: 100% !important; 
                display: block; 
            }

            /* 4. 🟢 THE "ANCHOR" FIX */
            /* We force the footer to stick to the bottom of the SCREEN, not the content */
            .widget-main-link, .sa-footer, .sa-copyright, div[style*="text-align: right"] {
                position: fixed !important;
                bottom: 0px !important;
                left: 0 !important;
                width: 100% !important;
                height: 40px !important; /* Fixed height for the footer */
                background: white !important;
                z-index: 1 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                pointer-events: none !important; /* Disable clicks */
            }

            /* 5. Disable Links */
            a { pointer-events: none !important; cursor: default !important; text-decoration: none !important; }
        </style>
      </head>
      <body>
        ${widgetContent}
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
            height: '550px', // Tall enough for your content
            border: 'none', 
            display: 'block' 
        }}
        title="Match Widget"
        loading="lazy"
        scrolling="yes" // Allow scrolling if list is long
      />

      {/* 🟢 2. MASKING BUTTON (Pins to Bottom) */}
      {/* Z-Index 50 ensures it sits ON TOP of the fixed footer inside the iframe */}
      <div className="absolute bottom-0 left-0 w-full bg-white border-t border-slate-100 p-2 flex justify-between items-center z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.1)] h-[60px]">
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