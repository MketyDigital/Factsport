'use client';

export default function AdsterraNativeBanner() {
    // 🟢 The Sandbox: HTML structure strictly defined to allow Adsterra scripts to execute safely
    const adHtml = `
        <!DOCTYPE html>
        <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body, html { margin: 0; padding: 0; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; background: transparent; overflow: hidden; }
                </style>
            </head>
            <body>
                <script type="text/javascript" src="https://duepose.com/c280e1cae35afe77612b6777cbe424b6/invoke.js" async data-cfasync="false"></script>
            </body>
        </html>
    `;

    return (
        <div className="flex justify-center items-center my-6 w-full px-4">
            <div className="w-full max-w-2xl mx-auto bg-transparent rounded-lg overflow-hidden">
                <iframe
                    srcDoc={adHtml}
                    style={{ border: 'none', overflow: 'hidden', width: '100%', minHeight: '250px' }}
                    scrolling="no"
                    title="Advertisement"
                    // 🟢 THE FIX: Allows the ad to run JS and open tabs without touching your React DOM
                    sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                />
            </div>
        </div>
    );
}