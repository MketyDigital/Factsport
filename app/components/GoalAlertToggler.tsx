'use client';
import { useState, useEffect } from 'react';
import { Bell, BellRing } from 'lucide-react';

export default function GoalAlertToggler({ matchId, homeTeam, awayTeam, currentHomeScore, currentAwayScore, status }: any) {
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [permission, setPermission] = useState('default');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setPermission(Notification.permission);
        }
        const subbed = localStorage.getItem(`alerts_${matchId}`);
        if (subbed === 'true') setIsSubscribed(true);
    }, [matchId]);

    useEffect(() => {
        if (!isSubscribed || permission !== 'granted') return;
        
        const isLive = ['LIVE', 'IN_PLAY', '1H', '2H', 'HT', 'ET', 'P'].includes((status || '').toUpperCase());
        if (!isLive) return;

        const lastHome = parseInt(localStorage.getItem(`home_score_${matchId}`) || currentHomeScore || '0');
        const lastAway = parseInt(localStorage.getItem(`away_score_${matchId}`) || currentAwayScore || '0');
        const newHome = parseInt(currentHomeScore || '0');
        const newAway = parseInt(currentAwayScore || '0');

        if (newHome > lastHome || newAway > lastAway) {
            new Notification(`🚨 GOAL ALERT!`, {
                body: `${homeTeam} ${newHome} - ${newAway} ${awayTeam}`,
                icon: '/logo.png',
                vibrate: [200, 100, 200]
            });
            
            localStorage.setItem(`home_score_${matchId}`, newHome.toString());
            localStorage.setItem(`away_score_${matchId}`, newAway.toString());
        } else if (newHome === 0 && newAway === 0) {
            localStorage.setItem(`home_score_${matchId}`, '0');
            localStorage.setItem(`away_score_${matchId}`, '0');
        }
    }, [currentHomeScore, currentAwayScore, status, isSubscribed, permission, matchId, homeTeam, awayTeam]);

    const toggleAlerts = async () => {
        if (!isSubscribed) {
            if (permission !== 'granted') {
                const req = await Notification.requestPermission();
                setPermission(req);
                if (req !== 'granted') {
                    alert("Please allow notifications in your browser settings to receive live goal alerts!");
                    return;
                }
            }
            setIsSubscribed(true);
            localStorage.setItem(`alerts_${matchId}`, 'true');
            
            new Notification("✅ Goal Alerts Activated!", {
                body: `You will be notified instantly when ${homeTeam} or ${awayTeam} scores.`,
                icon: '/logo.png'
            });
        } else {
            setIsSubscribed(false);
            localStorage.removeItem(`alerts_${matchId}`);
        }
    };

    const isFinished = ['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED'].includes((status || '').toUpperCase());
    if (isFinished) return null; 

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