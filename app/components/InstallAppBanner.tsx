'use client';
import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export default function InstallAppBanner() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setIsVisible(true);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') setIsVisible(false);
        setDeferredPrompt(null);
    };

    if (!isVisible) return null;

    return (
        <div className="bg-gradient-to-r from-blue-900 to-[#0a1428] text-white mx-4 rounded-2xl p-4 shadow-lg flex items-center justify-between border border-blue-500/30 relative overflow-hidden mb-6">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 blur-[50px] opacity-20 pointer-events-none"></div>
            <div className="flex items-center gap-4 relative z-10">
                <div className="w-10 h-10 bg-white rounded-xl shadow-md flex items-center justify-center shrink-0">
                    <img src="/icon-512x512.png" alt="App Icon" className="w-7 h-7 object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
                    {/* Fallback if you don't have the icon setup yet */}
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
                <button onClick={() => setIsVisible(false)} className="text-white/50 hover:text-white transition">
                    <X size={16} />
                </button>
            </div>
        </div>
    );
}