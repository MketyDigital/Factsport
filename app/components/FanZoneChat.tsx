'use client';
import { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, ShieldAlert, Zap, Reply, X, ArrowDown } from 'lucide-react';
import Link from 'next/link';

export default function FanZoneChat({ matchId, espnId, user }: { matchId: string, espnId?: string, user: any }) {
    const [messages, setMessages] = useState<any[]>([]);
    const [officialEvents, setOfficialEvents] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    
    // 🟢 Reply & Scroll States
    const [replyTo, setReplyTo] = useState<{user: string, text: string} | null>(null);
    const [showScrollBottom, setShowScrollBottom] = useState(false);
    
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const CHAT_WORKER_URL = "https://chatworkerjs.mkpoikankes.workers.dev"; 

    const handleScroll = () => {
        if (scrollContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
            setShowScrollBottom(scrollHeight - scrollTop - clientHeight > 150);
        }
    };

    const scrollToBottom = (force = false) => {
        if (scrollContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
            if (force || isNearBottom) {
                scrollContainerRef.current.scrollTo({ top: scrollHeight, behavior: 'smooth' });
            }
        }
    };

    useEffect(() => {
        const fetchChat = async () => {
            try {
                const res = await fetch(`${CHAT_WORKER_URL}/messages?match_id=${matchId}&t=${Date.now()}`);
                if (res.ok) {
                    const data = await res.json();
                    setMessages(data.messages || []);
                    setTimeout(() => scrollToBottom(false), 100);
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
                    setTimeout(() => scrollToBottom(false), 100);
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
        
        let finalMessageStr = newMessage;
        if (replyTo) {
            const safeQuote = replyTo.text.replace(/\[Reply @.*?\]/g, '').substring(0, 40); 
            finalMessageStr = `[Reply @${replyTo.user}: "${safeQuote}..."] ${newMessage}`;
        }

        const tempMsg = {
            id: 'temp-' + Date.now(),
            username: user.user_metadata?.username || 'FactSport Fan',
            avatar_url: user.user_metadata?.avatar_url,
            message: finalMessageStr,
            created_at: new Date().toISOString()
        };

        setMessages(prev => [...prev, tempMsg]);
        setNewMessage("");
        setReplyTo(null); 
        setTimeout(() => scrollToBottom(true), 50);

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

    const latestEvent = officialEvents.length > 0 ? officialEvents[0] : null;

    // 🟢 NEW: Fixed TypeScript Regex Issue. Using [\s\S] instead of the /s flag
    const renderMessageContent = (text: string) => {
        const quoteMatch = text.match(/^\[Reply @([^:]*?): "([\s\S]*?)"\] ([\s\S]*)$/);
        if (quoteMatch) {
            return (
                <div className="flex flex-col gap-1">
                    <div className="bg-slate-100 border-l-2 border-blue-400 pl-2 py-1 pr-2 rounded text-[9px] md:text-[10px] text-slate-500 italic flex flex-col">
                        <span className="font-bold text-blue-600">@{quoteMatch[1]}</span>
                        <span className="line-clamp-1">{quoteMatch[2]}</span>
                    </div>
                    <span>{quoteMatch[3]}</span>
                </div>
            );
        }
        return text;
    };

    return (
        <div className="w-full bg-white flex flex-col h-[65vh] min-h-[450px] border-t border-slate-200 relative">
            
            {latestEvent && (
                <div className="bg-slate-900 text-white px-3 py-2 flex items-center justify-between border-b border-slate-800 shrink-0 shadow-md relative z-20">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <span className="bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow">{latestEvent.time}</span>
                        <span className="text-[10px] md:text-xs font-bold truncate tracking-wide text-slate-100">
                            {latestEvent.text} {latestEvent.player && <span className="text-yellow-400 font-black ml-1">- {latestEvent.player}</span>}
                        </span>
                    </div>
                    <Zap size={12} className={latestEvent.type === 'goal' ? 'text-yellow-400 fill-yellow-400 shrink-0' : 'text-slate-500 shrink-0'} />
                </div>
            )}

            <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-3 md:p-4 space-y-4 bg-[#F0F2F5] scrollbar-hide scroll-smooth relative">
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
                                <div key={msg.id} className="flex justify-end w-full pl-8 my-2 group">
                                    <button onClick={() => setReplyTo({user: 'System', text: `${msg.time} ${msg.text}`})} className="mr-2 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-500 transition active:scale-95 self-center">
                                        <Reply size={14} />
                                    </button>
                                    <div className={`px-3 py-2 md:px-4 rounded-l-xl rounded-tr-xl shadow-md border text-[9px] md:text-[10px] font-black uppercase tracking-wider flex flex-col items-end gap-1 max-w-[90%] text-right leading-tight ${isGoal ? 'bg-green-600 text-white border-green-500 shadow-[0_4px_15px_rgba(34,197,94,0.3)]' : 'bg-[#0a1428] text-slate-200 border-slate-800'}`}>
                                        <div className="flex items-center gap-1.5 opacity-80 mb-0.5">
                                             <span className="text-[8px] md:text-[9px]">{msg.time}</span>
                                             <Zap size={10} className={isGoal ? 'text-yellow-300 fill-yellow-300' : 'text-blue-400'} />
                                        </div>
                                        <span>{msg.text}</span>
                                        {msg.player && <span className="text-yellow-400 border-t border-white/10 pt-1 mt-0.5 w-full">{msg.player}</span>}
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div key={msg.id} className="flex gap-2 animate-in fade-in slide-in-from-bottom-1 pr-8 group">
                                {msg.avatar_url ? (
                                    <img src={msg.avatar_url} className="w-6 h-6 md:w-8 md:h-8 rounded-full object-cover border border-slate-200 shrink-0" alt="" />
                                ) : (
                                    <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0 shadow-sm">
                                        <span className="text-white font-black text-[9px] md:text-[10px]">{msg.username.charAt(0).toUpperCase()}</span>
                                    </div>
                                )}
                                <div className="max-w-full flex flex-col items-start">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-[9px] md:text-[10px] font-black text-slate-800 truncate">{msg.username}</span>
                                        <button onClick={() => setReplyTo({user: msg.username, text: msg.message})} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-500 transition active:scale-95">
                                            <Reply size={12} />
                                        </button>
                                    </div>
                                    <div className="text-[11px] md:text-xs font-medium text-slate-700 leading-relaxed bg-white px-3 py-2 rounded-2xl rounded-tl-sm border border-slate-200 shadow-sm break-words">
                                        {renderMessageContent(msg.message)}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {showScrollBottom && (
                <button onClick={() => scrollToBottom(true)} className="absolute bottom-[70px] right-4 bg-blue-600 text-white p-2 rounded-full shadow-[0_4px_15px_rgba(0,0,0,0.3)] animate-bounce active:scale-95 flex items-center justify-center z-40">
                    <ArrowDown size={16} />
                </button>
            )}

            <div className="bg-white border-t border-slate-200 shadow-[0_-5px_15px_rgba(0,0,0,0.02)] z-10 shrink-0 flex flex-col">
                {replyTo && (
                    <div className="bg-slate-50 border-b border-slate-200 px-3 py-1.5 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                            <Reply size={12} className="text-blue-500 shrink-0"/>
                            <span className="text-[10px] text-slate-500 truncate">Replying to <span className="font-bold text-slate-700">@{replyTo.user}</span></span>
                        </div>
                        <button onClick={() => setReplyTo(null)} className="text-slate-400 hover:text-red-500 p-1"><X size={14}/></button>
                    </div>
                )}
                
                <div className="p-2 md:p-3">
                    {user ? (
                        <form onSubmit={handleSendMessage} className="relative flex items-center">
                            <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Have your say..." className="w-full bg-[#F0F2F5] border border-slate-200 rounded-full pl-4 pr-12 py-2 md:py-2.5 text-[11px] md:text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition shadow-inner" maxLength={200} />
                            <button type="submit" disabled={!newMessage.trim() || isSending} className="absolute right-1 p-1.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 transition shadow-md"><Send size={14} /></button>
                        </form>
                    ) : (
                        <div className="flex items-center justify-between bg-[#F0F2F5] rounded-full p-1 pl-4 shadow-inner border border-slate-200">
                            <div className="flex items-center gap-1.5 text-slate-500"><ShieldAlert size={12} /><span className="text-[9px] font-bold uppercase tracking-widest">Login to chat</span></div>
                            <Link href="/login" className="bg-[#0a1428] text-white px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-md hover:bg-slate-800 transition active:scale-95">Sign In</Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}