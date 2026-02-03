'use client';

export default function ScoreAxisWidget({ matchId }: { matchId?: string }) {
  if (!matchId) return null;

  const isRawId = /^\d+$/.test(matchId.trim());

  let widgetContent = '';

  if (isRawId) {
    // 🟢 RAW ID STRATEGY
    // We MUST set data-links="1" to avoid the blank screen.
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
    // 🟢 FULL EMBED CODE STRATEGY
    widgetContent = matchId;
  }

  // ⚡ THE "FREEZE" CSS INJECTION ⚡
  const widgetHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            /* 1. Basic Reset */
            body { margin: 0; padding: 0; overflow-x: hidden; width: 100%; font-family: sans-serif; }
            
            /* 2. Constrain the Widget */
            .scoreaxis-widget, iframe { 
                width: 100% !important; 
                max-width: 100vw !important;
                display: block; 
            }

            /* 3. 🔴 DISABLE CLICKS ON LOGO 🔴 */
            /* We target all links (<a> tags) inside the widget */
            a { 
                pointer-events: none !important; /* Makes it unclickable */
                cursor: default !important;      /* Keeps the mouse pointer normal (not a hand) */
                text-decoration: none !important; 
                color: inherit !important;
            }
            
            /* Optional: Make the footer smaller/greyer so it's less noticeable */
            .sa-footer, .sa-copyright {
                opacity: 0.5;
                filter: grayscale(100%);
            }
        </style>
      </head>
      <body>
        ${widgetContent}
      </body>
    </html>
  `;

  return (
    <div className="w-full bg-white rounded-xl border border-slate-200 shadow-sm my-4 overflow-hidden relative">
      <iframe
        srcDoc={widgetHtml}
        style={{ 
            width: '100%', 
            height: '500px', 
            border: 'none',
            display: 'block'
        }}
        title="Match Widget"
        loading="lazy"
      />
    </div>
  );
}