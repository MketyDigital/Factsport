'use client';

export default function ScoreAxisWidget({ matchId }: { matchId?: string }) {
  if (!matchId) return null;

  // We write the HTML exactly as ScoreAxis wants it, inside a sealed box.
  const widgetHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
            body { margin: 0; padding: 0; display: flex; justify-content: center; background: transparent; }
            .scoreaxis-widget { width: 100% !important; }
        </style>
      </head>
      <body>
        <div class="scoreaxis-widget" 
             data-widget-id="${matchId}" 
             data-auto-height="1" 
             data-font="0" 
             data-body-background="FFFFFF" 
             data-text-color="000000">
        </div>
        <script src="https://www.scoreaxis.com/widget/live-match-widget.js"></script>
      </body>
    </html>
  `;

  return (
    <div className="w-full bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm my-4">
      <iframe
        srcDoc={widgetHtml}
        style={{ width: '100%', height: '500px', border: 'none' }}
        title={`Match Widget ${matchId}`}
        loading="lazy"
      />
    </div>
  );
}