'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Send, MessageCircle, ShieldAlert, Zap, Reply, X, ArrowDown, Pin, Settings, Megaphone } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/app/lib/supabase/client'; 
import { useAuth } from '@/app/components/AuthProvider'; 
import { useSmartInterval } from '@/app/hooks/useSmartInterval';
// 🟢 PULLS FROM THE SINGLE SOURCE OF TRUTH
import { useMatchLive } from '@/app/providers/MatchLiveProvider';

const ADMIN_EMAILS = [
    'mkposcosunday@gmail.com', 
    'factsportlive@gmail.com', 
    'fact@factsport.com'
];

export default function FanZoneChat({ matchId, espnId }: { matchId: string, espnId?: string }) {
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [replyTo, setReplyTo] = useState<{user: string, text: string} | null>(null);
    const [showScrollBottom, setShowScrollBottom] = useState(false);
    const { user, isAdmin, loading: authLoading } = useAuth();
    const [lastMsgTime, setLastMsgTime] = useState(0); 
    const [pinnedMessage, setPinnedMessage] = useState<{text: string, link: string | null} | null>(null);
    const [showPinUI, setShowPinUI] = useState(false);
    const [pinTextInput, setPinTextInput] = useState("");
    const [pinLinkInput, setPinLinkInput] = useState("");
    const [isAnnouncement, setIsAnnouncement] = useState(false); 

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const CHAT_WORKER_URL = "https://chat-api.factsport.com"; 

    // 🟢 ALL ESPN FETCHING IS GONE. It just listens to the context!
    const liveData = useMatchLive();
    
    // We memoize the formatting so it doesn't recalculate unless the events actually change
    const officialEvents = useMemo(() => {
        const rawEvents = liveData?.match_events || liveData?.events || [];
        return rawEvents.map((e: any, index: number) => ({
             id: `official-${index}-${e.time}`,
             isOfficial: true,
             time: e.time,
             type: e.type,
             text: e.text,
             player: e.player,
             created_at: new Date(Date.now() - (index * 60000)).toISOString() 
        }));
    }, [liveData?.match_events, liveData?.events]);

    // Keep the Pin Fetcher (From Supabase)
    const fetchPin = async () => {
        if (document.hidden) return; 
        try {
            const res = await fetch(`/api/match/pin?match_id=${matchId}`);
            if (res.ok) {
                const data = await res.json();
                if (data.chat_pin_text || data.chat_pin_link) {
                    setPinnedMessage({ text: data.chat_pin_text, link: data.chat_pin_link });
                } else {
                    setPinnedMessage(null);
                }
            }
        } catch (e) {}
    };
    useEffect(() => { fetchPin(); }, [matchId]);
    useSmartInterval(fetchPin, 10000); 

    // Keep the Chat Fetcher (From Chat Worker)
    const fetchChat = async () => {
        if (document.hidden) return; 
        try {
            const res = await fetch(`${CHAT_WORKER_URL}/messages?match_id=${matchId}`, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                setMessages(data.messages || []);
                setTimeout(() => scrollToBottom(false), 100);
            }
        } catch (e) {}
    };
    useEffect(() => { fetchChat(); }, [matchId]);
    useSmartInterval(fetchChat, 6000); 

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

    const handleSetPin = async () => {
        const supabase = createClient();
        await supabase.from('matches').update({
            chat_pin_text: pinTextInput,
            chat_pin_link: pinLinkInput || null
        }).eq('id', matchId);
        setPinnedMessage({ text: pinTextInput, link: pinLinkInput || null });
        setShowPinUI(false);
    };

    const handleClearPin = async () => {
        const supabase = createClient();
        await supabase.from('matches').update({
            chat_pin_text: null,
            chat_pin_link: null
        }).eq('id', matchId);
        setPinnedMessage(null);
        setPinTextInput("");
        setPinLinkInput("");
        setShowPinUI(false);
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        let messageText = newMessage.trim();
        if (!messageText || !user || isSending) return;

        if (!isAdmin) {
            const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/i;
            if (urlRegex.test(messageText)) {
                alert("Security Alert: Only admins are allowed to share links in the chat.");
                return;
            }
            if (Date.now() - lastMsgTime < 3000) {
                alert("You are sending messages too fast. Please wait a moment.");
                return;
            }
        }
        setLastMsgTime(Date.now());
        setIsSending(true);
        
        messageText = messageText.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        let finalMessageStr = messageText;
        
        if (isAdmin && isAnnouncement) {
            finalMessageStr = `[ADMIN_ALERT] ${messageText}`;
        } else if (replyTo) {
            const safeQuote = replyTo.text.replace(/\[Reply @.*?\]/g, '').replace(/\[ADMIN_ALERT\]/g, '').substring(0, 40); 
            finalMessageStr = `[Reply @${replyTo.user}: "${safeQuote}..."] ${messageText}`;
        }

        const tempMsg = {
            id: 'temp-' + Date.now(),
            username: user.user_metadata?.username || user.profileData?.username || 'FactSport Fan',
            avatar_url: user.user_metadata?.avatar_url || user.profileData?.avatar_url,
            message: finalMessageStr,
            created_at: new Date().toISOString()
        };

        setMessages(prev => [...prev, tempMsg]);
        setNewMessage("");
        setReplyTo(null); 
        setIsAnnouncement(false); 
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

    const combinedFeed = [...messages, ...officialEvents]
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .slice(-150);

    const getMinute = (timeStr: string) => {
        if (!timeStr) return 0;
        const parts = timeStr.replace("'", "").split('+');
        let total = parseInt(parts[0]) || 0;
        if (parts.length > 1) total += parseInt(parts[1]) || 0;
        return total;
    };

    const latestEvent = officialEvents.length > 0 
        ? [...officialEvents].sort((a, b) => getMinute(b.time) - getMinute(a.time))[0] 
        : null;

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
            
            {pinnedMessage && (
                <div className="bg-[#0a1428] px-3 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-blue-900 shrink-0 shadow-lg relative z-20 gap-3">
                    <div className="flex items-center gap-2 overflow-hidden w-full">
                        <span className="bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow shrink-0 flex items-center gap-1 animate-pulse">
                            <Pin size={10} fill="currentColor" /> PINNED
                        </span>
                        <span className="text-[10px] md:text-xs font-bold text-white pr-2 whitespace-normal break-words">
                            {pinnedMessage.text}
                        </span>
                    </div>
                    
                    {pinnedMessage.link && (
                        user ? (
                            <a href={pinnedMessage.link} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto text-center bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black px-4 py-2 rounded-lg shadow-[0_0_15px_rgba(37,99,235,0.4)] transition active:scale-95 shrink-0 uppercase tracking-widest border border-blue-500">
                                Click to Join
                            </a>
                        ) : (
                            <Link href="/login" className="w-full sm:w-auto text-center bg-slate-800 text-slate-300 border border-slate-600 text-[9px] font-black px-4 py-2 rounded-lg shadow-sm hover:text-white hover:bg-slate-700 transition active:scale-95 shrink-0 uppercase tracking-widest">
                                Login to Access
                            </Link>
                        )
                    )}
                </div>
            )}

            {latestEvent && (
                <div className="bg-slate-900 text-white px-3 py-2 flex items-center justify-between border-b border-slate-800 shrink-0 shadow-md relative z-20">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <span className="bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow shrink-0">{latestEvent.time}</span>
                        <span className="text-[10px] md:text-xs font-bold truncate tracking-wide text-slate-100">
                            {latestEvent.text} {latestEvent.player && <span className="text-yellow-400 font-black ml-1">- {latestEvent.player}</span>}
                        </span>
                    </div>
                    <Zap size={12} className={latestEvent.type === 'goal' ? 'text-yellow-400 fill-yellow-400 shrink-0' : 'text-slate-500 shrink-0'} />
                </div>
            )}

            {isAdmin && showPinUI && (
                <div className="bg-slate-50 border-b border-slate-200 p-3 shrink-0 shadow-inner z-20">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Manage Pinned Message</span>
                        <button onClick={() => setShowPinUI(false)} className="text-slate-400 hover:text-red-500"><X size={14}/></button>
                    </div>
                    <div className="space-y-2">
                        <input type="text" placeholder="Announcement text..." value={pinTextInput} onChange={(e)=>setPinTextInput(e.target.value)} className="w-full text-xs p-2 border border-slate-300 rounded focus:outline-none focus:border-blue-500" />
                        <input type="text" placeholder="Optional Link (e.g. StreamYard URL)..." value={pinLinkInput} onChange={(e)=>setPinLinkInput(e.target.value)} className="w-full text-xs p-2 border border-slate-300 rounded focus:outline-none focus:border-blue-500" />
                        <div className="flex gap-2 pt-1">
                            <button onClick={handleSetPin} className="flex-1 bg-blue-600 text-white text-[10px] font-black py-2 rounded uppercase tracking-widest active:scale-95">Pin Message</button>
                            <button onClick={handleClearPin} className="flex-1 bg-red-100 text-red-600 text-[10px] font-black py-2 rounded uppercase tracking-widest active:scale-95">Remove Pin</button>
                        </div>
                    </div>
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

                        const isAlert = msg.message.startsWith('[ADMIN_ALERT] ');
                        const displayMessage = isAlert ? msg.message.replace('[ADMIN_ALERT] ', '') : msg.message;

                        return (
                            <div key={msg.id} className={`flex gap-2 animate-in fade-in slide-in-from-bottom-1 pr-8 group ${isAlert ? 'my-3' : ''}`}>
                                {msg.avatar_url ? (
                                    <img src={msg.avatar_url} className="w-6 h-6 md:w-8 md:h-8 rounded-full object-cover border border-slate-200 shrink-0" alt="" />
                                ) : (
                                    <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${isAlert ? 'bg-red-600' : 'bg-gradient-to-br from-blue-500 to-blue-700'}`}>
                                        {isAlert ? <ShieldAlert size={12} className="text-white"/> : <span className="text-white font-black text-[9px] md:text-[10px]">{msg.username.charAt(0).toUpperCase()}</span>}
                                    </div>
                                )}
                                <div className="max-w-full flex flex-col items-start">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className={`text-[9px] md:text-[10px] font-black truncate ${isAlert ? 'text-red-600' : 'text-slate-800'}`}>
                                            {msg.username} {isAlert && '(Admin)'}
                                        </span>
                                        <button onClick={() => setReplyTo({user: msg.username, text: displayMessage})} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-500 transition active:scale-95">
                                            <Reply size={12} />
                                        </button>
                                    </div>
                                    
                                    <div className={`text-[11px] md:text-xs font-medium leading-relaxed px-3 py-2 rounded-2xl rounded-tl-sm border shadow-sm break-words ${
                                        isAlert 
                                        ? 'bg-red-50 text-red-900 border-red-200 shadow-[0_4px_15px_rgba(239,68,68,0.2)] font-bold' 
                                        : 'bg-white text-slate-700 border-slate-200'
                                    }`}>
                                        {renderMessageContent(displayMessage)}
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
                
                <div className="p-2 md:p-3 flex items-center gap-2">
                    {isAdmin && (
                        <div className="flex items-center bg-slate-100 rounded-full border border-slate-200 p-1 shrink-0">
                            <button onClick={() => setShowPinUI(!showPinUI)} className={`p-1.5 rounded-full transition ${showPinUI ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`} title="Manage Pinned Message">
                                <Settings size={14} />
                            </button>
                            <button onClick={() => setIsAnnouncement(!isAnnouncement)} className={`p-1.5 rounded-full transition ${isAnnouncement ? 'bg-red-500 text-white shadow-sm' : 'text-slate-500 hover:text-red-500'}`} title="Send as Official Announcement">
                                <Megaphone size={14} />
                            </button>
                        </div>
                    )}

                    <div className="flex-1">
                        {authLoading ? (
                             <div className="h-10 w-full bg-slate-100 rounded-full animate-pulse border border-slate-200"></div>
                        ) : user ? (
                            <form onSubmit={handleSendMessage} className="relative flex items-center">
                                <input 
                                    type="text" 
                                    value={newMessage} 
                                    onChange={(e) => setNewMessage(e.target.value)} 
                                    placeholder={isAnnouncement ? "Type official announcement..." : "Have your say..."} 
                                    className={`w-full border rounded-full pl-4 pr-12 py-2 md:py-2.5 text-[11px] md:text-xs font-medium focus:outline-none transition shadow-inner ${isAnnouncement ? 'bg-red-50 border-red-200 text-red-900 focus:ring-1 focus:ring-red-500 placeholder:text-red-300' : 'bg-[#F0F2F5] border-slate-200 text-slate-800 focus:ring-1 focus:ring-blue-500'}`} 
                                    maxLength={200} 
                                />
                                <button type="submit" disabled={!newMessage.trim() || isSending} className={`absolute right-1 p-1.5 text-white rounded-full disabled:opacity-50 transition shadow-md ${isAnnouncement ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                                    <Send size={14} />
                                </button>
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
        </div>
    );
}