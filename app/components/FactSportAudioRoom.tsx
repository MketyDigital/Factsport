'use client';
import { useEffect, useState } from 'react';
import { StreamVideo, StreamVideoClient, StreamCall, SpeakerLayout } from '@stream-io/video-react-sdk';
import '@stream-io/video-react-sdk/dist/css/styles.css';
import { Loader2, Radio } from 'lucide-react';

export default function FactSportAudioRoom({ matchId }: { matchId: string }) {
    const [client, setClient] = useState<StreamVideoClient | null>(null);
    const [call, setCall] = useState<StreamCall | null>(null);

    useEffect(() => {
        const initAudioRoom = async () => {
            const res = await fetch('/api/stream/token');
            if (!res.ok) return; // User must be logged in to connect
            
            const { token, userId, username, image } = await res.json();

            const myClient = new StreamVideoClient({
                apiKey: process.env.NEXT_PUBLIC_STREAM_API_KEY!,
                user: { id: userId, name: username, image },
                token,
            });

            const myCall = myClient.call('audio_room', matchId);
            await myCall.join();

            setClient(myClient);
            setCall(myCall);
        };

        initAudioRoom();

        return () => {
            call?.leave();
            client?.disconnectUser();
        };
    }, [matchId]);

    if (!client || !call) {
        return (
            <div className="w-full h-[120px] bg-[#0a1428] flex flex-col items-center justify-center border-b border-slate-800">
                <Loader2 className="animate-spin text-blue-500 mb-2" size={24} />
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Tuning in...</span>
            </div>
        );
    }

    return (
        <div className="w-full h-[120px] bg-[#0a1428] relative overflow-hidden border-b border-slate-800 flex items-center justify-center group">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1518605368461-1e1e1a8a29a6?q=80')] bg-cover opacity-20 blur-sm pointer-events-none"></div>
            
            <StreamVideo client={client}>
                <StreamCall call={call}>
                    <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
                        <Radio className="text-red-500 w-10 h-10 animate-pulse drop-shadow-[0_0_15px_rgba(239,68,68,0.5)] mb-2" />
                        <span className="text-white text-[10px] font-black tracking-widest uppercase bg-black/60 px-3 py-1 rounded-full border border-white/10 shadow-md flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span> Live Radio Room
                        </span>
                        
                        {/* Hidden UI element that processes the WebRTC audio */}
                        <div className="opacity-0 pointer-events-none absolute">
                            <SpeakerLayout />
                        </div>
                    </div>
                </StreamCall>
            </StreamVideo>
        </div>
    );
}