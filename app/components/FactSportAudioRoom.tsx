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
    hasAudio
} from '@stream-io/video-react-sdk';
import '@stream-io/video-react-sdk/dist/css/styles.css';
import { Loader2, Radio, Hand, Mic, MicOff, CheckCircle, XCircle, Link as LinkIcon, Check, Play, Square, LogOut, Users, Circle } from 'lucide-react';

// ==========================================
// 📻 NATIVE HLS RADIO PLAYER (For Anonymous Listeners)
// ==========================================
const HLSAudioPlayer = ({ url }: { url: string }) => {
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (typeof window === 'undefined' || !audioRef.current || !url) return;
        const audio = audioRef.current;

        // Dynamically import to prevent Next.js SSR crashes
        import('hls.js').then((HlsModule) => {
            const Hls = HlsModule.default;
            if (Hls.isSupported()) {
                const hls = new Hls();
                hls.loadSource(url);
                hls.attachMedia(audio);
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    audio.play().catch(() => {}); // Browsers may require user to click play
                });
                return () => hls.destroy();
            } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
                // Safari Native Support
                audio.src = url;
                audio.addEventListener('loadedmetadata', () => audio.play().catch(()=>{}));
            }
        });
    }, [url]);

    return (
        <div className="flex flex-col items-center w-full max-w-sm mt-2 bg-black/40 p-5 rounded-2xl border border-white/10 shadow-2xl animate-in fade-in zoom-in">
            <Radio className="text-blue-500 mb-2 animate-pulse drop-shadow-[0_0_15px_rgba(59,130,246,0.6)]" size={32} />
            <span className="text-xs font-black text-white uppercase tracking-widest mb-1 shadow-md">FactSport Live Radio</span>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-4">TalkSport Mode Active</span>
            <audio ref={audioRef} controls className="w-full h-10 rounded-full outline-none" />
        </div>
    );
};

// ==========================================
// 🎨 CUSTOM WEBRTC AVATARS
// ==========================================
const CustomAudioLayout = () => {
    const { useParticipants } = useCallStateHooks();
    const participants = useParticipants();

    return (
        <div className="flex flex-wrap items-center justify-center gap-6 py-6 w-full">
            {participants.map((p) => {
                const isMuted = !hasAudio(p); 
                return (
                    <div key={p.sessionId} className="flex flex-col items-center gap-3 animate-in fade-in zoom-in">
                        <div className={`relative w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center border-4 bg-slate-800 transition-all duration-300 ${
                            p.isSpeaking ? 'border-green-500 shadow-[0_0_25px_rgba(34,197,94,0.4)] scale-110' : 'border-slate-700'
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
                    </div>
                );
            })}
        </div>
    );
};

// ==========================================
// 🎛️ WEBRTC CONTROL DECK
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
    
    // 🎚️ HLS Toggle State for Admin
    const [useHls, setUseHls] = useState(false);

    // 🛡️ WAKE LOCK: Keep Admin's screen awake while broadcasting
    useEffect(() => {
        let wakeLock: any = null;
        const requestWakeLock = async () => {
            if (role === 'admin' && isLive && 'wakeLock' in navigator) {
                try { wakeLock = await (navigator as any).wakeLock.request('screen'); } 
                catch (err) { console.error("Wake Lock failed:", err); }
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
                            <label className="flex items-center justify-center gap-2 text-[10px] font-bold text-slate-300 uppercase tracking-widest bg-slate-800/50 px-4 py-2.5 rounded-lg cursor-pointer border border-slate-700 w-full max-w-xs transition hover:bg-slate-800 shadow-md">
                                <input type="checkbox" checked={useHls} onChange={(e) => setUseHls(e.target.checked)} className="accent-blue-500 w-4 h-4 cursor-pointer" />
                                Enable TalkSport Mode (HLS)
                            </label>
                            <button onClick={() => call.goLive({ start_hls: useHls })} className="flex items-center gap-2 px-8 py-3 rounded-full bg-green-600 hover:bg-green-500 text-white font-black tracking-widest uppercase shadow-[0_0_15px_rgba(34,197,94,0.5)] transition-all animate-pulse w-full max-w-xs justify-center">
                                <Play size={18} fill="currentColor" /> Go Live to Public
                            </button>
                        </div>
                    ) : (
                        <button onClick={() => call.stopLive()} className="flex items-center gap-2 px-6 py-2 rounded-full bg-red-900/50 hover:bg-red-600 border border-red-500 text-white font-bold tracking-widest uppercase transition-all">
                            <Square size={14} fill="currentColor" /> End Broadcast
                        </button>
                    )}

                    <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4 bg-slate-900/80 p-2 rounded-full border border-slate-700">
                        <button onClick={toggleMic} className={`p-3 md:p-4 rounded-full transition-all ${isMute ? 'bg-red-500/20 text-red-500' : 'bg-slate-700 text-white hover:bg-slate-600'}`}>
                            {isMute ? <MicOff size={18} /> : <Mic size={18} />}
                        </button>
                        <button onClick={toggleRecording} className={`p-3 md:p-4 rounded-full transition-all ${isRecording ? 'bg-red-600 text-white animate-pulse shadow-[0_0_15px_red]' : 'bg-slate-700 text-white hover:bg-slate-600'}`}>
                            <Circle size={18} fill={isRecording ? "white" : "none"} />
                        </button>
                        <button onClick={() => setShowManager(!showManager)} className={`p-3 md:p-4 rounded-full transition-all ${showManager ? 'bg-blue-600 text-white' : 'bg-slate-700 text-white hover:bg-slate-600'}`}>
                            <Users size={18} />
                        </button>
                        <button onClick={handleLeave} className="p-3 md:p-4 rounded-full bg-slate-700 text-red-400 hover:bg-red-900/50 transition-all"><LogOut size={18} /></button>
                    </div>

                    {showManager && (
                        <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-lg p-3 flex flex-col gap-2 shadow-2xl">
                            <div className="flex items-center justify-between border-b border-slate-700 pb-2 mb-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Manage Speakers</span>
                                <button onClick={generateVIPLink} disabled={isGenerating} className="text-blue-400 hover:text-blue-300 text-[9px] uppercase font-bold flex items-center gap-1 bg-blue-900/30 px-2 py-1 rounded">
                                    {isGenerating ? <Loader2 size={10} className="animate-spin"/> : <LinkIcon size={10}/>} {copied ? 'Copied' : 'Copy Guest Link'}
                                </button>
                            </div>
                            {participants.map(p => (
                                <div key={p.userId} className="flex items-center justify-between bg-black/40 px-3 py-2 rounded border border-white/5">
                                    <span className="text-xs text-white font-medium truncate max-w-[120px]">{p.name || p.userId}</span>
                                    {p.userId !== call.currentUserId && (
                                        <div className="flex items-center gap-2">
                                            {p.roles.includes('admin') ? (
                                                <span className="text-[9px] text-blue-500 uppercase font-bold">Host</span>
                                            ) : hasAudio(p) ? (
                                                <button onClick={() => revokePermission(p.userId)} className="text-[9px] font-bold px-2 py-1 bg-red-900/50 text-red-400 rounded hover:bg-red-600 hover:text-white transition">Revoke Mic</button>
                                            ) : (
                                                <button onClick={() => grantPermission(p.userId)} className="text-[9px] font-bold px-2 py-1 bg-green-900/50 text-green-400 rounded hover:bg-green-600 hover:text-white transition">Allow Mic</button>
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
                <div className="flex flex-col items-center gap-4">
                    <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest bg-purple-900/30 px-3 py-1 rounded-full border border-purple-500/30">VIP Guest</span>
                    {!canSpeak ? (
                        <div className="text-center bg-slate-800 p-3 rounded-lg border border-slate-700 max-w-xs"><span className="text-xs text-slate-300">You are in the room! Waiting for the Host to unmute your microphone.</span></div>
                    ) : (
                        <div className="flex items-center gap-4 bg-slate-900/80 p-2 rounded-full border border-slate-700">
                            <button onClick={toggleMic} className={`p-4 rounded-full transition-all ${isMute ? 'bg-red-500/20 text-red-500' : 'bg-green-600 text-white'}`}>{isMute ? <MicOff size={20} /> : <Mic size={20} />}</button>
                            <button onClick={handleLeave} className="p-4 rounded-full bg-slate-700 text-red-400 hover:bg-red-900/50 transition-all"><LogOut size={20} /></button>
                        </div>
                    )}
                </div>
            )}
            
            {/* 🎧 WEBRTC PUBLIC LISTENER (Anonymous Fallback) */}
            {role === 'anonymous' && (
                <Link href="/login" className="flex items-center gap-2 px-6 py-2 rounded-full bg-[#1A1A1A] border border-slate-700 text-slate-300 hover:bg-slate-800 shadow-lg active:scale-95 mt-2">
                    <Mic size={14} /> <span className="text-[11px] font-bold uppercase">Login to Call In</span>
                </Link>
            )}

            {/* 🙋 LOGGED IN FAN */}
            {role === 'user' && (
                <div className="flex flex-col items-center gap-3">
                    {!canSpeak ? (
                        <button onClick={async () => { await call.requestPermissions({ permissions: ['send-audio'] }); setHandRaised(true); }} disabled={handRaised} className={`flex items-center gap-2 px-6 py-2 rounded-full shadow-lg transition-all ${handRaised ? 'bg-yellow-500/20 text-yellow-500' : 'bg-slate-800 text-white hover:bg-slate-700'}`}>
                            <Hand size={16} className={handRaised ? "animate-bounce" : ""} />
                            <span className="text-[11px] font-bold uppercase">{handRaised ? 'Hand Raised (Waiting...)' : 'Raise Hand to Speak'}</span>
                        </button>
                    ) : (
                        <div className="flex flex-col items-center gap-3">
                            <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest bg-green-900/30 px-3 py-1 rounded-full border border-green-500/30 animate-pulse">Live on Air</span>
                            <div className="flex items-center gap-4 bg-slate-900/80 p-2 rounded-full border border-slate-700">
                                <button onClick={toggleMic} className={`p-4 rounded-full transition-all ${isMute ? 'bg-red-500/20 text-red-500' : 'bg-green-600 text-white'}`}>{isMute ? <MicOff size={20} /> : <Mic size={20} />}</button>
                                <button onClick={() => call.revokePermissions(call.currentUserId!, ['send-audio'])} className="p-4 rounded-full bg-slate-700 text-red-400 hover:bg-slate-600"><LogOut size={20} /></button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ==========================================
// 🚀 MAIN COMPONENT
// ==========================================
export default function FactSportAudioRoom({ matchId }: { matchId: string }) {
    const [client, setClient] = useState<StreamVideoClient | null>(null);
    const [call, setCall] = useState<Call | null>(null);
    const [role, setRole] = useState<'admin' | 'user' | 'guest' | 'anonymous'>('anonymous');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isWaitingForHost, setIsWaitingForHost] = useState(false);
    
    // Auth & Modes
    const [streamData, setStreamData] = useState<any>(null);
    const [userHasInteracted, setUserHasInteracted] = useState(false);
    
    // 🎚️ HLS Magic Mode State
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
                
                // Admins/Guests skip the "Tune In" interaction because they are broadcasting
                if (data.role === 'admin' || data.role === 'guest') setUserHasInteracted(true);
                
            } catch (err: any) {
                if (isMounted) setErrorMsg(err.message || "Failed to fetch credentials.");
            }
        };
        fetchToken();
        return () => { isMounted = false; };
    }, [matchId]);

    // Step 2: Connect securely
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
                // 📡 CHECK FOR HLS FIRST
                try {
                    const callData = await myCall.get();
                    const playlistUrl = callData.call.egress?.hls?.playlist_url;
                    
                    // IF HLS exists and user is anonymous -> Mount HLS Player, do NOT join WebRTC (Saves Bandwidth & Prevents Echo)
                    if (playlistUrl && streamData.role === 'anonymous') {
                        if (isMounted) {
                            setHlsUrl(playlistUrl);
                            setIsHlsMode(true);
                        }
                        return; // 🛑 Stop execution here. No WebRTC for this user.
                    }
                } catch (e) { /* Call might not be created yet, proceed normally */ }

                // 🌐 WEBRTC FLOW
                if (streamData.role === 'admin') await myCall.join({ create: true });
                else await myCall.join(); 
                
                if (isMounted) { setClient(myClient); setCall(myCall); }
            } catch (joinErr: any) {
                const errMsg = joinErr.message?.toLowerCase() || '';
                
                if (errMsg.includes('joinbackstage') || errMsg.includes('notallowederror')) {
                    if (isMounted) setIsWaitingForHost(true);
                    
                    // 🔄 Polling the waiting room
                    pollInterval = setInterval(async () => {
                        try {
                            const callData = await myCall.get();
                            const playlistUrl = callData.call.egress?.hls?.playlist_url;
                            
                            // Check if host went live with HLS while we were waiting
                            if (playlistUrl && streamData.role === 'anonymous') {
                                clearInterval(pollInterval);
                                if (isMounted) {
                                    setHlsUrl(playlistUrl);
                                    setIsHlsMode(true);
                                    setIsWaitingForHost(false);
                                }
                                return;
                            }

                            // Otherwise, check if they went live with WebRTC
                            await myCall.join();
                            clearInterval(pollInterval);
                            if (isMounted) { setIsWaitingForHost(false); setClient(myClient); setCall(myCall); }
                        } catch (e) {}
                    }, 4000);
                } else if (errMsg.includes('not found') || errMsg.includes("can't find call")) {
                    setErrorMsg("The host hasn't started this broadcast yet. Please wait.");
                } else {
                    setErrorMsg("Connection Error.");
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
        <div className="w-full min-h-[150px] bg-[#0a1428] flex flex-col items-center justify-center p-4 border-b border-red-900/50"><XCircle className="text-red-500 mb-2" size={24} /><span className="text-[10px] font-black uppercase text-red-400 tracking-widest text-center">{errorMsg}</span></div>
    );

    // 🎧 AUTOPLAY FIX SCREEN (Forces user interaction)
    if (!userHasInteracted && streamData) {
        return (
            <div className="w-full min-h-[250px] bg-[#0a1428] relative overflow-hidden flex flex-col items-center justify-center p-4 border-b border-slate-800">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1518605368461-1e1e1a8a29a6?q=80')] bg-cover opacity-20 blur-sm"></div>
                <div className="relative z-10 flex flex-col items-center gap-4 text-center">
                    <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center border border-blue-500/50 shadow-[0_0_30px_rgba(37,99,235,0.3)]">
                        <Radio size={30} className="text-blue-400 animate-pulse" />
                    </div>
                    <div>
                        <h3 className="text-white font-black text-lg uppercase tracking-widest shadow-lg">FactSport Radio</h3>
                        <p className="text-slate-400 text-xs font-medium mt-1">Click below to connect audio</p>
                    </div>
                    <button onClick={() => setUserHasInteracted(true)} className="mt-2 flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black tracking-widest uppercase rounded-full shadow-lg transition-all active:scale-95">
                        <Play fill="currentColor" size={16} /> Tune In Live
                    </button>
                </div>
            </div>
        );
    }

    // ⏳ WAITING FOR HOST / INITIALIZING
    if (isWaitingForHost || (!isHlsMode && (!client || !call))) {
        return (
            <div className="w-full min-h-[200px] bg-[#0a1428] relative overflow-hidden flex flex-col items-center justify-center p-4 border-b border-slate-800">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1518605368461-1e1e1a8a29a6?q=80')] bg-cover opacity-10 blur-sm"></div>
                <div className="relative z-10 flex flex-col items-center">
                    {isWaitingForHost ? (
                        <>
                            <Radio className="text-yellow-500 w-10 h-10 mb-3 animate-pulse shadow-lg" />
                            <h3 className="text-white font-black uppercase tracking-widest">Host is Backstage</h3>
                            <p className="text-slate-400 text-[10px] mt-1 text-center">You'll be connected when they go live.</p>
                        </>
                    ) : (
                        <Loader2 className="animate-spin text-blue-500 mb-2" size={24} />
                    )}
                </div>
            </div>
        );
    }

    // 📻 ANONYMOUS HLS MODE (Bypasses WebRTC Entirely!)
    if (isHlsMode && hlsUrl) {
        return (
            <div className="w-full min-h-[250px] bg-[#0a1428] relative overflow-hidden border-b border-slate-800 flex flex-col items-center justify-center p-4">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1518605368461-1e1e1a8a29a6?q=80')] bg-cover opacity-10 blur-md pointer-events-none z-0"></div>
                <div className="relative z-10 w-full flex flex-col items-center">
                    <HLSAudioPlayer url={hlsUrl} />
                    <Link href="/login" className="flex items-center gap-2 px-6 py-2 rounded-full bg-[#1A1A1A] border border-slate-700 text-slate-300 hover:bg-slate-800 shadow-lg active:scale-95 mt-4">
                        <Mic size={14} /> <span className="text-[11px] font-bold uppercase">Login to Call In</span>
                    </Link>
                </div>
            </div>
        );
    }

    // 🎙️ THE LIVE WEBRTC RADIO ROOM (Admins, Guests, Logged-In Fans)
    return (
        <div className="w-full bg-[#0a1428] relative overflow-hidden border-b border-slate-800 flex flex-col group p-4 min-h-[250px]">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1518605368461-1e1e1a8a29a6?q=80')] bg-cover opacity-10 blur-md pointer-events-none z-0"></div>
            
            <StreamTheme className="stream-theme-custom w-full">
                <StreamVideo client={client!}>
                    <StreamCall call={call!}>
                        <div className="relative z-10 w-full flex flex-col gap-4">
                            {/* HEADER */}
                            <div className="flex items-center justify-between border-b border-white/10 pb-2">
                                <div className="flex items-center gap-2">
                                    <Radio className="text-red-500 w-5 h-5 animate-pulse drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                                    <span className="text-white text-xs md:text-sm font-black tracking-widest uppercase">FactSport Live</span>
                                </div>
                                <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded shadow-sm ${role === 'admin' ? 'bg-blue-600/20 text-blue-400' : role === 'guest' ? 'bg-purple-600/20 text-purple-400' : 'bg-slate-800 text-slate-400'}`}>
                                    {role === 'admin' ? 'Host Mode' : role === 'guest' ? 'VIP Guest' : 'Listener'}
                                </span>
                            </div>
                            
                            {/* SPEAKER AREA */}
                            <div className="min-h-[120px] bg-black/40 rounded-xl p-2 border border-white/5 flex flex-col items-center justify-center">
                                <CustomAudioLayout />
                            </div>

                            {/* CONTROLS */}
                            <InteractiveAudioUI role={role} matchId={matchId} />
                        </div>
                    </StreamCall>
                </StreamVideo>
            </StreamTheme>
        </div>
    );
}