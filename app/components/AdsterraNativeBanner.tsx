'use client';

import { useEffect, useRef } from 'react';

export default function AdsterraNativeBanner() {
    const bannerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!bannerRef.current) return;
        if (bannerRef.current.querySelector('script')) return;

        const script = document.createElement('script');
        script.type = 'text/javascript';
        // Your existing script URL
        script.src = 'https://duepose.com/c280e1cae35afe77612b6777cbe424b6/invoke.js'; 
        script.async = true;
        script.setAttribute('data-cfasync', 'false');

        bannerRef.current.appendChild(script);
    }, []);

    return (
        // 🟢 A perfectly clean, centered wrapper. No scrolling, no strict height limits.
        // It will perfectly hug the new 1x1 "Image-Left" layout you just saved in the dashboard!
        <div className="flex justify-center items-center my-6 w-full px-4">
            <div 
                id="container-c280e1cae35afe77612b6777cbe424b6" 
                ref={bannerRef}
                className="w-full max-w-2xl mx-auto bg-transparent rounded-lg overflow-hidden"
            ></div>
        </div>
    );
}