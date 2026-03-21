'use client';
import { useState, useEffect } from 'react';
import { Bell, BellRing } from 'lucide-react';

export default function GoalAlertToggler({ matchId, homeTeam, awayTeam, currentHomeScore, currentAwayScore, status }: any) {
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [permission, setPermission] = useState('default');
    const [isSupported, setIsSupported] = useState(true); // 🟢 Safety Check

    useEffect(() => {
        // 🟢 SAFELY CHECK IF BROWSER SUPPORTS NOTIFICATIONS BEFORE TOUCHING IT
        if (typeof window !== 'undefined') {
            if ('Notification' in window) {
                setPermission(Notification.permission);
                const subbed = localStorage.getItem(`alerts_${matchId}`);
                if (subbed === 'true') setIsSubscribed(true);
            } else {
                setIsSupported(false); // Hide the button if not supported
            }
        }
    }, [matchId]);

    useEffect(() => {
        if (!isSupported || !isSubscribed || permission !== 'granted') return;
        if (!('Notification' in window)) return;
        
        const isLive = ['LIVE', 'IN_PLAY', '1H', '2H', 'HT', 'ET', 'P'].includes((status || '').toUpperCase());
        if (!isLive) return;

        const lastHome = parseInt(localStorage.getItem(`home_score_${matchId}`) || currentHomeScore || '0');
        const lastAway = parseInt(localStorage.getItem(`away_score_${matchId}`) || currentAwayScore || '0');
        const newHome = parseInt(currentHomeScore || '0');
        const newAway = parseInt(currentAwayScore || '0');

        if (newHome > lastHome || newAway > lastAway) {
            try {
                new Notification(`🚨 GOAL ALERT!`, {
                    body: `${homeTeam} ${newHome} - ${newAway} ${awayTeam}`,
                    icon: '/logo.png',
                    vibrate: [200, 100, 200]
                } as any);
            } catch (e) {
                console.error("Notification failed", e);
            }
            
            localStorage.setItem(`home_score_${matchId}`, newHome.toString());
            localStorage.setItem(`away_score_${matchId}`, newAway.toString());
        } else if (newHome === 0 && newAway === 0) {
            localStorage.setItem(`home_score_${matchId}`, '0');
            localStorage.setItem(`away_score_${matchId}`, '0');
        }
    }, [currentHomeScore, currentAwayScore, status, isSubscribed, permission, matchId, homeTeam, awayTeam, isSupported]);

    const toggleAlerts = async () => {
        if (!('Notification' in window)) return;

        if (!isSubscribed) {
            if (permission !== 'granted') {
                try {
                    const req = await Notification.requestPermission();
                    setPermission(req);
                    if (req !== 'granted') {
                        alert("Please allow notifications in your browser settings to receive live goal alerts!");
                        return;
                    }
                } catch (e) {
                    console.error("Permission request failed", e);
                    return;
                }
            }
            setIsSubscribed(true);
            localStorage.setItem(`alerts_${matchId}`, 'true');
            
            try {
                new Notification("✅ Goal Alerts Activated!", {
                    body: `You will be notified instantly when ${homeTeam} or ${awayTeam} scores.`,
                    icon: '/logo.png'
                });
            } catch (e) {}
        } else {
            setIsSubscribed(false);
            localStorage.removeItem(`alerts_${matchId}`);
        }
    };

    const isFinished = ['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED'].includes((status || '').toUpperCase());
    
    // 🟢 Don't render the button if the match is finished OR if the phone doesn't support alerts
    if (isFinished || !isSupported) return null; 

    return (
        <button 
            onClick={toggleAlerts}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm border ${
                isSubscribed 
                ? 'bg-blue-600/20 text-blue-400 border-blue-500/30 hover:bg-blue-600/30' 
                : 'bg-white/10 text-white border-white/10 hover:bg-white/20 backdrop-blur-sm'
            }`}
        >
            {isSubscribed ? <BellRing size={12} className="animate-pulse" /> : <Bell size={12} />}
            <span className="hidden md:inline">{isSubscribed ? 'Alerts On' : 'Get Alerts'}</span>
            <span className="md:hidden">{isSubscribed ? 'On' : 'Alerts'}</span>
        </button>
    );
}