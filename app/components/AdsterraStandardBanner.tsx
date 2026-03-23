'use client';

export default function AdsterraStandardBanner() {
    // 🟢 The Sandbox: The ad runs entirely inside this isolated HTML string
    const adHtml = `
        <!DOCTYPE html>
        <html>
            <head><style>body { margin: 0; padding: 0; overflow: hidden; background: transparent; }</style></head>
            <body>
                <script type="text/javascript">
                    atOptions = {
                        'key' : 'a44267c95f702368b525452bba0b92f1',
                        'format' : 'iframe',
                        'height' : 50,
                        'width' : 320,
                        'params' : {}
                    };
                </script>
                <script type="text/javascript" src="https://duepose.com/a44267c95f702368b525452bba0b92f1/invoke.js"></script>
            </body>
        </html>
    `;

    return (
        <div className="flex justify-center items-center w-full my-4 overflow-hidden min-h-[50px]">
            {/* 🟢 The concrete wall preventing Adsterra from touching your app's RAM */}
            <iframe
                srcDoc={adHtml}
                width="320"
                height="50"
                style={{ border: 'none', overflow: 'hidden' }}
                scrolling="no"
                title="Advertisement"
            />
        </div>
    );
}