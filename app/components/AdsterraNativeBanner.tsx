'use client';

import { useEffect, useRef } from 'react';

export default function AdsterraNativeBanner() {
    const bannerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!bannerRef.current) return;
        
        // Prevent duplicate loads during Next.js navigation
        if (bannerRef.current.querySelector('script')) return;

        // 1. Create the Adsterra script
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = 'https://duepose.com/c280e1cae35afe77612b6777cbe424b6/invoke.js'; 
        script.async = true;
        script.setAttribute('data-cfasync', 'false');

        // 2. Inject it safely
        bannerRef.current.appendChild(script);
    }, []);

    return (
        // 🟢 THE FIX: We removed `min-h`, `max-h`, and `overflow-hidden`.
        // Now, Adsterra's server controls the shape based on your 2:1 / 3:1 dashboard settings!
        <div className="flex justify-center items-center my-6 w-full px-2">
            <div 
                id="container-c280e1cae35afe77612b6777cbe424b6" 
                ref={bannerRef}
                className="w-full max-w-4xl mx-auto bg-transparent flex justify-center items-center"
            ></div>
        </div>
    );
}