'use client';
import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export default function InstallAppBanner() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        if (window.matchMedia('(display-mode: standalone)').matches) return;
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(isIosDevice);

        if (isIosDevice) setTimeout(() => setIsVisible(true), 2000);

        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setIsVisible(true);
        };
        window.addEventListener('beforeinstallprompt', handler);
        if (!isIosDevice) setTimeout(() => setIsVisible(true), 3000);

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (isIOS) {
            alert("To install on iPhone:\nTap 'Share' at the bottom of Safari, then tap 'Add to Home Screen'.");
            return;
        }
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') setIsVisible(false);
            setDeferredPrompt(null);
        } else {
            alert("Tap the browser menu (three dots) and select 'Add to Home Screen'.");
        }
    };

    if (!isVisible) return null;

    return (
        <div className="bg-blue-600 text-white w-full px-3 py-1.5 shadow-sm flex items-center justify-between text-[9px] md:text-[10px] font-bold border-y border-blue-500 m-0">
            <div className="flex items-center gap-1.5 truncate pr-2">
                <Download size={10} className="shrink-0 animate-bounce text-yellow-300" />
                <span className="truncate">Install FactSport to Home for fast lives & News updates</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <button onClick={handleInstall} className="bg-white text-blue-600 px-2 py-0.5 rounded shadow-sm font-black uppercase text-[8px] active:scale-95 transition">Install</button>
                <button onClick={() => setIsVisible(false)} className="opacity-70 hover:opacity-100 p-0.5"><X size={12} /></button>
            </div>
        </div>
    );
}