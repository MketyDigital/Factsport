'use client';
import { useState, useEffect } from 'react';
import { Bell, BellRing } from 'lucide-react';

export default function GoalAlertToggler({ matchId, homeTeam, awayTeam, currentHomeScore, currentAwayScore, status }: any) {
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [permission, setPermission] = useState('default');
    const [isSupported, setIsSupported] = useState(false);

    useEffect(() => {
        // 🟢 SAFELY CHECK BROWSER SUPPORT TO PREVENT IOS CRASHES
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setIsSupported(true);
            setPermission(Notification.permission);
            const subbed = localStorage.getItem(`alerts_${matchId}`);
            if (subbed === 'true') setIsSubscribed(true);
        }
    }, [matchId]);

    useEffect(() => {
        if (!isSupported || !isSubscribed || permission !== 'granted') return;
        
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
            } catch (e) { console.error(e); }
            
            localStorage.setItem(`home_score_${matchId}`, newHome.toString());
            localStorage.setItem(`away_score_${matchId}`, newAway.toString());
        } else if (newHome === 0 && newAway === 0) {
            localStorage.setItem(`home_score_${matchId}`, '0');
            localStorage.setItem(`away_score_${matchId}`, '0');
        }
    }, [currentHomeScore, currentAwayScore, status, isSubscribed, isSupported, permission, matchId, homeTeam, awayTeam]);

    const toggleAlerts = async () => {
        if (!isSupported) {
            alert("Goal alerts are not supported on this browser.");
            return;
        }

        if (!isSubscribed) {
            try {
                if (permission !== 'granted') {
                    const req = await Notification.requestPermission();
                    setPermission(req);
                    if (req !== 'granted') {
                        alert("Please allow notifications to receive alerts!");
                        return;
                    }
                }
                setIsSubscribed(true);
                localStorage.setItem(`alerts_${matchId}`, 'true');
                new Notification("✅ Alerts Activated", { icon: '/logo.png' });
            } catch (e) {}
        } else {
            setIsSubscribed(false);
            localStorage.removeItem(`alerts_${matchId}`);
        }
    };

    const isFinished = ['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED'].includes((status || '').toUpperCase());
    if (isFinished || !isSupported) return null; 

    return (
        <button onClick={toggleAlerts} className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm border ${isSubscribed ? 'bg-blue-600/20 text-blue-400 border-blue-500/30 hover:bg-blue-600/30' : 'bg-white/10 text-white border-white/10 hover:bg-white/20 backdrop-blur-sm'}`}>
            {isSubscribed ? <BellRing size={12} className="animate-pulse" /> : <Bell size={12} />}
            <span className="hidden md:inline">{isSubscribed ? 'Alerts On' : 'Get Alerts'}</span>
            <span className="md:hidden">{isSubscribed ? 'On' : 'Alerts'}</span>
        </button>
    );
}