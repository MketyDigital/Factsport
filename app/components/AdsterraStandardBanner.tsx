'use client';

export default function AdsterraStandardBanner() {
    return (
        <div className="flex justify-center items-center w-full my-4 overflow-hidden min-h-[50px] bg-transparent">
            {/* 🟢 The concrete wall preventing Adsterra from touching your app's RAM or redirecting the user */}
            <iframe 
                src="/ad-banner.html" 
                title="Advertisement"
                width="320" 
                height="50" 
                style={{ border: 'none', overflow: 'hidden' }}
                scrolling="no" 
                loading="lazy"
                // 🔥 THE ULTIMATE QUARANTINE 🔥
                // Notice there is NO 'allow-top-navigation' (stops redirects)
                // Notice there is NO 'allow-same-origin' (stops RAM & cookie hijacking)
                sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
            />
        </div>
    );
}