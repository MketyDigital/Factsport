'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Send, MessageCircle, ShieldAlert, Zap, Reply, X, ArrowDown, Pin, Settings, Megaphone } from 'lucide-react';
import Link from 'next/link';


import { useSmartInterval } from '@/app/hooks/useSmartInterval';
import { useMatchLive } from '@/app/providers/MatchLiveProvider';

const ADMIN_EMAILS = [
    'mkposcosunday@gmail.com', 
    'factsportlive@gmail.com', 
    'fact@factsport.com'
];

// V2 community writes are fail-closed until authenticated PostgreSQL
// identity, moderation and rate limiting are fully verified.
const COMMUNITY_WRITES_ENABLED = process.env.NEXT_PUBLIC_FACTSPORT_MEDIA_COMMUNITY_WRITES === 'enabled';

const FINISHED_STATUSES = ['FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD'];

export default function FanZoneChat({ matchId, espnId }: { matchId: string, espnId?: string }) {
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [submissionError, setSubmissionError] = useState<string | null>(null);
    const [replyTo, setReplyTo] = useState<{id: string, user: string, text: string} | null>(null);
    const [showScrollBottom, setShowScrollBottom] = useState(false);
    // Anonymous Media participants never need fan, editor or Prediction accounts.
    const [lastMsgTime, setLastMsgTime] = useState(0); 
    const [pinnedMessage, setPinnedMessage] = useState<{text: string, link: string | null} | null>(null);





    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const CHAT_WORKER_URL = '/api/media/chat'; 

    const liveData = useMatchLive();
    
    // 🟢 DYNAMIC STATUS TRACKING
    const currentStatus = (liveData?.status || '').toUpperCase();
    const isFinished = FINISHED_STATUSES.includes(currentStatus);
    const isLive = ['LIVE', 'HT', 'IN_PLAY', '1H', '2H', 'ET', 'P'].includes(currentStatus);
    const matchDateStr = liveData?.match_date || liveData?.date;
    const matchDateMs = matchDateStr ? new Date(matchDateStr).getTime() : 0;
    const minutesToKick = matchDateMs ? (matchDateMs - Date.now()) / 60000 : 0;
    
    // True if match is FT OR if it has been over 4 hours since scheduled kickoff
    const isUniversallyFinished = isFinished || (matchDateMs > 0 && minutesToKick < -240);
    
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

    const fetchChat = async () => {
        if (document.hidden) return; 
        try {
            // 🟢 Pass the status to the worker so it knows how long to cache!
            const res = await fetch(`${CHAT_WORKER_URL}/messages?match_id=${matchId}&status=${currentStatus}`, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                
                // Only update state if we actually have new data to prevent unnecessary re-renders
                setMessages((prev) => {
                    const latestNewId = data.messages?.[data.messages.length - 1]?.id;
                    const latestOldId = prev[prev.length - 1]?.id;
                    if (latestNewId === latestOldId) return prev;
                    return data.messages || [];
                });
                
                setTimeout(() => scrollToBottom(false), 100);
            }
        } catch (e) {}
    };
    useEffect(() => { fetchChat(); }, [matchId]);

    // 🟢 DYNAMIC POLLING INTERVALS (Saves Battery & API Limits)
    let chatPollInterval = null;
    let pinPollInterval = null;
    
    if (!isUniversallyFinished && matchId) {
        chatPollInterval = isLive ? 3000 : 60000; // 3s Live, 60s Scheduled
        pinPollInterval = isLive ? 15000 : 60000; // 15s Live, 60s Scheduled (Saves DB reads)
    }

    useSmartInterval(fetchChat, chatPollInterval);
    useSmartInterval(fetchPin, pinPollInterval); 

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

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        let messageText = newMessage.trim();
        if (!COMMUNITY_WRITES_ENABLED || !messageText || isSending) return;

        {
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
        setSubmissionError(null);
        setIsSending(true);
        
        messageText = messageText.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        let finalMessageStr = messageText;
        
        // Replies are separate server-validated references; never user-supplied moderator markup.

        // 🟢 OPTIMISTIC UPDATE: Instantly show message to the user
        const tempMsg = {
            id: 'temp-' + Date.now(),
            username: 'FactSport Fan',
            avatar_url: null,
            message: finalMessageStr,
            created_at: new Date().toISOString()
        };

        setMessages(prev => [...prev, tempMsg]);
        setNewMessage("");
        setReplyTo(null); 

        setTimeout(() => scrollToBottom(true), 50);

        try {
            // The future V2 API must derive identity, display name and avatar
            // from the verified fan session. Never trust browser-supplied IDs.
            const response = await fetch(`${CHAT_WORKER_URL}/messages`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ match_id: matchId, message: tempMsg.message, reply_to_id: replyTo?.id || null })
            });
            if (!response.ok) throw new Error('Message was not accepted.');
            setLastMsgTime(Date.now());
            void fetchChat();
        } catch {
            setMessages(prev => prev.filter(message => message.id !== tempMsg.id));
            setNewMessage(messageText);
            setSubmissionError('Your message was not posted. Please try again.');
        } finally {
            setIsSending(false);
        }
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
                    
                    {pinnedMessage.link && /^https:\/\//i.test(pinnedMessage.link) && (
                        <a href={pinnedMessage.link} target="_blank" rel="noopener noreferrer" className="text-white bg-blue-600 rounded-lg px-4 py-2 text-xs">View pinned link</a>
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
                                        {!isUniversallyFinished && (
                                            <button onClick={() => setReplyTo({id: msg.id, user: msg.username, text: displayMessage})} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-500 transition active:scale-95">
                                                <Reply size={12} />
                                            </button>
                                        )}
                                    </div>
                                    
                                    {msg.reply_to_id && (
                                        <div className="mb-1 text-[10px] text-slate-500 border-l-2 border-blue-300 pl-2">
                                            Reply to {messages.find((item: any) => item.id === msg.reply_to_id)?.username || 'earlier message'}
                                        </div>
                                    )}
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
                {replyTo && !isUniversallyFinished && (
                    <div className="bg-slate-50 border-b border-slate-200 px-3 py-1.5 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                            <Reply size={12} className="text-blue-500 shrink-0"/>
                            <span className="text-[10px] text-slate-500 truncate">Replying to <span className="font-bold text-slate-700">@{replyTo.user}</span></span>
                        </div>
                        <button onClick={() => setReplyTo(null)} className="text-slate-400 hover:text-red-500 p-1"><X size={14}/></button>
                    </div>
                )}
                
                <div className="p-2 md:p-3 flex items-center gap-2">

                    <div className="flex-1">
                        {isUniversallyFinished ? (
                            <div className="w-full text-center bg-slate-50 border border-slate-200 text-slate-400 text-[10px] font-black uppercase tracking-widest py-3 rounded-full shadow-inner">
                                Match Ended. Chat is Closed.
                            </div>
                        ) : !COMMUNITY_WRITES_ENABLED ? (
                            <div role="status" className="w-full text-center rounded-xl bg-amber-50 border border-amber-200 py-2 px-3 text-[10px] font-bold text-amber-900">Guest chat is temporarily unavailable.</div>
                            
                        ) : (
                            <div>
                            {submissionError && <p role="alert" className="mb-2 text-xs text-red-700">{submissionError}</p>}
                            <form onSubmit={handleSendMessage} className="relative flex items-center">
                                <input 
                                    type="text" 
                                    value={newMessage} 
                                    onChange={(e) => setNewMessage(e.target.value)} 
                                    placeholder="Join the chat without an account..." 
                                    className="w-full border rounded-full pl-4 pr-12 py-2 md:py-2.5 text-xs font-medium bg-[#F0F2F5] border-slate-200" 
                                    maxLength={200} 
                                />
                                <button type="submit" disabled={!newMessage.trim() || isSending} className="absolute right-1 p-1.5 text-white rounded-full disabled:opacity-50 bg-blue-600">
                                    <Send size={14} />
                                </button>
                            </form>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}