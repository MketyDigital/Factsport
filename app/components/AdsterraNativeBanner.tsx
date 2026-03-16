'use client';

import { useEffect, useRef } from 'react';

export default function AdsterraNativeBanner() {
    const bannerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!bannerRef.current) return;
        
        // Prevent duplicate loads during Next.js navigation
        if (bannerRef.current.querySelector('script')) return;

        // 1. Create the Adsterra script using your exact code
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = 'https://duepose.com/c280e1cae35afe77612b6777cbe424b6/invoke.js'; 
        script.async = true;
        script.setAttribute('data-cfasync', 'false');

        // 2. Inject it
        bannerRef.current.appendChild(script);
    }, []);

    return (
        // 🟢 THE RESPONSIVE CONTAINER
        // We force it to be 100% width, but restrict the height so it stays a slim rectangle
        <div className="flex justify-center items-center my-4 w-full px-2 overflow-hidden">
            <div 
                id="container-c280e1cae35afe77612b6777cbe424b6" 
                ref={bannerRef}
                className="w-full max-w-4xl min-h-[80px] max-h-[120px] mx-auto bg-transparent overflow-hidden flex justify-center items-center rounded-lg"
            ></div>
        </div>
    );
}