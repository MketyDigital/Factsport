'use client';
import { useState } from 'react';
import { Share2, Check } from 'lucide-react';

export default function SocialShareButton({ matchData }: { matchData: any }) {
    const [isSharing, setIsSharing] = useState(false);
    const [shared, setShared] = useState(false);

    const handleShare = async () => {
        if (isSharing) return;
        setIsSharing(true);
        
        try {
            const matchUrl = `https://factsport.com/match/${matchData.id}`;
            const shareData = {
                title: `${matchData.home_team} vs ${matchData.away_team} | FactSport Live`,
                text: `Check out the latest live updates for ${matchData.home_team} vs ${matchData.away_team} on FactSport!`,
                url: matchUrl,
            };

            // 🟢 SAFELY TRY TO OPEN PHONE SHARE MENU
            if (typeof navigator !== 'undefined' && navigator.share) {
                try {
                    await navigator.share(shareData);
                } catch (shareError: any) {
                    // User cancelled the share, or browser blocked it. Do not crash.
                    if (shareError.name !== 'AbortError') {
                        throw shareError; // Pass to fallback
                    }
                }
            } else {
                throw new Error("Web Share not supported"); // Pass to fallback
            }
        } catch (error) {
            // 🟢 FALLBACK: Copy to clipboard if native share fails or is unsupported
            try {
                const matchUrl = `https://factsport.com/match/${matchData.id}`;
                await navigator.clipboard.writeText(`Check out the latest live updates for ${matchData.home_team} vs ${matchData.away_team} on FactSport! \n\n ${matchUrl}`);
                setShared(true);
                setTimeout(() => setShared(false), 3000);
            } catch (clipboardError) {
                console.error("Could not copy text: ", clipboardError);
            }
        } finally {
            setIsSharing(false);
        }
    };

    return (
        <button 
            onClick={handleShare}
            disabled={isSharing}
            className="flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-all active:scale-95 shadow-lg"
        >
            {shared ? <Check size={12} className="text-green-400" /> : <Share2 size={12} />}
            {shared ? 'Copied' : isSharing ? '...' : 'Share'}
        </button>
    );
}