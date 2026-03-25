'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { StreamVideo, StreamCall, useCallStateHooks, StreamTheme, hasAudio } from '@stream-io/video-react-sdk';
import '@stream-io/video-react-sdk/dist/css/styles.css';
import { Loader2, Radio, Hand, Mic, MicOff, CheckCircle, XCircle, Link as LinkIcon, Play, Square, LogOut, Users, Circle, Activity, Tv } from 'lucide-react';
import { useGlobalMedia } from '@/app/providers/GlobalMediaProvider';

const PremiumListenerUI = ({ role }: { role: string }) => {
    const { call, stopMedia } = useGlobalMedia();
    const { useParticipants } = useCallStateHooks();
    const participants = useParticipants();
    
    const isSpeaking = participants.some(p => p.isSpeaking);
    const [handRaised, setHandRaised] = useState(false);
    const [eqLevels, setEqLevels] = useState<number[]>([20, 20, 20, 20, 20, 20, 20]);

    useEffect(() => {
        if (!isSpeaking) { setEqLevels([10, 10, 10, 10, 10, 10, 10]); return; }
        const interval = setInterval(() => {
            if (document.hidden) return; 
            setEqLevels(Array.from({length: 7}, () => Math.floor(Math.random() * 70) + 20));
        }, 150);
        return () => clearInterval(interval);
    }, [isSpeaking]);

    if (!call) return null;

    const raiseHand = async () => { await call.requestPermissions({ permissions: ['send-audio'] }); setHandRaised(true); };

    return (
        <div className="flex flex-col items-center w-full gap-6 relative z-30 animate-in fade-in zoom-in-95">
            <div className="w-full max-w-sm bg-gradient-to-b from-slate-900 to-black border border-slate-800 rounded-3xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.8)] relative overflow-hidden">
                <div className="absolute -top-10 -left-10 w-40 h-40 bg-blue-600/20 blur-[60px] rounded-full pointer-events-none"></div>
                <div className="relative z-10 flex flex-col items-center">
                    <div className="w-full flex justify-between items-center mb-6">
                        <div className="flex items-center gap-2">
                            <Radio className="text-blue-400" size={16} />
                            <span className="text-white font-black tracking-widest text-[10px] uppercase">FactSport Radio</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded shadow-sm">
                            <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_red]"></div>
                            <span className="text-red-500 text-[8px] font-black tracking-widest uppercase">Live</span>
                        </div>
                    </div>
                    
                    <div className="h-16 flex items-center justify-center gap-1.5 mb-8">
                        {eqLevels.map((level, i) => (
                            <div key={i} className="w-2.5 bg-blue-500 rounded-full transition-all duration-150 shadow-[0_0_10px_rgba(59,130,246,0.5)]" style={{ height: `${level}%` }}></div>
                        ))}
                    </div>
                    
                    <div className="flex items-center justify-center gap-6 w-full">
                        <div className="p-3 text-slate-600"><Activity size={20} /></div>
                        <button onClick={stopMedia} className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 hover:bg-red-900/80 hover:text-red-500 flex items-center justify-center text-slate-300 transition-all active:scale-95 shadow-lg group">
                            <Square size={20} fill="currentColor" className="group-hover:scale-90 transition-transform" />
                        </button>
                        <div className="p-3 text-slate-600"><Radio size={20} /></div>
                    </div>
                </div>
            </div>

            {role === 'anonymous' ? (
                <Link href="/login" className="flex items-center gap-2 px-8 py-3.5 rounded-full bg-[#1A1A1A] border border-slate-700 text-slate-300 hover:bg-slate-800 shadow-xl transition-all active:scale-95 mt-2">
                    <Mic size={16} /> <span className="text-xs font-black uppercase tracking-widest">Login to Call In</span>
                </Link>
            ) : (
                <button onClick={raiseHand} disabled={handRaised} className={`flex items-center gap-2 px-8 py-3.5 rounded-full shadow-xl transition-all active:scale-95 mt-2 ${handRaised ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' : 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-600'}`}>
                    <Hand size={18} className={handRaised ? "animate-bounce" : ""} />
                    <span className="text-xs font-black uppercase tracking-widest">{handRaised ? 'Hand Raised (Waiting...)' : 'Raise Hand to Call In'}</span>
                </button>
            )}
        </div>
    );
};

const CustomAudioLayout = () => {
    const { useParticipants } = useCallStateHooks();
    const participants = useParticipants();
    return (
        <div className="flex flex-wrap items-center justify-center gap-6 py-6 w-full relative z-20">
            {participants.map((p) => {
                const isMuted = !hasAudio(p); 
                return (
                    <div key={p.sessionId} className="flex flex-col items-center gap-3 animate-in fade-in zoom-in">
                        <div className={`relative w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center border-4 bg-slate-800 transition-all duration-300 ${p.isSpeaking ? 'border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.4)] scale-110' : 'border-slate-700'}`}>
                            {p.image ? <img src={p.image} alt={p.name} className="w-full h-full rounded-full object-cover" /> : <span className="text-2xl font-black text-white">{p.name?.charAt(0) || 'U'}</span>}
                            <div className="absolute -bottom-2 -right-2 bg-[#0a1428] p-1.5 rounded-full border border-slate-600 shadow-md">
                                {isMuted ? <MicOff size={12} className="text-red-500" /> : <Mic size={12} className="text-green-400" />}
                            </div>
                        </div>
                        <span className="text-[11px] text-white font-bold w-24 text-center truncate drop-shadow-md">{p.name || p.userId}</span>
                        {p.roles.includes('admin') && <span className="text-[8px] bg-blue-600 px-1.5 py-0.5 rounded text-white font-black uppercase tracking-widest -mt-2">Host</span>}
                    </div>
                );
            })}
        </div>
    );
};

const StudioUI = ({ role, matchId }: { role: string, matchId: string }) => {
    const { call, stopMedia } = useGlobalMedia();
    const { useIsCallLive, useMicrophoneState, useParticipants, useIsCallRecordingInProgress } = useCallStateHooks(); 
    
    const isLive = useIsCallLive();
    const isRecording = useIsCallRecordingInProgress();
    const { microphone, isMute } = useMicrophoneState();
    const participants = useParticipants();
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [showManager, setShowManager] = useState(false);

    useEffect(() => {
        let wakeLock: any = null;
        const requestWakeLock = async () => { if (role === 'admin' && isLive && 'wakeLock' in navigator) { try { wakeLock = await (navigator as any).wakeLock.request('screen'); } catch (err) {} } };
        requestWakeLock();
        return () => { if (wakeLock) wakeLock.release().catch(() => {}); };
    }, [isLive, role]);

    if (!call) return null;

    const toggleMic = async () => { if (isMute) await microphone.enable(); else await microphone.disable(); };
    const toggleRecording = async () => { if (isRecording) await call.stopRecording(); else await call.startRecording(); };

    const generateVIPLink = async () => {
        setIsGenerating(true);
        try {
            const res = await fetch('/api/stream/token', { method: 'POST', body: JSON.stringify({ matchId }) });
            const data = await res.json();
            await navigator.clipboard.writeText(data.inviteLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 3000);
        } catch (error) {} 
        finally { setIsGenerating(false); }
    };

    return (
        <div className="flex flex-col items-center w-full gap-6 mt-4 relative z-30">
            {role === 'admin' && (
                <div className="w-full flex flex-col items-center gap-4">
                    {!isLive ? (
                        <button onClick={() => call.goLive()} className="flex items-center gap-2 px-10 py-3.5 rounded-full bg-green-600 hover:bg-green-500 text-white font-black tracking-widest uppercase shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-all animate-pulse active:scale-95 w-full max-w-sm justify-center">
                            <Play size={18} fill="currentColor" /> Go Live Now
                        </button>
                    ) : (
                        <button onClick={() => call.stopLive()} className="flex items-center gap-2 px-8 py-2.5 rounded-full bg-red-900/80 hover:bg-red-600 border border-red-500 text-white font-bold tracking-widest uppercase transition-all shadow-lg active:scale-95 w-full max-w-sm justify-center">
                            <Square size={14} fill="currentColor" /> End Broadcast
                        </button>
                    )}

                    <div className="flex flex-wrap items-center justify-center gap-3 bg-slate-900/90 p-2.5 rounded-full border border-slate-700 shadow-xl w-full max-w-sm">
                        <button onClick={toggleMic} className={`p-4 rounded-full transition-all flex-1 flex justify-center ${isMute ? 'bg-red-500/20 text-red-500' : 'bg-slate-700 text-white hover:bg-slate-600 shadow-md'}`}>{isMute ? <MicOff size={20} /> : <Mic size={20} />}</button>
                        <button onClick={toggleRecording} className={`p-4 rounded-full transition-all flex-1 flex justify-center ${isRecording ? 'bg-red-600 text-white animate-pulse shadow-[0_0_15px_red]' : 'bg-slate-700 text-white hover:bg-slate-600 shadow-md'}`}><Circle size={20} fill={isRecording ? "white" : "none"} /></button>
                        <button onClick={() => setShowManager(!showManager)} className={`p-4 rounded-full transition-all flex-1 flex justify-center ${showManager ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]' : 'bg-slate-700 text-white hover:bg-slate-600 shadow-md'}`}><Users size={20} /></button>
                        <button onClick={stopMedia} className="p-4 rounded-full bg-slate-700 text-red-400 hover:bg-red-900/80 transition-all shadow-md flex-1 flex justify-center"><LogOut size={20} /></button>
                    </div>

                    {showManager && (
                        <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-xl p-4 flex flex-col gap-3 shadow-2xl animate-in slide-in-from-top-4">
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
                                            {p.roles.includes('admin') ? <span className="text-[9px] text-blue-500 uppercase font-black">Co-Host</span> : hasAudio(p) ? (
                                                <button onClick={() => call.revokePermissions(p.userId, ['send-audio'])} className="text-[9px] font-black px-3 py-1.5 bg-red-900/60 text-red-400 rounded-md hover:bg-red-600 hover:text-white transition">Mute Call</button>
                                            ) : (
                                                <button onClick={() => call.grantPermissions(p.userId, ['send-audio'])} className="text-[9px] font-black px-3 py-1.5 bg-green-900/60 text-green-400 rounded-md hover:bg-green-600 hover:text-white transition">Allow Mic</button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {(role === 'guest' || role === 'user') && (
                <div className="flex flex-col items-center gap-4">
                    {role === 'guest' && <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest bg-purple-900/30 px-4 py-1.5 rounded-full border border-purple-500/30 shadow-md">VIP Studio Guest</span>}
                    {role === 'user' && <span className="text-[10px] font-black text-white uppercase tracking-widest bg-red-600 px-4 py-1.5 rounded-full shadow-[0_0_15px_red] animate-pulse">Live on Air</span>}
                    
                    <div className="flex items-center gap-4 bg-slate-900/90 p-2.5 rounded-full border border-slate-700 shadow-xl">
                        <button onClick={toggleMic} className={`p-4 rounded-full transition-all ${isMute ? 'bg-red-500/20 text-red-500' : 'bg-green-600 text-white shadow-md'}`}>{isMute ? <MicOff size={20} /> : <Mic size={20} />}</button>
                        <button onClick={() => role === 'guest' ? stopMedia() : call.revokePermissions(call.currentUserId!, ['send-audio'])} className="p-4 rounded-full bg-slate-700 text-red-400 hover:bg-slate-600 shadow-md">
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default function FactSportMediaRoom({ matchId, mediaUrl = 'streamio', title = 'FactSport Broadcast' }: { matchId: string, mediaUrl?: string, title?: string }) {
    const { activeMatchId, mediaType, videoUrl, client, call, role, isConnecting, isWaitingForHost, setIsPageActive, tuneInAudio, tuneInVideo } = useGlobalMedia();
    const [canSpeak, setCanSpeak] = useState(false);

    const isVideo = mediaUrl !== 'streamio';
    let embedUrl = mediaUrl;
    if (isVideo && mediaUrl.includes('youtube.com/watch?v=')) embedUrl = mediaUrl.replace('watch?v=', 'embed/');
    if (isVideo && mediaUrl.includes('youtu.be/')) embedUrl = `https://www.youtube.com/embed/${mediaUrl.split('youtu.be/')[1]}`;

    useEffect(() => {
        setIsPageActive(true);
        return () => setIsPageActive(false);
    }, [setIsPageActive]);

    useEffect(() => {
        if (!call || role !== 'user') return;
        const checkPerms = () => setCanSpeak(call.permissionsContext.hasPermission('send-audio'));
        checkPerms();
        const sub = call.on('call.permissions_updated', checkPerms);
        return () => sub();
    }, [call, role]);

    if (activeMatchId !== matchId) {
        return (
            <div className="w-full min-h-[300px] bg-gradient-to-b from-[#0a1428] to-black relative overflow-hidden flex flex-col items-center justify-center p-6 border border-slate-800 rounded-2xl shadow-xl">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1518605368461-1e1e1a8a29a6?q=80')] bg-cover opacity-10 blur-sm mix-blend-overlay"></div>
                <div className="relative z-10 flex flex-col items-center gap-5 text-center">
                    <div className="w-20 h-20 bg-blue-600/20 rounded-full flex items-center justify-center border border-blue-500/50 shadow-[0_0_40px_rgba(37,99,235,0.4)] relative">
                        <div className="absolute inset-0 border-2 border-blue-400 rounded-full animate-ping opacity-20"></div>
                        {isVideo ? <Tv size={36} className="text-blue-400" /> : <Radio size={36} className="text-blue-400" />}
                    </div>
                    <div>
                        <h3 className="text-white font-black text-xl uppercase tracking-widest drop-shadow-lg">{title}</h3>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1.5">Live Broadcast</p>
                    </div>
                    <button onClick={() => isVideo ? tuneInVideo(matchId, embedUrl) : tuneInAudio(matchId)} disabled={isConnecting} className="mt-2 flex items-center gap-3 px-10 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black tracking-widest uppercase rounded-full shadow-[0_10px_30px_rgba(37,99,235,0.4)] transition-all active:scale-95 disabled:opacity-50">
                        {isConnecting ? <Loader2 className="animate-spin" size={18} /> : <Play fill="currentColor" size={18} />} 
                        {isConnecting ? 'Connecting...' : (isVideo ? 'Watch Live TV' : 'Tune In Live')}
                    </button>
                </div>
            </div>
        );
    }

    if (mediaType === 'video' && videoUrl) {
        return (
            <div className="w-full aspect-video bg-black relative overflow-hidden rounded-2xl shadow-2xl border border-slate-800 group">
                <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-[#0a1428] via-[#0a1428]/80 to-transparent z-10 pointer-events-none"></div>
                <div className="absolute top-4 left-4 z-20 pointer-events-none flex items-center gap-2">
                    <span className="bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded shadow-lg uppercase tracking-widest flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span> LIVE</span>
                    <span className="bg-black/80 backdrop-blur-md text-white text-[10px] font-black px-2 py-1 rounded border border-white/10 shadow-lg uppercase tracking-widest flex items-center gap-1.5"><Tv size={12} className="text-blue-400"/> FactSport TV</span>
                </div>
                <iframe src={`${videoUrl}?autoplay=1&mute=0`} className="w-full h-full relative z-0" allowFullScreen allow="autoplay; encrypted-media"></iframe>
            </div>
        );
    }

    if (isWaitingForHost || !client || !call) {
        return (
            <div className="w-full min-h-[250px] bg-gradient-to-b from-[#0a1428] to-black relative overflow-hidden flex flex-col items-center justify-center p-6 border border-slate-800 rounded-2xl shadow-xl">
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

    // 🟢 DECLARED `inStudio` VARIABLE RIGHT BEFORE RETURN
    const inStudio = role === 'admin' || role === 'guest' || (role === 'user' && canSpeak);

    return (
        <div className="w-full bg-gradient-to-b from-[#0a1428] to-black relative overflow-hidden border border-slate-800 flex flex-col group p-6 min-h-[350px] rounded-2xl shadow-2xl">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1518605368461-1e1e1a8a29a6?q=80')] bg-cover opacity-10 blur-md mix-blend-overlay pointer-events-none z-0"></div>
            
            <StreamTheme className="stream-theme-custom w-full">
                <StreamVideo client={client}>
                    <StreamCall call={call}>
                        
                        {inStudio ? (
                            <div className="relative z-30 w-full flex flex-col gap-2">
                                <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center border border-blue-500/30"><Radio className="text-blue-400" size={16} /></div>
                                        <span className="text-white text-xs md:text-sm font-black tracking-widest uppercase shadow-md">FactSport Studio</span>
                                    </div>
                                    <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded shadow-md bg-blue-600/20 text-blue-400 border border-blue-500/20">On Stage</span>
                                </div>
                                
                                <div className="min-h-[140px] bg-black/40 rounded-3xl p-6 border border-white/5 flex flex-col items-center justify-center relative z-20 shadow-inner">
                                    <CustomAudioLayout />
                                </div>

                                <StudioUI role={role} matchId={matchId} />
                            </div>
                        ) : (
                            <PremiumListenerUI role={role} />
                        )}

                    </StreamCall>
                </StreamVideo>
            </StreamTheme>
        </div>
    );
}