'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { 
    StreamVideo, 
    StreamVideoClient, 
    StreamCall, 
    Call, 
    useCallStateHooks, 
    useCall, 
    StreamTheme,
    hasAudio,
    SpeakerLayout 
} from '@stream-io/video-react-sdk';
import '@stream-io/video-react-sdk/dist/css/styles.css';
import { 
    Loader2, Radio, Hand, Mic, MicOff, CheckCircle, XCircle, 
    Link as LinkIcon, Check, Play, Square, LogOut, Users, 
    Circle, Pause, Volume2, VolumeX, Activity 
} from 'lucide-react';

// ==========================================
// 📻 PREMIUM HLS SPORTS RADIO PLAYER (For Listeners)
// ==========================================
const PremiumHLSRadio = ({ url }: { url: string }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isBuffering, setIsBuffering] = useState(true);

    useEffect(() => {
        if (typeof window === 'undefined' || !audioRef.current || !url) return;
        const audio = audioRef.current;

        import('hls.js').then((HlsModule) => {
            const Hls = HlsModule.default;
            if (Hls.isSupported()) {
                const hls = new Hls({ liveSyncDurationCount: 3, liveMaxLatencyDurationCount: 10 });
                hls.loadSource(url);
                hls.attachMedia(audio);
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    setIsBuffering(false);
                    audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
                });
                return () => hls.destroy();
            } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
                audio.src = url;
                audio.addEventListener('loadedmetadata', () => {
                    setIsBuffering(false);
                    audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
                });
            }
        });
    }, [url]);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); } 
        else { audioRef.current.play(); setIsPlaying(true); }
    };

    const toggleMute = () => {
        if (!audioRef.current) return;
        audioRef.current.muted = !isMuted;
        setIsMuted(!isMuted);
    };

    return (
        <div className="w-full max-w-sm bg-gradient-to-b from-slate-900 to-black border border-slate-800 rounded-3xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.8)] relative overflow-hidden animate-in fade-in zoom-in-95">
            {/* Background Glow */}
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-blue-600/20 blur-[60px] rounded-full pointer-events-none"></div>
            
            <div className="relative z-10 flex flex-col items-center">
                {/* Header */}
                <div className="w-full flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                        <Radio className="text-blue-400" size={16} />
                        <span className="text-white font-black tracking-widest text-[10px] uppercase">FactSport Radio</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded shadow-sm">
                        <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_red]"></div>
                        <span className="text-red-500 text-[8px] font-black tracking-widest uppercase">Live Edge</span>
                    </div>
                </div>

                {/* Visualizer (Animated Equalizer) */}
                <div className="h-16 flex items-center justify-center gap-1.5 mb-8">
                    {isBuffering ? (
                        <Loader2 className="animate-spin text-blue-500" size={28} />
                    ) : (
                        [...Array(7)].map((_, i) => (
                            <div key={i} className={`w-2.5 rounded-full transition-all duration-200 ${isPlaying ? 'bg-blue-500 animate-pulse' : 'bg-slate-800 h-2'}`} 
                                 style={{ height: isPlaying ? `${Math.random() * 60 + 20}%` : '8px', animationDelay: `${i * 0.1}s` }}>
                            </div>
                        ))
                    )}
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-6 w-full">
                    <button onClick={toggleMute} className="p-3 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
                        {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                    </button>
                    
                    <button onClick={togglePlay} disabled={isBuffering} className="w-16 h-16 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all active:scale-95 disabled:opacity-50">
                        {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                    </button>
                    
                    <div className="p-3 text-slate-600">
                        <Activity size={20} />
                    </div>
                </div>
            </div>
            
            <audio ref={audioRef} className="hidden" playsInline />
        </div>
    );
};

// ==========================================
// 🎨 WEBRTC STUDIO AVATARS (For Speakers & VIPs)
// ==========================================
const CustomAudioLayout = () => {
    const { useParticipants } = useCallStateHooks();
    const participants = useParticipants();

    return (
        <div className="flex flex-wrap items-center justify-center gap-6 py-8 w-full relative z-20">
            {participants.map((p) => {
                const isMuted = !hasAudio(p); 
                return (
                    <div key={p.sessionId} className="flex flex-col items-center gap-3 animate-in fade-in zoom-in">
                        <div className={`relative w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center border-4 bg-slate-800 transition-all duration-300 ${
                            p.isSpeaking ? 'border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.4)] scale-110' : 'border-slate-700'
                        }`}>
                            {p.image ? (
                                <img src={p.image} alt={p.name} className="w-full h-full rounded-full object-cover" />
                            ) : (
                                <span className="text-2xl font-black text-white">{p.name?.charAt(0) || 'U'}</span>
                            )}
                            <div className="absolute -bottom-2 -right-2 bg-[#0a1428] p-1.5 rounded-full border border-slate-600 shadow-md">
                                {isMuted ? <MicOff size={12} className="text-red-500" /> : <Mic size={12} className="text-green-400" />}
                            </div>
                        </div>
                        <span className="text-[11px] text-white font-bold w-24 text-center truncate drop-shadow-md">
                            {p.name || p.userId}
                        </span>
                        {p.roles.includes('admin') && <span className="text-[8px] bg-blue-600 px-1.5 py-0.5 rounded text-white font-black uppercase tracking-widest -mt-2">Host</span>}
                    </div>
                );
            })}
        </div>
    );
};

// ==========================================
// 🎛️ STUDIO CONTROL DECK (Logic & Buttons)
// ==========================================
const InteractiveAudioUI = ({ role, matchId }: { role: 'admin' | 'user' | 'guest' | 'anonymous', matchId: string }) => {
    const call = useCall();
    const { useHasPermissions, useIsCallLive, useMicrophoneState, useParticipants, useIsCallRecordingInProgress } = useCallStateHooks(); 
    
    const canSpeak = useHasPermissions('send-audio');
    const isLive = useIsCallLive();
    const isBackstage = !isLive;
    const isRecording = useIsCallRecordingInProgress();
    const { microphone, isMute } = useMicrophoneState();
    const participants = useParticipants();
    
    const [handRaised, setHandRaised] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [showManager, setShowManager] = useState(false);
    const [useHls, setUseHls] = useState(true); // Default TalkSport mode to ON for Admin

    // Wake Lock to prevent Host screen from sleeping
    useEffect(() => {
        let wakeLock: any = null;
        const requestWakeLock = async () => {
            if (role === 'admin' && isLive && 'wakeLock' in navigator) {
                try { wakeLock = await (navigator as any).wakeLock.request('screen'); } 
                catch (err) { console.error("Wake Lock failed"); }
            }
        };
        requestWakeLock();
        return () => { if (wakeLock) wakeLock.release().catch(() => {}); };
    }, [isLive, role]);

    if (!call) return null;

    const toggleMic = async () => { if (isMute) await microphone.enable(); else await microphone.disable(); };
    const toggleRecording = async () => { if (isRecording) await call.stopRecording(); else await call.startRecording(); };
    const handleLeave = async () => { await call.leave(); window.location.reload(); };

    const generateVIPLink = async () => {
        setIsGenerating(true);
        try {
            const res = await fetch('/api/stream/token', { method: 'POST', body: JSON.stringify({ matchId }) });
            const data = await res.json();
            await navigator.clipboard.writeText(data.inviteLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 3000);
        } catch (error) { alert("Could not generate link."); } 
        finally { setIsGenerating(false); }
    };

    const grantPermission = async (userId: string) => await call.grantPermissions(userId, ['send-audio']);
    const revokePermission = async (userId: string) => await call.revokePermissions(userId, ['send-audio']);

    return (
        <div className="flex flex-col items-center w-full gap-4 mt-2">
            {/* 👑 ADMIN CONTROLS */}
            {role === 'admin' && (
                <div className="w-full flex flex-col items-center gap-4">
                    {isBackstage ? (
                        <div className="flex flex-col items-center gap-3 w-full">
                            <label className="flex items-center justify-center gap-2 text-[10px] font-bold text-slate-300 uppercase tracking-widest bg-slate-800/80 px-4 py-3 rounded-xl cursor-pointer border border-slate-700 w-full max-w-xs transition hover:bg-slate-700 shadow-lg">
                                <input type="checkbox" checked={useHls} onChange={(e) => setUseHls(e.target.checked)} className="accent-blue-500 w-4 h-4 cursor-pointer" />
                                Broadcast to HLS Radio
                            </label>
                            <button onClick={() => call.goLive({ start_hls: useHls })} className="flex items-center gap-2 px-8 py-3.5 rounded-full bg-green-600 hover:bg-green-500 text-white font-black tracking-widest uppercase shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-all animate-pulse w-full max-w-xs justify-center active:scale-95">
                                <Play size={18} fill="currentColor" /> Go Live Now
                            </button>
                        </div>
                    ) : (
                        <button onClick={() => call.stopLive()} className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-red-900/80 hover:bg-red-600 border border-red-500 text-white font-bold tracking-widest uppercase transition-all shadow-lg active:scale-95">
                            <Square size={14} fill="currentColor" /> End Broadcast
                        </button>
                    )}

                    <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4 bg-slate-900/90 p-2.5 rounded-full border border-slate-700 relative z-30 shadow-xl">
                        <button onClick={toggleMic} className={`p-3.5 md:p-4 rounded-full transition-all ${isMute ? 'bg-red-500/20 text-red-500' : 'bg-slate-700 text-white hover:bg-slate-600 shadow-md'}`}>
                            {isMute ? <MicOff size={20} /> : <Mic size={20} />}
                        </button>
                        <button onClick={toggleRecording} className={`p-3.5 md:p-4 rounded-full transition-all ${isRecording ? 'bg-red-600 text-white animate-pulse shadow-[0_0_15px_red]' : 'bg-slate-700 text-white hover:bg-slate-600 shadow-md'}`}>
                            <Circle size={20} fill={isRecording ? "white" : "none"} />
                        </button>
                        <button onClick={() => setShowManager(!showManager)} className={`p-3.5 md:p-4 rounded-full transition-all ${showManager ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]' : 'bg-slate-700 text-white hover:bg-slate-600 shadow-md'}`}>
                            <Users size={20} />
                        </button>
                        <button onClick={handleLeave} className="p-3.5 md:p-4 rounded-full bg-slate-700 text-red-400 hover:bg-red-900/80 transition-all shadow-md"><LogOut size={20} /></button>
                    </div>

                    {showManager && (
                        <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-xl p-4 flex flex-col gap-3 shadow-2xl relative z-30 animate-in slide-in-from-top-4">
                            <div className="flex items-center justify-between border-b border-slate-700 pb-3 mb-1">
                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Manage Callers</span>
                                <button onClick={generateVIPLink} disabled={isGenerating} className="text-blue-400 hover:text-blue-300 text-[9px] uppercase font-bold flex items-center gap-1.5 bg-blue-900/40 px-3 py-1.5 rounded-full transition-all">
                                    {isGenerating ? <Loader2 size={12} className="animate-spin"/> : <LinkIcon size={12}/>} {copied ? 'Copied' : 'Copy VIP Link'}
                                </button>
                            </div>
                            {participants.map(p => (
                                <div key={p.userId} className="flex items-center justify-between bg-black/50 px-3 py-2.5 rounded-lg border border-white/5">
                                    <span className="text-xs text-white font-medium truncate max-w-[120px]">{p.name || p.userId}</span>
                                    {p.userId !== call.currentUserId && (
                                        <div className="flex items-center gap-2">
                                            {p.roles.includes('admin') ? (
                                                <span className="text-[9px] text-blue-500 uppercase font-black">Co-Host</span>
                                            ) : hasAudio(p) ? (
                                                <button onClick={() => revokePermission(p.userId)} className="text-[9px] font-black px-3 py-1.5 bg-red-900/60 text-red-400 rounded-md hover:bg-red-600 hover:text-white transition">Mute Call</button>
                                            ) : (
                                                <button onClick={() => grantPermission(p.userId)} className="text-[9px] font-black px-3 py-1.5 bg-green-900/60 text-green-400 rounded-md hover:bg-green-600 hover:text-white transition">Allow Mic</button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            
            {/* 🌟 GUEST CONTROLS */}
            {role === 'guest' && (
                <div className="flex flex-col items-center gap-4 relative z-30">
                    <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest bg-purple-900/30 px-4 py-1.5 rounded-full border border-purple-500/30 shadow-md">VIP Studio Guest</span>
                    {!canSpeak ? (
                        <div className="text-center bg-slate-800/80 p-4 rounded-xl border border-slate-700 max-w-xs shadow-lg"><span className="text-xs text-slate-300 font-medium">You are in the studio! Waiting for the Host to open your microphone.</span></div>
                    ) : (
                        <div className="flex items-center gap-4 bg-slate-900/90 p-2.5 rounded-full border border-slate-700 shadow-xl">
                            <button onClick={toggleMic} className={`p-4 rounded-full transition-all ${isMute ? 'bg-red-500/20 text-red-500' : 'bg-green-600 text-white shadow-md'}`}>{isMute ? <MicOff size={20} /> : <Mic size={20} />}</button>
                            <button onClick={handleLeave} className="p-4 rounded-full bg-slate-700 text-red-400 hover:bg-red-900/80 transition-all shadow-md"><LogOut size={20} /></button>
                        </div>
                    )}
                </div>
            )}

            {/* 🙋 LOGGED IN FAN (Call-In View) */}
            {role === 'user' && (
                <div className="flex flex-col items-center gap-4 relative z-30 mt-4">
                    {!canSpeak ? (
                        <button onClick={async () => { await call.requestPermissions({ permissions: ['send-audio'] }); setHandRaised(true); }} disabled={handRaised} className={`flex items-center gap-2 px-8 py-3 rounded-full shadow-xl transition-all active:scale-95 ${handRaised ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' : 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-600'}`}>
                            <Hand size={18} className={handRaised ? "animate-bounce" : ""} />
                            <span className="text-xs font-black uppercase tracking-widest">{handRaised ? 'Hand Raised (Waiting...)' : 'Raise Hand to Call In'}</span>
                        </button>
                    ) : (
                        <div className="flex flex-col items-center gap-4 animate-in slide-in-from-bottom-4">
                            <span className="text-[10px] font-black text-white uppercase tracking-widest bg-red-600 px-4 py-1.5 rounded-full shadow-[0_0_15px_red] animate-pulse">Live on Air</span>
                            <div className="flex items-center gap-4 bg-slate-900/90 p-2.5 rounded-full border border-slate-700 shadow-xl">
                                <button onClick={toggleMic} className={`p-4 rounded-full transition-all ${isMute ? 'bg-red-500/20 text-red-500' : 'bg-green-600 text-white shadow-md'}`}>{isMute ? <MicOff size={20} /> : <Mic size={20} />}</button>
                                <button onClick={() => call.revokePermissions(call.currentUserId!, ['send-audio'])} className="p-4 rounded-full bg-slate-700 text-red-400 hover:bg-slate-600 shadow-md"><LogOut size={20} /></button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ==========================================
// 🚀 MAIN COMPONENT (The Entry Point)
// ==========================================
export default function FactSportAudioRoom({ matchId }: { matchId: string }) {
    const [client, setClient] = useState<StreamVideoClient | null>(null);
    const [call, setCall] = useState<Call | null>(null);
    const [role, setRole] = useState<'admin' | 'user' | 'guest' | 'anonymous'>('anonymous');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isWaitingForHost, setIsWaitingForHost] = useState(false);
    
    const [streamData, setStreamData] = useState<any>(null);
    const [userHasInteracted, setUserHasInteracted] = useState(false);
    
    const [isHlsMode, setIsHlsMode] = useState(false);
    const [hlsUrl, setHlsUrl] = useState<string | null>(null);

    // Step 1: Fetch credentials silently
    useEffect(() => {
        let isMounted = true;
        const fetchToken = async () => {
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const guestToken = urlParams.get('guest');
                const apiUrl = `/api/stream/token?match_id=${matchId}${guestToken ? `&guest=${guestToken}` : ''}`;
                
                const res = await fetch(apiUrl);
                const data = await res.json();
                
                if (!res.ok) throw new Error(data.error);
                if (isMounted) setStreamData(data);
                
                if (data.role === 'admin' || data.role === 'guest') setUserHasInteracted(true);
            } catch (err: any) {
                if (isMounted) setErrorMsg(err.message || "Failed to load broadcast.");
            }
        };
        fetchToken();
        return () => { isMounted = false; };
    }, [matchId]);

    // Step 2: Connect to Stream securely
    useEffect(() => {
        if (!userHasInteracted || !streamData) return;
        
        let isMounted = true;
        let pollInterval: NodeJS.Timeout;

        const connectStream = async () => {
            const myClient = new StreamVideoClient({
                apiKey: streamData.apiKey,
                user: { id: streamData.userId, name: streamData.username, image: streamData.image },
                token: streamData.token,
            });
            const myCall = myClient.call('audio_room', matchId);
            setRole(streamData.role);

            try {
                // 📡 CHECK FOR HLS RADIO
                try {
                    const callData = await myCall.get();
                    const playlistUrl = callData.call.egress?.hls?.playlist_url;
                    
                    if (playlistUrl && streamData.role === 'anonymous') {
                        if (isMounted) { setHlsUrl(playlistUrl); setIsHlsMode(true); }
                        return; // Stop here, serve native radio player.
                    }
                } catch (e) { /* Call not live yet */ }

                // 🌐 WEBRTC STUDIO FLOW
                if (streamData.role === 'admin') await myCall.join({ create: true });
                else await myCall.join(); 
                
                if (isMounted) { setClient(myClient); setCall(myCall); }
            } catch (joinErr: any) {
                const errMsg = joinErr.message?.toLowerCase() || '';
                
                // 🛡️ Graceful Polling (No ugly error screens!)
                if (errMsg.includes('joinbackstage') || errMsg.includes('notallowederror') || errMsg.includes('not found') || errMsg.includes("can't find call") || errMsg.includes("code 16")) {
                    if (isMounted) setIsWaitingForHost(true);
                    
                    pollInterval = setInterval(async () => {
                        try {
                            const callData = await myCall.get();
                            const playlistUrl = callData.call.egress?.hls?.playlist_url;
                            
                            if (playlistUrl && streamData.role === 'anonymous') {
                                clearInterval(pollInterval);
                                if (isMounted) { setHlsUrl(playlistUrl); setIsHlsMode(true); setIsWaitingForHost(false); }
                                return;
                            }
                            await myCall.join();
                            clearInterval(pollInterval);
                            if (isMounted) { setIsWaitingForHost(false); setClient(myClient); setCall(myCall); }
                        } catch (e) {}
                    }, 4000);
                } else {
                    setErrorMsg("Connection Error. Please refresh.");
                }
            }
        };

        connectStream();

        return () => {
            isMounted = false;
            if (pollInterval) clearInterval(pollInterval);
            call?.leave();
            client?.disconnectUser();
        };
    }, [userHasInteracted, streamData, matchId]);

    // 🛑 ERROR SCREEN
    if (errorMsg) return (
        <div className="w-full min-h-[150px] bg-[#0a1428] flex flex-col items-center justify-center p-4 border-b border-red-900/50">
            <XCircle className="text-red-500 mb-3" size={32} />
            <span className="text-[10px] font-black uppercase text-red-400 tracking-widest text-center">{errorMsg}</span>
        </div>
    );

    // 🎧 TUNE IN GATE (Mandatory for AutoPlay bypassing)
    if (!userHasInteracted && streamData) {
        return (
            <div className="w-full min-h-[250px] bg-gradient-to-b from-[#0a1428] to-black relative overflow-hidden flex flex-col items-center justify-center p-6 border-b border-slate-800">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1518605368461-1e1e1a8a29a6?q=80')] bg-cover opacity-10 blur-sm mix-blend-overlay"></div>
                <div className="relative z-10 flex flex-col items-center gap-5 text-center">
                    <div className="w-20 h-20 bg-blue-600/20 rounded-full flex items-center justify-center border border-blue-500/50 shadow-[0_0_40px_rgba(37,99,235,0.4)] relative">
                        <div className="absolute inset-0 border-2 border-blue-400 rounded-full animate-ping opacity-20"></div>
                        <Radio size={36} className="text-blue-400" />
                    </div>
                    <div>
                        <h3 className="text-white font-black text-xl uppercase tracking-widest drop-shadow-lg">FactSport Radio</h3>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1.5">Live Broadcast</p>
                    </div>
                    <button onClick={() => setUserHasInteracted(true)} className="mt-2 flex items-center gap-3 px-10 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black tracking-widest uppercase rounded-full shadow-[0_10px_30px_rgba(37,99,235,0.4)] transition-all active:scale-95">
                        <Play fill="currentColor" size={18} /> Tune In Now
                    </button>
                </div>
            </div>
        );
    }

    // ⏳ WAITING FOR HOST 
    if (isWaitingForHost || (!isHlsMode && (!client || !call))) {
        return (
            <div className="w-full min-h-[250px] bg-gradient-to-b from-[#0a1428] to-black relative overflow-hidden flex flex-col items-center justify-center p-6 border-b border-slate-800">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1518605368461-1e1e1a8a29a6?q=80')] bg-cover opacity-10 blur-sm mix-blend-overlay"></div>
                <div className="relative z-10 flex flex-col items-center text-center animate-in fade-in">
                    {isWaitingForHost ? (
                        <>
                            <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center border border-yellow-500/30 mb-4 shadow-[0_0_30px_rgba(234,179,8,0.2)]">
                                <Radio className="text-yellow-500 animate-pulse" size={28} />
                            </div>
                            <h3 className="text-white font-black text-sm uppercase tracking-widest">Host is Backstage</h3>
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-2">Broadcast begins shortly...</p>
                        </>
                    ) : (
                        <div className="flex flex-col items-center gap-4">
                            <Loader2 className="animate-spin text-blue-500" size={32} />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Connecting...</span>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // 📻 ANONYMOUS HLS RADIO DASHBOARD
    if (isHlsMode && hlsUrl) {
        return (
            <div className="w-full min-h-[300px] bg-gradient-to-b from-[#0a1428] to-black relative overflow-hidden border-b border-slate-800 flex flex-col items-center justify-center p-6">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1518605368461-1e1e1a8a29a6?q=80')] bg-cover opacity-10 blur-md mix-blend-overlay z-0"></div>
                
                <div className="relative z-10 w-full flex flex-col items-center">
                    <PremiumHLSRadio url={hlsUrl} />
                    
                    <div className="mt-8 flex flex-col items-center gap-2">
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Want to join the conversation?</span>
                        <Link href="/login" className="flex items-center gap-2 px-8 py-3 rounded-full bg-slate-800/80 border border-slate-700 text-white hover:bg-slate-700 shadow-xl transition-all active:scale-95">
                            <Mic size={16} /> <span className="text-[10px] font-black tracking-widest uppercase">Login to Call In</span>
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // 🎙️ THE LIVE WEBRTC STUDIO ROOM
    return (
        <div className="w-full bg-gradient-to-b from-[#0a1428] to-black relative overflow-hidden border-b border-slate-800 flex flex-col group p-6 min-h-[300px]">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1518605368461-1e1e1a8a29a6?q=80')] bg-cover opacity-10 blur-md mix-blend-overlay pointer-events-none z-0"></div>
            
            <StreamTheme className="stream-theme-custom w-full">
                <StreamVideo client={client!}>
                    <StreamCall call={call!}>
                        <div className="relative z-10 w-full flex flex-col gap-4">
                            
                            {/* 🔊 The Invisible Audio Engine */}
                            <div className="absolute w-[1px] h-[1px] opacity-0 pointer-events-none overflow-hidden -left-[9999px]">
                                <SpeakerLayout />
                            </div>

                            {/* Header */}
                            <div className="flex items-center justify-between border-b border-white/10 pb-3 relative z-30">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center border border-blue-500/30">
                                        <Radio className="text-blue-400" size={16} />
                                    </div>
                                    <span className="text-white text-xs md:text-sm font-black tracking-widest uppercase shadow-md">FactSport Studio</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_red]"></div>
                                    <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded shadow-md ${role === 'admin' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20' : role === 'guest' ? 'bg-purple-600/20 text-purple-400 border border-purple-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                                        {role === 'admin' ? 'Host Control' : role === 'guest' ? 'VIP Guest' : 'Studio Audience'}
                                    </span>
                                </div>
                            </div>
                            
                            {/* Center Stage / Avatars */}
                            <div className="min-h-[140px] bg-black/40 rounded-2xl p-4 border border-white/5 flex flex-col items-center justify-center relative z-20 shadow-inner">
                                <CustomAudioLayout />
                            </div>

                            {/* Control Deck */}
                            <InteractiveAudioUI role={role} matchId={matchId} />
                        </div>
                    </StreamCall>
                </StreamVideo>
            </StreamTheme>
        </div>
    );
}