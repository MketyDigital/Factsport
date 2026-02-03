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
    widgetContent = matchId;
  }

  const widgetHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            /* 1. Freeze Page */
            body { 
                margin: 0; 
                padding: 0; 
                background: white; 
                font-family: sans-serif;
                overflow: hidden; /* 🟢 DISABLE SCROLLING */
                padding-bottom: 60px; /* Space for the button/logo area */
            }

            /* 2. Universal Widget Fit */
            .scoreaxis-widget, iframe { 
                width: 100% !important; 
                display: block; 
            }

            /* 3. 🟢 GRAVITY FIX: Force Logo to Bottom */
            /* This grabs the ScoreAxis footer text and pins it to the floor */
            .sa-footer, .sa-copyright, div[style*="text-align: right"] {
                position: fixed !important;
                bottom: 5px !important;
                left: 0 !important;
                width: 100% !important;
                text-align: center !important;
                background: white; /* Cover anything behind it */
                z-index: 0;
            }

            /* 4. Disable Clicks on Links */
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
      
      {/* 1. THE WIDGET */}
      <iframe
        srcDoc={widgetHtml}
        style={{ 
            width: '100%', 
            height: '520px', // 🟢 Set this to your preferred "Perfect Fit" height
            border: 'none', 
            display: 'block' 
        }}
        title="Match Widget"
        loading="lazy"
        scrolling="no" // 🟢 Scrollbar Removed
      />

      {/* 🟢 2. MASKING BUTTON (Pins to Bottom, covering the logo) */}
      <div className="absolute bottom-0 left-0 w-full bg-white border-t border-slate-100 p-2 flex justify-between items-center z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.1)] h-[50px]">
          <div className="flex items-center gap-2 pl-2">
              <div className="bg-green-500 text-white p-1 rounded-full animate-pulse">
                  <DollarSign size={10} />
              </div>
              <span className="text-[10px] font-black text-slate-800 uppercase tracking-wide">Live Odds</span>
          </div>
          <a 
              href={finalLink} 
              target="_blank" 
              className="bg-[#0a1428] text-white text-[10px] font-black uppercase px-6 py-2 rounded-lg flex items-center gap-2 shadow hover:bg-blue-900 transition active:scale-95"
          >
              Bet on 1xBet <ExternalLink size={10} />
          </a>
      </div>
    </div>
  );
}