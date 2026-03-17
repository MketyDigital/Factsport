'use client';

import { useEffect, useRef } from 'react';

export default function AdsterraStandardBanner() {
    const bannerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!bannerRef.current) return;
        
        // Prevent duplicate ad loads during Next.js client-side navigation
        if (bannerRef.current.firstChild) return;

        // 1. Inject the configuration object exactly as Adsterra provided
        const conf = document.createElement('script');
        conf.type = 'text/javascript';
        conf.innerHTML = `
            atOptions = {
                'key' : 'a44267c95f702368b525452bba0b92f1',
                'format' : 'iframe',
                'height' : 50,
                'width' : 320,
                'params' : {}
            };
        `;

        // 2. Inject the script that actually fetches the ad
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = "https://duepose.com/a44267c95f702368b525452bba0b92f1/invoke.js";
        script.async = true;

        // 3. Attach them safely to our container
        bannerRef.current.appendChild(conf);
        bannerRef.current.appendChild(script);
    }, []);

    return (
        // 🟢 Centered wrapper to keep the layout clean and prevent layout shifts
        <div className="flex justify-center items-center w-full my-4 overflow-hidden min-h-[50px]">
            {/* The exact dimensions required by the ad so it doesn't clip */}
            <div ref={bannerRef} className="w-[320px] h-[50px]"></div>
        </div>
    );
}