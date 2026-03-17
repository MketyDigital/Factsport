'use client';

import { useEffect, useRef } from 'react';

export default function AdsterraNativeBanner() {
    const bannerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!bannerRef.current) return;
        if (bannerRef.current.querySelector('script')) return;

        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = 'https://duepose.com/c280e1cae35afe77612b6777cbe424b6/invoke.js'; 
        script.async = true;
        script.setAttribute('data-cfasync', 'false');

        bannerRef.current.appendChild(script);
    }, []);

    return (
        // 🟢 THE FIX: We make the outer box horizontally scrollable with hidden scrollbars
        <div className="w-full my-6 px-2 overflow-x-auto snap-x" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {/* 🟢 THE TRICK: We force this inner box to be 600px wide on mobile so Adsterra doesn't stack them! */}
            <div className="min-w-[600px] md:min-w-full">
                <div 
                    id="container-c280e1cae35afe77612b6777cbe424b6" 
                    ref={bannerRef}
                    className="w-full bg-transparent"
                ></div>
            </div>
        </div>
    );
}