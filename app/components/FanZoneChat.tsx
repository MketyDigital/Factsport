'use client';
import { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, ShieldAlert, Zap, RadioTower } from 'lucide-react';
import Link from 'next/link';

export default function FanZoneChat({ matchId, espnId, user }: { matchId: string, espnId?: string, user: any }) {
    const [messages, setMessages] = useState<any[]>([]);
    const [officialEvents, setOfficialEvents] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const CHAT_WORKER_URL = "https://chatworkerjs.mkpoikankes.workers.dev"; 

    const scrollToBottom = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({
                top: scrollContainerRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    };

    useEffect(() => {
        const fetchChat = async () => {
            try {
                const res = await fetch(`${CHAT_WORKER_URL}/messages?match_id=${matchId}&t=${Date.now()}`);
                if (res.ok) {
                    const data = await res.json();
                    setMessages(data.messages || []);
                    setTimeout(scrollToBottom, 100);
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
                    setTimeout(scrollToBottom, 100);
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
        setTimeout(scrollToBottom, 50);

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

    return (
        <div className="w-full bg-white flex flex-col h-[55vh] min-h-[400px] border-t border-slate-200">
            <div className="bg-gradient-to-r from-yellow-500/10 to-amber-500/5 border-b border-yellow-500/20 px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex items-center gap-1.5 shrink-0">
                    <RadioTower className="w-3.5 h-3.5 text-yellow-600 animate-pulse" />
                    <span className="bg-yellow-500 text-black text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm">Studio</span>
                </div>
                <p className="text-[10px] md:text-xs font-semibold text-slate-700 leading-snug">
                    Want to jump on as a guest broadcaster? <a href="#" className="text-blue-600 font-bold underline decoration-blue-300 underline-offset-2">Click here to request mic access.</a>
                </p>
            </div>

            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 bg-[#F0F2F5] scrollbar-hide scroll-smooth">
                {combinedFeed.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-40">
                        <MessageCircle size={32} className="mb-2 text-slate-400" />
                        <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest">Chat loading...</p>
                    </div>
                ) : (
                    combinedFeed.map((msg) => {
                        if (msg.isOfficial) {
                            const isGoal = msg.type === 'goal';
                            return (
                                <div key={msg.id} className="flex justify-center my-3">
                                    <div className={`px-3 py-1.5 md:px-4 md:py-2 rounded-full shadow-sm border text-[9px] md:text-[10px] font-black uppercase tracking-widest flex items-center gap-2 max-w-[95%] text-center leading-tight ${isGoal ? 'bg-green-500 text-white border-green-600 shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'bg-slate-800 text-white border-slate-700'}`}>
                                        <Zap size={12} className={`shrink-0 ${isGoal ? 'text-yellow-300 fill-yellow-300' : 'text-blue-400'}`} />
                                        <span className="truncate">{msg.time} - {msg.text} {msg.player && <span className="opacity-80 border-l border-white/20 pl-1.5 ml-1 inline-block">{msg.player}</span>}</span>
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div key={msg.id} className="flex gap-2 animate-in fade-in slide-in-from-bottom-1">
                                {msg.avatar_url ? (
                                    <img src={msg.avatar_url} className="w-6 h-6 md:w-8 md:h-8 rounded-full object-cover border border-slate-200 shrink-0" alt="" />
                                ) : (
                                    <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0 shadow-sm">
                                        <span className="text-white font-black text-[9px] md:text-[10px]">{msg.username.charAt(0).toUpperCase()}</span>
                                    </div>
                                )}
                                <div className="max-w-[85%]">
                                    <div className="flex items-baseline gap-1.5 mb-0.5">
                                        <span className="text-[9px] md:text-[10px] font-black text-slate-800 truncate">{msg.username}</span>
                                    </div>
                                    <p className="text-[11px] md:text-xs font-medium text-slate-700 leading-relaxed bg-white px-3 py-2 rounded-2xl rounded-tl-sm border border-slate-200 shadow-sm inline-block break-words">
                                        {msg.message}
                                    </p>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <div className="p-2 md:p-3 bg-white border-t border-slate-200 shadow-[0_-5px_15px_rgba(0,0,0,0.02)] z-10 shrink-0">
                {user ? (
                    <form onSubmit={handleSendMessage} className="relative flex items-center">
                        <input 
                            type="text" 
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Have your say..." 
                            className="w-full bg-[#F0F2F5] border border-slate-200 rounded-full pl-4 pr-12 py-2 md:py-2.5 text-[11px] md:text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition shadow-inner"
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
                            <span className="text-[9px] font-bold uppercase tracking-widest">Login to chat</span>
                        </div>
                        <Link href="/login" className="bg-[#0a1428] text-white px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-md hover:bg-slate-800 transition active:scale-95">
                            Sign In
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}