'use client';
import { useState } from 'react';
import { Share2, Check } from 'lucide-react';

export default function SocialShareButton({ matchData }: { matchData: any }) {
    const [isSharing, setIsSharing] = useState(false);
    const [shared, setShared] = useState(false);

    const handleShare = async () => {
        setIsSharing(true);
        
        try {
            const ogPayload = { 
                type: 'versus', 
                label: ['FT', 'FINISHED'].includes(matchData.status) ? 'FULL TIME' : matchData.status === 'HT' ? 'HALF TIME' : 'MATCH UPDATE', 
                home: matchData.home_team, 
                away: matchData.away_team, 
                hScore: matchData.home_score || 0, 
                aScore: matchData.away_score || 0 
            };
            
            const safeBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(ogPayload))));
            const imageUrl = `https://factsport.com/api/og?data=${encodeURIComponent(safeBase64)}&ext=.png`;
            const matchUrl = `https://factsport.com/match/${matchData.id}`;

            const shareData = {
                title: `${matchData.home_team} vs ${matchData.away_team} | FactSport Live`,
                text: `Check out the latest live updates for ${matchData.home_team} vs ${matchData.away_team} on FactSport!`,
                url: matchUrl,
            };

            if (navigator.share && navigator.canShare(shareData)) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(`${shareData.text} \n\n ${matchUrl}`);
                setShared(true);
                setTimeout(() => setShared(false), 3000);
            }
        } catch (error) {
            console.error("Error sharing:", error);
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