'use client';
import { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, ShieldAlert, Zap } from 'lucide-react';
import Link from 'next/link';

export default function FanZoneChat({ matchId, espnId, user }: { matchId: string, espnId?: string, user: any }) {
    const [messages, setMessages] = useState<any[]>([]);
    const [officialEvents, setOfficialEvents] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    
    // REPLACE WITH YOUR CLOUDFLARE D1 URL
    const CHAT_WORKER_URL = "https://chatworkerjs.mkpoikankes.workers.dev"; 

    useEffect(() => {
        const fetchChat = async () => {
            try {
                const res = await fetch(`${CHAT_WORKER_URL}/messages?match_id=${matchId}&t=${Date.now()}`);
                if (res.ok) {
                    const data = await res.json();
                    setMessages(data.messages || []);
                }
            } catch (e) {}
        };
        fetchChat();
        const interval = setInterval(fetchChat, 3000);
        return () => clearInterval(interval);
    }, [matchId]);

    useEffect(() => {
        if (!espnId) return;
        const fetchEvents = async () => {
            try {
                const res = await fetch(`https://fse.mkpoikankes.workers.dev/?espn_id=${espnId}&t=${Date.now()}`);
                if (res.ok) {
                    const data = await res.json();
                    const formattedEvents = (data.match_events || []).map((e: any, index: number) => ({
                        id: `official-${index}-${e.time}`,
                        isOfficial: true,
                        time: e.time,
                        type: e.type,
                        text: e.text,
                        player: e.player,
                        created_at: new Date(Date.now() - (index * 60000)).toISOString() 
                    }));
                    setOfficialEvents(formattedEvents.reverse());
                }
            } catch (e) {}
        };
        fetchEvents();
        const interval = setInterval(fetchEvents, 5000);
        return () => clearInterval(interval);
    }, [espnId]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !user || isSending) return;

        setIsSending(true);
        const tempMsg = {
            id: 'temp-' + Date.now(),
            username: user.user_metadata?.username || 'FactSport Fan',
            avatar_url: user.user_metadata?.avatar_url,
            message: newMessage,
            created_at: new Date().toISOString()
        };

        setMessages(prev => [...prev, tempMsg]);
        setNewMessage("");
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });

        try {
            await fetch(`${CHAT_WORKER_URL}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    match_id: matchId,
                    user_id: user.id,
                    username: tempMsg.username,
                    avatar_url: tempMsg.avatar_url,
                    message: tempMsg.message
                })
            });
        } catch (e) {}
        
        setIsSending(false);
    };

    const combinedFeed = [...messages, ...officialEvents].sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [combinedFeed.length]);

    return (
        <div className="w-full bg-white flex flex-col h-[50vh] min-h-[400px] border-t border-slate-200 shadow-inner">
            <div className="bg-yellow-500/10 border-b border-yellow-500/30 px-3 py-2 flex items-start gap-2">
                <span className="bg-yellow-500 text-black text-[8px] font-black uppercase px-1.5 py-0.5 rounded mt-0.5 shadow-sm">Pinned</span>
                <p className="text-[10px] md:text-xs font-bold text-slate-700 leading-tight">
                    🎙️ <span className="text-black font-black">STUDIO:</span> Respect all fans in the chat. Want to broadcast with us? DM Admin on X.
                </p>
            </div>

            <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 bg-[#F0F2F5] scrollbar-hide">
                {combinedFeed.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-40">
                        <MessageCircle size={32} className="mb-2 text-slate-400" />
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Chat loading...</p>
                    </div>
                ) : (
                    combinedFeed.map((msg) => {
                        if (msg.isOfficial) {
                            const isGoal = msg.type === 'goal';
                            return (
                                <div key={msg.id} className="flex justify-center my-2">
                                    <div className={`px-4 py-1.5 rounded-full shadow-sm border text-[10px] md:text-xs font-black uppercase tracking-wide flex items-center gap-2 max-w-[90%] ${isGoal ? 'bg-green-500 text-white border-green-600 shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 'bg-slate-800 text-white border-slate-700'}`}>
                                        <Zap size={12} className={isGoal ? 'text-yellow-300 fill-yellow-300' : 'text-blue-400'} />
                                        <span>{msg.time} - {msg.text}</span>
                                        {msg.player && <span className="opacity-80 border-l border-white/20 pl-2 ml-1 truncate">{msg.player}</span>}
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div key={msg.id} className="flex gap-2.5 animate-in fade-in slide-in-from-bottom-1">
                                {msg.avatar_url ? (
                                    <img src={msg.avatar_url} className="w-6 h-6 md:w-8 md:h-8 rounded-full object-cover border border-slate-200 shrink-0" alt="" />
                                ) : (
                                    <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0 shadow-sm">
                                        <span className="text-white font-black text-[9px] md:text-[10px]">{msg.username.charAt(0).toUpperCase()}</span>
                                    </div>
                                )}
                                <div>
                                    <div className="flex items-baseline gap-1.5 mb-0.5">
                                        <span className="text-[10px] md:text-xs font-black text-slate-800">{msg.username}</span>
                                    </div>
                                    <p className="text-[11px] md:text-xs font-medium text-slate-700 leading-relaxed bg-white px-3 py-1.5 rounded-2xl rounded-tl-sm border border-slate-200 shadow-sm inline-block">
                                        {msg.message}
                                    </p>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={chatEndRef} />
            </div>

            <div className="p-2 md:p-3 bg-white border-t border-slate-200 shadow-[0_-5px_15px_rgba(0,0,0,0.05)] z-10">
                {user ? (
                    <form onSubmit={handleSendMessage} className="relative flex items-center">
                        <input 
                            type="text" 
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Have your say..." 
                            className="w-full bg-[#F0F2F5] border border-slate-200 rounded-full pl-4 pr-12 py-2 md:py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition shadow-inner"
                            maxLength={200}
                        />
                        <button 
                            type="submit" 
                            disabled={!newMessage.trim() || isSending}
                            className="absolute right-1 p-1.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 transition shadow-md"
                        >
                            <Send size={14} />
                        </button>
                    </form>
                ) : (
                    <div className="flex items-center justify-between bg-[#F0F2F5] rounded-full p-1 pl-4 shadow-inner border border-slate-200">
                        <div className="flex items-center gap-1.5 text-slate-500">
                            <ShieldAlert size={12} />
                            <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest">Login to chat</span>
                        </div>
                        <Link href="/login" className="bg-[#0a1428] text-white px-4 py-1.5 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-slate-800 transition active:scale-95">
                            Sign In
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}