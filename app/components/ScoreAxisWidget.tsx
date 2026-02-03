'use client';

export default function ScoreAxisWidget({ matchId }: { matchId?: string }) {
  if (!matchId) return null;

  // 1. Check if user pasted a simple ID (12345) or full code (<iframe...)
  const isRawId = /^\d+$/.test(matchId.trim());

  let widgetContent = '';

  if (isRawId) {
    // 🟢 RAW ID STRATEGY
    // We construct the HTML manually. Note: data-links="1" is REQUIRED to prevent blank screen.
    // We will hide the actual links via CSS instead.
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
    // We use exactly what you pasted in Admin
    widgetContent = matchId;
  }

  // ⚡ CSS INJECTION TO FIX SIZE & HIDE LOGO ⚡
  const widgetHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            /* 1. Force Responsive Container */
            body { margin: 0; padding: 0; overflow-x: hidden; width: 100%; font-family: sans-serif; }
            
            /* 2. Constrain the Widget */
            .scoreaxis-widget, iframe { 
                width: 100% !important; 
                max-width: 100vw !important;
                display: block; 
            }

            /* 3. 🔴 HIDE LOGO & FOOTER LINKS 🔴 */
            /* We use !important to override their inline styles */
            a[href*="scoreaxis.com"] { display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none; }
            .sa-footer, .sa-copyright { display: none !important; height: 0 !important; overflow: hidden !important; }
            
            /* Target generic footer containers based on common styles */
            div[style*="font-size: 10px"], div[style*="text-align: right"] { display: none !important; }
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
            height: '650px', // Tall enough for stats, scrollable if needed
            border: 'none',
            display: 'block'
        }}
        title="Match Widget"
        loading="lazy"
      />
    </div>
  );
}