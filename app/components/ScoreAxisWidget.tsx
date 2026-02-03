'use client';

export default function ScoreAxisWidget({ matchId }: { matchId?: string }) {
  if (!matchId) return null;

  // We detect if it's a raw numeric ID or a full HTML embed code
  const isRawId = /^\d+$/.test(matchId.trim());

  let widgetHtml = '';

  if (isRawId) {
    // If it's just a number, we try the default ScoreAxis Embed
    widgetHtml = `
      <!DOCTYPE html>
      <html>
        <head><style>body{margin:0;padding:0;}</style></head>
        <body>
          <div class="scoreaxis-widget" data-widget-id="${matchId}" data-auto-height="0"></div>
          <script src="https://www.scoreaxis.com/widget/live-match-widget.js"></script>
        </body>
      </html>
    `;
  } else {
    // If it's full code (starts with <iframe or <div), we render it exactly as pasted
    widgetHtml = `
      <!DOCTYPE html>
      <html>
        <head><style>body{margin:0;padding:0;}</style></head>
        <body>
          ${matchId}
        </body>
      </html>
    `;
  }

  return (
    <div className="w-full bg-white rounded-xl border border-slate-200 shadow-sm my-4 overflow-hidden">
      <iframe
        srcDoc={widgetHtml}
        style={{ width: '100%', height: '600px', border: 'none' }}
        title="Match Widget"
        loading="lazy"
      />
    </div>
  );
}