'use client';
import { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { StreamVideo, StreamVideoClient, StreamCall, Call, SpeakerLayout } from '@stream-io/video-react-sdk';
import '@stream-io/video-react-sdk/dist/css/styles.css';

type MediaContextType = {
    activeMatchId: string | null;
    mediaType: 'none' | 'audio' | 'video';
    videoUrl: string | null;
    client: StreamVideoClient | null;
    call: Call | null;
    role: string;
    isConnecting: boolean;
    isWaitingForHost: boolean;
    canRequestCallIn: boolean;
    errorMsg: string | null;
    isPageActive: boolean;
    setIsPageActive: (active: boolean) => void;
    tuneInAudio: (matchId: string) => Promise<void>;
    tuneInVideo: (matchId: string, url: string) => void;
    stopMedia: () => void;
};

const MediaContext = createContext<MediaContextType | null>(null);

export const useGlobalMedia = () => {
    const ctx = useContext(MediaContext);
    if (!ctx) throw new Error('useGlobalMedia must be used within GlobalMediaProvider');
    return ctx;
};

export const GlobalMediaProvider = ({ children }: { children: ReactNode }) => {
    const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
    const [mediaType, setMediaType] = useState<'none' | 'audio' | 'video'>('none');
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [isPageActive, setIsPageActive] = useState(false);
    
    const [client, setClient] = useState<StreamVideoClient | null>(null);
    const [call, setCall] = useState<Call | null>(null);
    const [role, setRole] = useState<string>('anonymous');
    const [isConnecting, setIsConnecting] = useState(false);
    const [isWaitingForHost, setIsWaitingForHost] = useState(false);
    const [canRequestCallIn, setCanRequestCallIn] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    // Track connections independently of React render state: an in-flight join
    // must be cancellable on navigation, media switch and provider unmount.
    const activeClientRef = useRef<StreamVideoClient | null>(null);
    const activeCallRef = useRef<Call | null>(null);
    const sessionRef = useRef(0);

    const stopMedia = async () => {
        ++sessionRef.current;
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        const previousCall = activeCallRef.current;
        const previousClient = activeClientRef.current;
        activeCallRef.current = null;
        activeClientRef.current = null;
        setCall(null);
        setClient(null);
        setActiveMatchId(null);
        setMediaType('none');
        setVideoUrl(null);
        setIsConnecting(false);
        setIsWaitingForHost(false);
        setCanRequestCallIn(false);
        setErrorMsg(null);
        await previousCall?.leave().catch(() => {});
        await previousClient?.disconnectUser().catch(() => {});
    };

    const tuneInVideo = (matchId: string, url: string) => {
        void stopMedia();
        setActiveMatchId(matchId);
        setMediaType('video');
        setVideoUrl(url);
    };

    const tuneInAudio = async (matchId: string) => {
        if (activeMatchId === matchId && mediaType === 'audio') return; 
        // stopMedia invalidates previous joins synchronously, but its provider
        // disconnect is async. A newer user choice may arrive while it awaits.
        const stopping = stopMedia();
        const stoppedSession = sessionRef.current;
        await stopping;
        if (stoppedSession !== sessionRef.current) return;
        const session = ++sessionRef.current;
        setIsConnecting(true);
        setErrorMsg(null);

        try {
            const url = new URL(window.location.href);
            const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
            const guestToken = hashParams.get('guest');
            if (guestToken) {
                url.hash = '';
                window.history.replaceState({}, '', url.toString());
            }

            const res = await fetch('/api/studio/token', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomKey: matchId, inviteToken: guestToken || undefined }),
                cache: 'no-store',
            });
            const text = await res.text();
            let data;
            try { data = JSON.parse(text); } catch(e) { throw new Error("Server temporarily unavailable. Reconnecting..."); }
            
            if (!res.ok) throw new Error(data.error || "Connection refused.");
            if (session !== sessionRef.current) return;
            
            setRole(data.role);
            setCanRequestCallIn(data.canRequestCallIn === true);
            setMediaType('audio');

            const myClient = new StreamVideoClient({
                apiKey: data.apiKey, user: { id: data.userId, name: data.username, image: data.image }, token: data.token,
            });
            const myCall = myClient.call('audio_room', data.roomName || matchId);
            activeClientRef.current = myClient;
            activeCallRef.current = myCall;

            const tryJoin = async () => {
                try {
                    if (data.role === 'admin') await myCall.join({ create: true });
                    else await myCall.join();
                    return true;
                } catch (err: any) {
                    const msg = err.message?.toLowerCase() || '';
                    if (msg.includes('joinbackstage') || msg.includes('notallowederror') || msg.includes('not found') || msg.includes("can't find call") || msg.includes("code 16")) return false; 
                    throw new Error("Failed to connect to broadcast.");
                }
            };

            const joined = await tryJoin();
            if (session !== sessionRef.current) {
                // stopMedia may have raced with join(); close the late join too.
                await myCall.leave().catch(() => {});
                await myClient.disconnectUser().catch(() => {});
                return;
            }

            if (joined) {
                setClient(myClient); setCall(myCall); setActiveMatchId(matchId); setIsConnecting(false);
            } else {
                setIsWaitingForHost(true);
                let retryInProgress = false;
                pollRef.current = setInterval(async () => {
                    if (document.hidden || retryInProgress || session !== sessionRef.current) return;
                    retryInProgress = true;
                    try {
                        await myCall.join();
                        if (session !== sessionRef.current) {
                            await myCall.leave().catch(() => {});
                            await myClient.disconnectUser().catch(() => {});
                            return;
                        }
                        if (pollRef.current) clearInterval(pollRef.current);
                        pollRef.current = null;
                        setClient(myClient); setCall(myCall); setActiveMatchId(matchId);
                        setIsWaitingForHost(false); setIsConnecting(false);
                    } catch (e) {
                        // The room may not be available until the host starts it.
                    } finally {
                        retryInProgress = false;
                    }
                }, 4000);
            }
        } catch (err: any) {
            if (session !== sessionRef.current) return;
            setErrorMsg(err instanceof Error ? err.message : 'Unable to join broadcast.');
            setIsConnecting(false);
            const failedCall = activeCallRef.current;
            const failedClient = activeClientRef.current;
            activeCallRef.current = null;
            activeClientRef.current = null;
            void failedCall?.leave().catch(() => {});
            void failedClient?.disconnectUser().catch(() => {});
        }
    };

    useEffect(() => { return () => { if (pollRef.current) clearInterval(pollRef.current); stopMedia(); }; }, []);

    return (
        <MediaContext.Provider value={{ activeMatchId, mediaType, videoUrl, client, call, role, isConnecting, isWaitingForHost, canRequestCallIn, errorMsg, isPageActive, setIsPageActive, tuneInAudio, tuneInVideo, stopMedia }}>
            {children}
            {client && call && mediaType === 'audio' && !isWaitingForHost && (
                <div className="fixed w-[1px] h-[1px] opacity-0 pointer-events-none overflow-hidden -left-[9999px] z-[-1]">
                    <StreamVideo client={client}><StreamCall call={call}><SpeakerLayout /></StreamCall></StreamVideo>
                </div>
            )}
        </MediaContext.Provider>
    );
};