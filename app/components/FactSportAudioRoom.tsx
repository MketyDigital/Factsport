'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
    StreamVideo, 
    StreamVideoClient, 
    StreamCall, 
    CallControls, 
    Call, 
    useCallStateHooks, 
    useCall, 
    StreamTheme,
    hasAudio // 👈 TypeScript fix imported here
} from '@stream-io/video-react-sdk';
import '@stream-io/video-react-sdk/dist/css/styles.css';
import { Loader2, Radio, Hand, Mic, MicOff, CheckCircle, XCircle, Link as LinkIcon, Check, Play, Square } from 'lucide-react';

// ==========================================
// 🎨 CUSTOM AUDIO LAYOUT (Fixes the black box issue & TS Error)
// ==========================================
const CustomAudioLayout = () => {
    const { useParticipants } = useCallStateHooks();
    const participants = useParticipants();

    return (
        <div className="flex flex-wrap items-center justify-center gap-6 py-6 w-full">
            {participants.map((p) => {
                // 👈 FIX: Calculate muted state using Stream's built-in helper
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
// 🎛️ INTERACTIVE CONTROLS (Handles Roles)
// ==========================================
const InteractiveAudioUI = ({ role, matchId }: { role: 'admin' | 'user' | 'guest' | 'anonymous', matchId: string }) => {
    const call = useCall();
    const { useHasPermissions, useCallBackstage } = useCallStateHooks();
    const canSpeak = useHasPermissions('send-audio');
    const isBackstage = useCallBackstage(); // Checks if the room is live or waiting
    
    const [handRaised, setHandRaised] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [permissionRequests, setPermissionRequests] = useState<any[]>([]);

    useEffect(() => {
        if (!call || role !== 'admin') return;
        const unsubscribe = call.on('call.permission_request', (event: any) => {
            setPermissionRequests((prev) => {
                if (prev.some(req => req.user.id === event.user.id)) return prev;
                return [...prev, event];
            });
        });
        return () => unsubscribe();
    }, [call, role]);

    if (!call) return null;

    const requestToSpeak = async () => {
        try {
            await call.requestPermissions({ permissions: ['send-audio'] });
            setHandRaised(true);
        } catch (err) {
            console.error("Permission request failed", err);
        }
    };

    const handleApprove = async (userId: string) => {
        await call.grantPermissions(userId, ['send-audio']);
        setPermissionRequests((prev) => prev.filter(req => req.user.id !== userId));
    };

    const handleDeny = async (userId: string) => {
        setPermissionRequests((prev) => prev.filter(req => req.user.id !== userId));
    };

    const generateVIPLink = async () => {
        setIsGenerating(true);
        try {
            const res = await fetch('/api/stream/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matchId }) });
            if (!res.ok) throw new Error("Failed to generate link");
            const data = await res.json();
            await navigator.clipboard.writeText(data.inviteLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 3000);
        } catch (error) {
            alert("Could not generate link. Are you sure you are an Admin?");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="flex flex-col items-center w-full gap-4 mt-2">
            {/* 👑 ADMIN UI */}
            {role === 'admin' && (
                <div className="w-full flex flex-col items-center gap-4">
                    {/* LIVE TOGGLE BUTTON */}
                    {isBackstage ? (
                        <button onClick={() => call.goLive()} className="flex items-center gap-2 px-8 py-3 rounded-full bg-green-600 hover:bg-green-500 text-white font-black tracking-widest uppercase shadow-[0_0_15px_rgba(34,197,94,0.5)] transition-all animate-pulse">
                            <Play size={18} fill="currentColor" /> Go Live to Public
                        </button>
                    ) : (
                        <button onClick={() => call.stopLive()} className="flex items-center gap-2 px-6 py-2 rounded-full bg-red-900/50 hover:bg-red-600 border border-red-500 text-white font-bold tracking-widest uppercase transition-all">
                            <Square size={14} fill="currentColor" /> End Broadcast
                        </button>
                    )}

                    <div className="flex items-center gap-4"><CallControls /></div>
                    
                    <button onClick={generateVIPLink} disabled={isGenerating} className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-900/20 text-blue-400 hover:bg-blue-900/40 transition-all active:scale-95 shadow-sm">
                        {isGenerating ? <Loader2 size={14} className="animate-spin" /> : copied ? <Check size={14} className="text-green-400" /> : <LinkIcon size={14} />}
                        <span className="text-[10px] font-bold tracking-widest uppercase">{copied ? 'Link Copied!' : 'Copy VIP Guest Link'}</span>
                    </button>

                    {permissionRequests.length > 0 && (
                        <div className="w-full max-w-sm bg-slate-900/80 border border-blue-500/30 rounded-lg p-2 flex flex-col gap-2 shadow-lg mt-2">
                            <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest border-b border-white/10 pb-1">Caller Requests</span>
                            {permissionRequests.map((req) => (
                                <div key={req.user.id} className="flex items-center justify-between bg-black/50 px-2 py-1.5 rounded">
                                    <span className="text-xs text-white font-medium truncate max-w-[120px]">{req.user.name || req.user.id}</span>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleApprove(req.user.id)} className="text-green-400 hover:scale-110 transition"><CheckCircle size={16} /></button>
                                        <button onClick={() => handleDeny(req.user.id)} className="text-red-400 hover:scale-110 transition"><XCircle size={16} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            
            {/* 🌟 GUEST UI */}
            {role === 'guest' && (
                <div className="flex flex-col items-center gap-2 animate-in zoom-in">
                    <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest bg-purple-900/30 px-3 py-1 rounded-full border border-purple-500/30 shadow-md">VIP Guest Speaker</span>
                    <CallControls />
                </div>
            )}
            
            {/* 🎧 PUBLIC LISTENER UI (Prompt to login) */}
            {role === 'anonymous' && (
                <div className="flex flex-col items-center gap-3">
                    <Link href="/login" className="flex items-center gap-2 px-6 py-2 rounded-full bg-[#1A1A1A] border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white shadow-lg transition-all active:scale-95">
                        <Mic size={14} />
                        <span className="text-[11px] font-bold tracking-wide uppercase">Login to Call In</span>
                    </Link>
                </div>
            )}

            {/* 🙋 LOGGED IN FAN UI */}
            {role === 'user' && (
                <div className="flex flex-col items-center gap-3">
                    {!canSpeak ? (
                        <button onClick={requestToSpeak} disabled={handRaised} className={`flex items-center gap-2 px-6 py-2 rounded-full border shadow-lg transition-all active:scale-95 ${handRaised ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-500' : 'bg-slate-800 border-slate-600 text-white hover:bg-slate-700'}`}>
                            <Hand size={16} className={handRaised ? "animate-bounce" : ""} />
                            <span className="text-[11px] font-bold tracking-wide">{handRaised ? 'Hand Raised (Waiting for Host...)' : 'Raise Hand to Call In'}</span>
                        </button>
                    ) : (
                        <div className="flex flex-col items-center gap-2 animate-in fade-in zoom-in">
                            <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest bg-green-900/30 px-3 py-1 rounded-full border border-green-500/30">You are Live on Air</span>
                            <CallControls onLeave={() => call.revokePermissions(call.currentUserId!, ['send-audio'])} />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ==========================================
// 🚀 MAIN ROOM COMPONENT
// ==========================================
export default function FactSportAudioRoom({ matchId }: { matchId: string }) {
    const [client, setClient] = useState<StreamVideoClient | null>(null);
    const [call, setCall] = useState<Call | null>(null);
    const [role, setRole] = useState<'admin' | 'user' | 'guest' | 'anonymous'>('anonymous');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isWaitingForHost, setIsWaitingForHost] = useState(false);

    useEffect(() => {
        let isMounted = true;
        let pollInterval: NodeJS.Timeout;

        const initAudioRoom = async () => {
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const guestToken = urlParams.get('guest');

                const apiUrl = `/api/stream/token?match_id=${matchId}${guestToken ? `&guest=${guestToken}` : ''}`;
                const res = await fetch(apiUrl);
                const data = await res.json();

                if (!res.ok) {
                    setErrorMsg(data.error || "Could not join radio room.");
                    return; 
                }

                if (!data.apiKey || !data.token) {
                    setErrorMsg("Stream Server configuration missing.");
                    return;
                }
                
                if (!isMounted) return;
                setRole(data.role);

                const myClient = new StreamVideoClient({
                    apiKey: data.apiKey,
                    user: { id: data.userId, name: data.username, image: data.image },
                    token: data.token,
                });

                const myCall = myClient.call('audio_room', matchId);
                
                try {
                    // Admin creates the room and joins backstage automatically to check mic
                    if (data.role === 'admin') {
                        await myCall.join({ create: true });
                        if (!isMounted) return;
                        setClient(myClient);
                        setCall(myCall);
                    } else {
                        // Everyone else tries to join
                        await myCall.join(); 
                        if (!isMounted) return;
                        setClient(myClient);
                        setCall(myCall);
                    }
                } catch (joinErr: any) {
                    const errMsg = joinErr.message?.toLowerCase() || '';
                    
                    // 🛡️ THE FAIL-PROOF WAITING ROOM LOGIC
                    if (errMsg.includes('joinbackstage') || errMsg.includes('notallowederror')) {
                        if (isMounted) setIsWaitingForHost(true);
                        
                        // Silently poll the server every 4 seconds to see if the Admin went live
                        pollInterval = setInterval(async () => {
                            try {
                                await myCall.join();
                                // If successful, clear the interval and put them in the room!
                                clearInterval(pollInterval);
                                if (isMounted) {
                                    setIsWaitingForHost(false);
                                    setClient(myClient);
                                    setCall(myCall);
                                }
                            } catch (e) {
                                // Still backstage, keep waiting silently...
                            }
                        }, 4000);

                    } else if (errMsg.includes('not found') || errMsg.includes("can't find call")) {
                        setErrorMsg("The host hasn't started this live broadcast yet. Please wait.");
                    } else {
                        const cleanError = joinErr.message?.replace('CONNECTION ERROR: STREAM ERROR CODE ', 'Error ') || "Failed to connect.";
                        setErrorMsg(cleanError);
                    }
                }

            } catch (err: any) {
                console.error("Stream Connection Error:", err);
                if (isMounted) setErrorMsg("Failed to connect to the broadcast server.");
            }
        };

        initAudioRoom();

        return () => {
            isMounted = false;
            if (pollInterval) clearInterval(pollInterval);
            call?.leave();
            client?.disconnectUser();
        };
    }, [matchId]);

    // 🛑 ERROR SCREEN
    if (errorMsg) {
        return (
            <div className="w-full min-h-[150px] bg-[#0a1428] flex flex-col items-center justify-center border-b border-red-900/50 p-4">
                <XCircle className="text-red-500 mb-2" size={24} />
                <span className="text-[10px] font-black uppercase text-red-400 tracking-widest text-center max-w-[80%]">{errorMsg}</span>
            </div>
        );
    }

    // ⏳ WAITING FOR HOST SCREEN
    if (isWaitingForHost) {
        return (
            <div className="w-full min-h-[200px] bg-[#0a1428] relative overflow-hidden border-b border-slate-800 flex flex-col items-center justify-center p-4 shadow-inner">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1518605368461-1e1e1a8a29a6?q=80')] bg-cover opacity-10 blur-sm pointer-events-none z-0"></div>
                <div className="relative z-10 flex flex-col items-center">
                    <Radio className="text-yellow-500 w-10 h-10 mb-3 animate-pulse drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" />
                    <h3 className="text-white text-sm md:text-base font-black uppercase tracking-widest mb-2 shadow-md">Host is Backstage</h3>
                    <p className="text-slate-400 text-[10px] md:text-xs font-bold uppercase tracking-widest text-center max-w-[85%] leading-relaxed">
                        Checking microphones... You will be connected automatically when the broadcast goes live.
                    </p>
                    <div className="mt-5 flex items-center gap-2 text-yellow-500 bg-yellow-900/30 px-4 py-1.5 rounded-full border border-yellow-500/30 shadow-lg">
                        <Loader2 size={14} className="animate-spin" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Waiting for signal</span>
                    </div>
                </div>
            </div>
        );
    }

    // 🔄 TUNING IN (INITIAL LOAD)
    if (!client || !call) {
        return (
            <div className="w-full min-h-[150px] bg-[#0a1428] flex flex-col items-center justify-center border-b border-slate-800 p-4">
                <Loader2 className="animate-spin text-blue-500 mb-2" size={24} />
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Tuning in...</span>
            </div>
        );
    }

    // 📻 THE LIVE RADIO ROOM
    return (
        <div className="w-full bg-[#0a1428] relative overflow-hidden border-b border-slate-800 flex flex-col group p-4 min-h-[250px]">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1518605368461-1e1e1a8a29a6?q=80')] bg-cover opacity-10 blur-md pointer-events-none z-0"></div>
            
            <StreamTheme className="stream-theme-custom w-full">
                <StreamVideo client={client}>
                    <StreamCall call={call}>
                        <div className="relative z-10 w-full flex flex-col gap-4">
                            {/* HEADER */}
                            <div className="flex items-center justify-between border-b border-white/10 pb-2">
                                <div className="flex items-center gap-2">
                                    <Radio className="text-red-500 w-5 h-5 animate-pulse drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                                    <span className="text-white text-xs md:text-sm font-black tracking-widest uppercase shadow-md">
                                        FactSport Live
                                    </span>
                                </div>
                                <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded border shadow-sm ${
                                    role === 'admin' ? 'bg-blue-600/20 text-blue-400 border-blue-500/30' : 
                                    role === 'guest' ? 'bg-purple-600/20 text-purple-400 border-purple-500/30' : 
                                    'bg-slate-800 text-slate-400 border-slate-700'
                                }`}>
                                    {role === 'admin' ? 'Host Mode' : role === 'guest' ? 'VIP Guest' : role === 'anonymous' ? 'Public Listener' : 'Listener'}
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