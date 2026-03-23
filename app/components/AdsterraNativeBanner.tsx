'use client';

export default function AdsterraNativeBanner() {
    // 🟢 The Sandbox: The ad runs entirely inside this isolated HTML string
    const adHtml = `
        <!DOCTYPE html>
        <html>
            <head><style>body { margin: 0; padding: 0; display: flex; justify-content: center; background: transparent; }</style></head>
            <body>
                <script type="text/javascript" src="https://duepose.com/c280e1cae35afe77612b6777cbe424b6/invoke.js" async data-cfasync="false"></script>
            </body>
        </html>
    `;

    return (
        <div className="flex justify-center items-center my-6 w-full px-4">
            <div className="w-full max-w-2xl mx-auto bg-transparent rounded-lg overflow-hidden">
                {/* 🟢 The concrete wall preventing Adsterra from touching your app's RAM */}
                <iframe
                    srcDoc={adHtml}
                    style={{ border: 'none', overflow: 'hidden', width: '100%', minHeight: '250px' }}
                    scrolling="no"
                    title="Advertisement"
                />
            </div>
        </div>
    );
}