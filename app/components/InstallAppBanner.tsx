'use client';
import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export default function InstallAppBanner() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // 1. Hide if they already installed it!
        if (window.matchMedia('(display-mode: standalone)').matches) return;

        // 2. Check if iOS (Apple blocks the native install prompt, so we must show it manually)
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(isIosDevice);

        if (isIosDevice) {
            setTimeout(() => setIsVisible(true), 2000); // Delay slightly for smooth UX
        }

        // 3. Android Native Prompt Listener
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setIsVisible(true);
        };
        window.addEventListener('beforeinstallprompt', handler);

        // 4. Android Fallback (if manifest is missing/caching)
        if (!isIosDevice) {
             setTimeout(() => setIsVisible(true), 3000);
        }

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (isIOS) {
            alert("To install on iPhone:\n\n1. Tap the 'Share' icon at the bottom of Safari.\n2. Scroll down and tap 'Add to Home Screen'.");
            return;
        }
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') setIsVisible(false);
            setDeferredPrompt(null);
        } else {
            alert("To install the app, tap the menu (three dots) in your browser and select 'Add to Home Screen' or 'Install App'.");
        }
    };

    if (!isVisible) return null;

    return (
        <div className="bg-gradient-to-r from-blue-900 to-[#0a1428] text-white mx-4 rounded-2xl p-4 shadow-lg flex items-center justify-between border border-blue-500/30 relative overflow-hidden mb-6">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 blur-[50px] opacity-20 pointer-events-none"></div>
            <div className="flex items-center gap-4 relative z-10">
                <div className="w-10 h-10 bg-white rounded-xl shadow-md flex items-center justify-center shrink-0">
                    <img src="/icon-512x512.png" alt="App Icon" className="w-7 h-7 object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
                    <span className="text-blue-900 font-black text-xl absolute -z-10">F</span>
                </div>
                <div>
                    <h4 className="font-black text-sm uppercase tracking-wider">Get FactSport App</h4>
                    <p className="text-[10px] text-blue-200 font-bold">Live scores & faster updates.</p>
                </div>
            </div>
            <div className="flex items-center gap-3 relative z-10">
                <button onClick={handleInstall} className="bg-blue-500 hover:bg-blue-400 text-white text-[10px] font-black uppercase px-4 py-2 rounded-lg shadow-md transition active:scale-95 flex items-center gap-1">
                    <Download size={12} /> Install
                </button>
                <button onClick={() => setIsVisible(false)} className="text-white/50 hover:text-white transition p-1">
                    <X size={16} />
                </button>
            </div>
        </div>
    );
}