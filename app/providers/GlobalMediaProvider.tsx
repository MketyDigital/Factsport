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
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    
    const pollRef = useRef<NodeJS.Timeout | null>(null);

    const stopMedia = async () => {
        if (pollRef.current) clearInterval(pollRef.current);
        if (call) await call.leave().catch(()=>{});
        if (client) await client.disconnectUser().catch(()=>{});
        setCall(null);
        setClient(null);
        setActiveMatchId(null);
        setMediaType('none');
        setVideoUrl(null);
        setIsConnecting(false);
        setIsWaitingForHost(false);
    };

    const tuneInVideo = (matchId: string, url: string) => {
        stopMedia();
        setActiveMatchId(matchId);
        setMediaType('video');
        setVideoUrl(url);
    };

    const tuneInAudio = async (matchId: string) => {
        if (activeMatchId === matchId && mediaType === 'audio') return; 
        setIsConnecting(true);
        setErrorMsg(null);
        await stopMedia(); 

        try {
            const urlParams = new URLSearchParams(window.location.search);
            const guestToken = urlParams.get('guest');
            
            let apiUrl = '/api/stream/token?match_id=' + matchId;
            if (guestToken) apiUrl += '&guest=' + guestToken;
            
            const res = await fetch(apiUrl);
            const text = await res.text();
            let data;
            try { data = JSON.parse(text); } catch(e) { throw new Error("Server temporarily unavailable. Reconnecting..."); }
            
            if (!res.ok) throw new Error(data.error || "Connection refused.");
            
            setRole(data.role);
            setMediaType('audio');

            const myClient = new StreamVideoClient({
                apiKey: data.apiKey, user: { id: data.userId, name: data.username, image: data.image }, token: data.token,
            });
            const myCall = myClient.call('audio_room', matchId);

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

            if (joined) {
                setClient(myClient); setCall(myCall); setActiveMatchId(matchId); setIsConnecting(false);
            } else {
                setIsWaitingForHost(true);
                pollRef.current = setInterval(async () => {
                    if (document.hidden) return; // 🛑 THE CPU SHIELD: Don't poll Stream if phone is locked
                    try {
                        await myCall.join();
                        if (pollRef.current) clearInterval(pollRef.current);
                        setClient(myClient); setCall(myCall); setActiveMatchId(matchId);
                        setIsWaitingForHost(false); setIsConnecting(false);
                    } catch (e) {}
                }, 4000);
            }
        } catch (err: any) {
            setErrorMsg(err.message);
            setIsConnecting(false);
        }
    };

    useEffect(() => { return () => { if (pollRef.current) clearInterval(pollRef.current); stopMedia(); }; }, []);

    return (
        <MediaContext.Provider value={{ activeMatchId, mediaType, videoUrl, client, call, role, isConnecting, isWaitingForHost, errorMsg, isPageActive, setIsPageActive, tuneInAudio, tuneInVideo, stopMedia }}>
            {children}
            {client && call && mediaType === 'audio' && !isWaitingForHost && (
                <div className="fixed w-[1px] h-[1px] opacity-0 pointer-events-none overflow-hidden -left-[9999px] z-[-1]">
                    <StreamVideo client={client}><StreamCall call={call}><SpeakerLayout /></StreamCall></StreamVideo>
                </div>
            )}
        </MediaContext.Provider>
    );
};