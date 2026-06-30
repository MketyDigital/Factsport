'use client';

import { useState, useEffect } from 'react';
import FactSportPlayer from './FactSportPlayer';

export default function EmbedPlayerClient({
    match,
    activeVideoUrl,
    telegramSupport,
    announcement,
    appUrl
}: {
    match: any;
    activeVideoUrl: string;
    telegramSupport: string | null;
    announcement: any;
    appUrl: string;
}) {
    // Configuration options for redirect
    const USE_HARDCODED = false; // Set to true to override database
    const HARDCODED_URL = "https://t.me/your_hardcoded_channel";
    const USE_DATABASE_TELEGRAM = true;

    // Determine fallback redirect destination prioritizing hardcoded, then db telegram, then match page
    const redirectDest = (USE_HARDCODED && HARDCODED_URL) 
        ? HARDCODED_URL 
        : (USE_DATABASE_TELEGRAM && telegramSupport) 
            ? telegramSupport 
            : `${appUrl}/match/${match.id}`;
            
    const redirectName = (redirectDest === HARDCODED_URL || redirectDest === telegramSupport) 
        ? "our Telegram channel" 
        : "our match page";

    const [timeLeft, setTimeLeft] = useState(300); // 5 minutes (300 seconds)
    const [showPopup, setShowPopup] = useState(false);
    const [popupMoved, setPopupMoved] = useState(false);

    useEffect(() => {
        // Check if playing inside Telegram to prevent redirection
        const isTelegram = (typeof navigator !== 'undefined' && /Telegram/i.test(navigator.userAgent)) ||
                           (typeof document !== 'undefined' && /Telegram/i.test(document.referrer));
                           
        if (isTelegram) {
            // Do not start countdown if embedded inside Telegram app
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    window.location.href = redirectDest;
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [redirectDest]);

    useEffect(() => {
        if (timeLeft === 240) { // 1 min passed (300 - 60 = 240)
            setShowPopup(true);
            setTimeout(() => setPopupMoved(true), 5000); // Move to corner after 5 seconds
        }
    }, [timeLeft]);

    // EDIT HERE: Configuration for player lock/unlock and visibility
    const UNLOCK_MINUTES_BEFORE_KICKOFF = 15; 

    const timeUntilStart = match.match_date ? new Date(match.match_date).getTime() - Date.now() : 0;
    const minutesToKick = timeUntilStart / 60000;
    const currentStatus = (match.status || '').toUpperCase();
    const isFinishedApi = ['FT', 'AET', 'PEN', 'FINISHED'].includes(currentStatus);
    const isLive = !['NS', 'TBD', 'POSTPONED', 'CANCELED'].includes(currentStatus) && !isFinishedApi;
    // Rely purely on the API status to determine if the match is finished (handles extra time/penalties)
    const isUniversallyFinished = isFinishedApi;
    
    let isEmbedLocked = true;
    if (isUniversallyFinished) {
        isEmbedLocked = false;
    } else if (isLive) {
        isEmbedLocked = false;
    } else {
        if (minutesToKick <= UNLOCK_MINUTES_BEFORE_KICKOFF) {
            isEmbedLocked = false;
        }
    }

    return (
        <div className="w-screen h-screen bg-black overflow-hidden flex flex-col relative">
            <FactSportPlayer 
                mediaUrl={activeVideoUrl || ''} 
                matchId={match.id} 
                mode="video" 
                isLocked={isEmbedLocked} 
                matchDate={match.match_date} 
                isFinished={isUniversallyFinished}
                homeTeam={match.home_team}
                awayTeam={match.away_team}
                homeLogo={match.home_logo}
                awayLogo={match.away_logo}
                isEmbed={true}
                announcement={announcement}
            />

            {/* Permanent tiny logo overlay */}
            <div className="absolute top-4 left-4 z-50 pointer-events-none">
                <img src="/logo.png" alt="FactSport" className="h-8 drop-shadow-lg opacity-80" />
            </div>

            {/* 1 min pop up asking users to follow */}
            {showPopup && (
                <div className={`absolute z-50 transition-all duration-700 ease-in-out pointer-events-auto
                    ${popupMoved 
                        ? 'top-4 right-4 scale-75 bg-blue-600/90 rounded-full px-4 py-2 shadow-lg' 
                        : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-600 rounded-xl px-6 py-4 shadow-2xl scale-100 flex items-center justify-center'
                    }`}
                >
                    <a href={redirectDest} target="_blank" rel="noreferrer" className="text-white font-bold text-center text-sm md:text-base whitespace-nowrap">
                        Follow us for more livestreams!
                    </a>
                </div>
            )}

            {/* Warning countdown right before redirection */}
            {timeLeft <= 10 && (
                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50 bg-black/80 backdrop-blur border border-white/20 px-6 py-3 rounded-full text-white text-sm font-semibold text-center whitespace-nowrap animate-in slide-in-from-bottom-5">
                    Redirecting to {redirectName} for an uninterrupted stream in {timeLeft}s...
                </div>
            )}
        </div>
    );
}