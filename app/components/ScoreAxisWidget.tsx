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
            body { margin: 0; padding: 0; overflow-x: hidden; width: 100%; font-family: sans-serif; }
            .scoreaxis-widget, iframe { width: 100% !important; max-width: 100vw !important; display: block; }
            
            /* Disable clicks inside the widget to prevent leaving the site */
            a { pointer-events: none !important; cursor: default !important; text-decoration: none !important; color: inherit !important; }
            
            /* Make footer tiny so it's easier to cover */
            .sa-footer, .sa-copyright { font-size: 10px !important; opacity: 1; }
        </style>
      </head>
      <body>
        ${widgetContent}
      </body>
    </html>
  `;

  return (
    <div className="w-full bg-white rounded-xl border border-slate-200 shadow-sm my-4 overflow-hidden relative group">
      {/* 1. THE WIDGET */}
      <iframe
        srcDoc={widgetHtml}
        style={{ width: '100%', height: '450px', border: 'none', display: 'block' }}
        title="Match Widget"
        loading="lazy"
      />

      {/* 🟢 2. MASKING BET BUTTON (Floats on top of the footer) */}
      {/* Position 'absolute bottom-0' makes it stick to the bottom, covering the logo. */}
      {affiliateLink && (
        <div className="absolute bottom-0 left-0 w-full bg-white/95 backdrop-blur-sm border-t border-slate-100 p-2 flex justify-between items-center z-20 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
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