'use client';

export default function ScoreAxisWidget({ matchId }: { matchId?: string }) {
  if (!matchId) return null;

  // ⚡ PURE DEFAULT CONFIGURATION
  // We do NOT hide links, we do NOT set colors. 
  // We just give them the ID and let them render their default (working) player.
  const widgetHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
            body { margin: 0; padding: 0; background: transparent; font-family: sans-serif; }
            .widget-container { width: 100%; min-height: 500px; }
        </style>
      </head>
      <body>
        <div class="scoreaxis-widget" 
             data-widget-id="${matchId}" 
             data-auto-height="0"> 
        </div>
        <script src="https://www.scoreaxis.com/widget/live-match-widget.js"></script>
      </body>
    </html>
  `;

  return (
    <div className="w-full bg-white rounded-xl border border-slate-200 shadow-sm my-4 overflow-hidden">
      <iframe
        srcDoc={widgetHtml}
        style={{ width: '100%', height: '600px', border: 'none' }}
        title={`Match Widget ${matchId}`}
        loading="lazy"
      />
    </div>
  );
}