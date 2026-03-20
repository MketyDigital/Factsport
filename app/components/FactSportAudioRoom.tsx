'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link'; // 🟢 ADDED for the login button redirect
import { StreamVideo, StreamVideoClient, StreamCall, SpeakerLayout, CallControls, Call, useCallStateHooks, useCall } from '@stream-io/video-react-sdk';
import '@stream-io/video-react-sdk/dist/css/styles.css';
import { Loader2, Radio, Hand, Mic, CheckCircle, XCircle, Link as LinkIcon, Check } from 'lucide-react';

// 🟢 ADDED 'anonymous' to the role types
const InteractiveAudioUI = ({ role, matchId }: { role: 'admin' | 'user' | 'guest' | 'anonymous', matchId: string }) => {
    const call = useCall();
    const { useHasPermissions } = useCallStateHooks();
    const canSpeak = useHasPermissions('send-audio');
    
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
        } catch (err) {}
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
            {role === 'admin' && (
                <div className="w-full flex flex-col items-center gap-4">
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
            
            {role === 'guest' && (
                <div className="flex flex-col items-center gap-2 animate-in zoom-in">
                    <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest bg-purple-900/30 px-3 py-1 rounded-full border border-purple-500/30 shadow-md">VIP Guest Speaker</span>
                    <CallControls />
                </div>
            )}
            
            {/* 🟢 NEW: Public Listener UI (Prompt to login) */}
            {role === 'anonymous' && (
                <div className="flex flex-col items-center gap-3">
                    <Link href="/login" className="flex items-center gap-2 px-6 py-2 rounded-full bg-[#1A1A1A] border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white shadow-lg transition-all active:scale-95">
                        <Mic size={14} />
                        <span className="text-[11px] font-bold tracking-wide uppercase">Login to Call In</span>
                    </Link>
                </div>
            )}

            {/* 🎧 Logged In FAN UI */}
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

export default function FactSportAudioRoom({ matchId }: { matchId: string }) {
    const [client, setClient] = useState<StreamVideoClient | null>(null);
    const [call, setCall] = useState<Call | null>(null);
    const [role, setRole] = useState<'admin' | 'user' | 'guest' | 'anonymous'>('anonymous');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

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
                    if (data.role === 'admin' || data.role === 'guest') {
                        await myCall.join({ create: true });
                    } else {
                        await myCall.join(); 
                    }
                    
                    if (!isMounted) return;
                    setClient(myClient);
                    setCall(myCall);

                } catch (joinErr: any) {
                    console.error("Stream Join Error:", joinErr);
                    if (joinErr.message?.includes('not found') || joinErr.message?.includes('does not exist')) {
                        setErrorMsg("The host hasn't started this live broadcast yet. Please wait.");
                    } else if (joinErr.message?.includes('permission')) {
                        setErrorMsg("Browser blocked microphone access. Please allow mic permissions.");
                    } else {
                        setErrorMsg(`Connection error: ${joinErr.message}`);
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
            call?.leave();
            client?.disconnectUser();
        };
    }, [matchId]);

    if (errorMsg) {
        return (
            <div className="w-full min-h-[150px] bg-[#0a1428] flex flex-col items-center justify-center border-b border-red-900/50 p-4">
                <XCircle className="text-red-500 mb-2" size={24} />
                <span className="text-[10px] font-black uppercase text-red-400 tracking-widest text-center max-w-[80%]">{errorMsg}</span>
            </div>
        );
    }

    if (!client || !call) {
        return (
            <div className="w-full min-h-[150px] bg-[#0a1428] flex flex-col items-center justify-center border-b border-slate-800 p-4">
                <Loader2 className="animate-spin text-blue-500 mb-2" size={24} />
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Tuning in...</span>
            </div>
        );
    }

    return (
        <div className="w-full bg-[#0a1428] relative overflow-hidden border-b border-slate-800 flex flex-col group p-4 min-h-[200px]">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1518605368461-1e1e1a8a29a6?q=80')] bg-cover opacity-10 blur-md pointer-events-none z-0"></div>
            
            <StreamVideo client={client}>
                <StreamCall call={call}>
                    <div className="relative z-10 w-full flex flex-col gap-4">
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
                                {role === 'admin' ? 'Host Mode' : role === 'guest' ? 'VIP Guest' : 'Listener'}
                            </span>
                        </div>
                        
                        <div className="min-h-[80px] bg-black/40 rounded-xl p-2 border border-white/5 flex items-center justify-center">
                            <SpeakerLayout />
                        </div>

                        <InteractiveAudioUI role={role} matchId={matchId} />
                    </div>
                </StreamCall>
            </StreamVideo>
        </div>
    );
}