'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { Save, Loader2, Globe, Facebook, Twitter, X as CloseIcon, AlertCircle, KeyRound, Send, Target, Edit3, Layers } from 'lucide-react';

const DEFAULT_EVENTS = {
    goals: { buf_x1: false, buf_x2: false, buf_fb1: false, buf_fb2: false, fb1: true, fb2: false, make1: true, make2: false, label: "Goals & Shootouts" },
    lineups: { buf_x1: false, buf_x2: false, buf_fb1: false, buf_fb2: false, fb1: true, fb2: false, make1: true, make2: false, label: "Starting XI Lineups" },
    kickoff: { buf_x1: false, buf_x2: false, buf_fb1: false, buf_fb2: false, fb1: true, fb2: false, make1: true, make2: false, label: "Match Kick-Off" },
    fulltime: { buf_x1: false, buf_x2: false, buf_fb1: false, buf_fb2: false, fb1: true, fb2: false, make1: true, make2: false, label: "Full Time Results" },
    halftime: { buf_x1: false, buf_x2: false, buf_fb1: false, buf_fb2: false, fb1: true, fb2: false, make1: false, make2: false, label: "Half Time Scores" },
    var_overturn: { buf_x1: false, buf_x2: false, buf_fb1: false, buf_fb2: false, fb1: true, fb2: false, make1: false, make2: false, label: "VAR Overturns" },
    penalty_awarded: { buf_x1: false, buf_x2: false, buf_fb1: false, buf_fb2: false, fb1: true, fb2: false, make1: false, make2: false, label: "Penalty Awarded" },
    daily_preview: { buf_x1: false, buf_x2: false, buf_fb1: false, buf_fb2: false, fb1: true, fb2: true, make1: true, make2: true, tg_general: true, label: "Morning Daily Preview" },
    daily_summary: { buf_x1: false, buf_x2: false, buf_fb1: false, buf_fb2: false, fb1: true, fb2: true, make1: true, make2: true, tg_general: true, label: "Evening Matchday Summary" },
    free_tips: { buf_x1: false, buf_x2: false, buf_fb1: false, buf_fb2: false, fb1: true, fb2: true, make1: true, make2: true, tg_general: true, label: "Free Bet of the Day" },
    vip_tips: { tg_vip: true, label: "Pro AI Analysis (VIP Only)" }
};

// 🟢 EXPANDED: Now includes explicit Buffer Direct defaults so text boxes aren't empty
const DEFAULT_TEMPLATES: Record<string, Record<string, string>> = {
    goals: {
        buf_fb1: "🚨 GOAL ALERT!\n\n[HOME] [H_SCORE] - [A_SCORE] [AWAY][STATUS]\n[SCORER]\n[CTA][LINK]",
        buf_x1: "🚨 GOAL ALERT!\n\n[HOME] [H_SCORE] - [A_SCORE] [AWAY][STATUS]\n[SCORER]\n[CTA][LINK]\n\n[HASHTAGS]",
        fb1: "🚨 GOAL ALERT!\n\n[HOME] [H_SCORE] - [A_SCORE] [AWAY][STATUS]\n[SCORER]\n[CTA][LINK]",
        make1: "🚨 GOAL ALERT!\n\n[HOME] [H_SCORE] - [A_SCORE] [AWAY][STATUS]\n[SCORER]\n[CTA][LINK]\n\n[HASHTAGS]",
        tg_general: "🚨 <b>GOAL ALERT!</b>\n\n⚽️ <b>[HOME] [H_SCORE] - [A_SCORE] [AWAY]</b>[STATUS]\n[SCORER]\n\n[CTA]<a href=\"[LINK]\">Match Center</a>"
    },
    lineups: {
        buf_fb1: "📋 STARTING XI ANNOUNCED!\n\n[HOME] vs [AWAY]\n\n[PRE_CTA][LINK]",
        buf_x1: "🚨 STARTING XI: [HOME] vs [AWAY]!\n\n[PRE_CTA][LINK]\n\n[HASHTAGS]",
        fb1: "📋 STARTING XI ANNOUNCED!\n\n[HOME] vs [AWAY]\n\n[PRE_CTA][LINK]",
        make1: "🚨 STARTING XI: [HOME] vs [AWAY]!\n\n[PRE_CTA][LINK]\n\n[HASHTAGS]",
        tg_general: "📋 <b>STARTING XI ANNOUNCED!</b>\n\n⚔️ <b>[HOME] vs [AWAY]</b>\n\n[PRE_CTA]<a href=\"[LINK]\">View Lineups & Tactics</a>"
    },
    kickoff: {
        buf_fb1: "⏱️ KICK-OFF!\n\nWe are officially underway: [HOME] vs [AWAY].\n\n[CTA][LINK]",
        buf_x1: "⏱️ KICK-OFF!\n\nWe are officially underway.\n\n[CTA][LINK]\n\n[HASHTAGS]",
        fb1: "⏱️ KICK-OFF!\n\nWe are officially underway: [HOME] vs [AWAY].\n\n[CTA][LINK]",
        make1: "⏱️ KICK-OFF!\n\nWe are officially underway.\n\n[CTA][LINK]\n\n[HASHTAGS]",
    },
    fulltime: {
        buf_fb1: "⏹️ FULL TIME!\n\n[HOME] [H_SCORE] - [A_SCORE] [AWAY]\n\n👇 Final Match Stats & Ratings:\n[LINK]",
        buf_x1: "⏹️ FULL TIME.\n\n[HOME] [H_SCORE] - [A_SCORE] [AWAY].\n\n👇 Final Stats:\n[LINK]\n\n[HASHTAGS]",
        fb1: "⏹️ FULL TIME!\n\n[HOME] [H_SCORE] - [A_SCORE] [AWAY]\n\n👇 Final Match Stats & Ratings:\n[LINK]",
        make1: "⏹️ FULL TIME.\n\n[HOME] [H_SCORE] - [A_SCORE] [AWAY].\n\n👇 Final Stats:\n[LINK]\n\n[HASHTAGS]",
    },
    halftime: {
        buf_fb1: "⏸️ HALF TIME.\n\nHow do you rate the first half performance?\n\n[HOME] [H_SCORE] - [A_SCORE] [AWAY]\n\n[CTA][LINK]",
        buf_x1: "⏸️ HALF TIME.\n\n[HOME] [H_SCORE] - [A_SCORE] [AWAY]\n\n[CTA][LINK]\n\n[HASHTAGS]",
        fb1: "⏸️ HALF TIME.\n\nHow do you rate the first half performance?\n\n[HOME] [H_SCORE] - [A_SCORE] [AWAY]\n\n[CTA][LINK]",
        make1: "⏸️ HALF TIME.\n\n[HOME] [H_SCORE] - [A_SCORE] [AWAY]\n\n[CTA][LINK]\n\n[HASHTAGS]",
    },
    var_overturn: {
        buf_fb1: "❌ VAR DECISION: OVERTURNED - Previous G/Event has been canceled.\n\nThe score returns to:\n⚽ [HOME] [H_SCORE] - [A_SCORE] [AWAY]\n\n[CTA][LINK]",
        buf_x1: "❌ VAR DECISION: OVERTURNED - Previous G/Event canceled.\n\n⚽ [HOME] [H_SCORE] - [A_SCORE] [AWAY]\n\n[CTA][LINK]\n\n[HASHTAGS]",
        fb1: "❌ VAR DECISION: OVERTURNED - Previous G/Event has been canceled.\n\nThe score returns to:\n⚽ [HOME] [H_SCORE] - [A_SCORE] [AWAY]\n\n[CTA][LINK]",
        make1: "❌ VAR DECISION: OVERTURNED - Previous G/Event canceled.\n\n⚽ [HOME] [H_SCORE] - [A_SCORE] [AWAY]\n\n[CTA][LINK]\n\n[HASHTAGS]",
    },
    penalty_awarded: {
        buf_fb1: "⚠️ PENALTY AWARDED - (Confirmed by Referee/VAR) [TIME]\n\nMassive moment in the match! Will they convert it?\n\n[CTA][LINK]",
        buf_x1: "⚠️ PENALTY AWARDED - [TIME]\n\nMassive moment in the match! Will they convert it?\n\n[CTA][LINK]\n\n[HASHTAGS]",
        fb1: "⚠️ PENALTY AWARDED - (Confirmed by Referee/VAR) [TIME]\n\nMassive moment in the match! Will they convert it?\n\n[CTA][LINK]",
        make1: "⚠️ PENALTY AWARDED - [TIME]\n\nMassive moment in the match! Will they convert it?\n\n[CTA][LINK]\n\n[HASHTAGS]",
    },
    free_tips: {
        buf_fb1: "🎁 FREE BET OF THE DAY 🎁\n\n📅 Date: [DATE]\n⚽️ [HOME] vs [AWAY]\n🎯 Prediction: [PICK]\n🔥 Odds: [ODDS]\n\n👇 See full stats and place your bet!\n[LINK]",
        buf_x1: "🎁 FREE BET OF THE DAY!\n\n📅 [DATE]\n⚽️ [HOME] vs [AWAY]\n🎯 Pick: [PICK] ([ODDS])\n\n👇 Full stats:\n[LINK]",
        fb1: "🎁 FREE BET OF THE DAY 🎁\n\n📅 Date: [DATE]\n⚽️ [HOME] vs [AWAY]\n🎯 Prediction: [PICK]\n🔥 Odds: [ODDS]\n\n👇 See full stats and place your bet!\n[LINK]",
        make1: "🎁 FREE BET OF THE DAY!\n\n📅 [DATE]\n⚽️ [HOME] vs [AWAY]\n🎯 Pick: [PICK] ([ODDS])\n\n👇 Full stats:\n[LINK]",
        tg_general: "🎁 <b>FREE BET OF THE DAY</b> 🎁\n\n📅 <b>Date:</b> [DATE]\n⚽️ <b>[HOME] vs [AWAY]</b>\n\n🎯 <b>Prediction:</b> [PICK]\n🔥 <b>Odds:</b> [ODDS]\n\n🧠 <b>Why?:</b> <i>[RATIONALE]</i>\n\n👉 <a href=\"[LINK]\">Bet on this match here!</a>"
    }
};

export default function SocialSettingsManager() {
    const supabase = createClient();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    const [vipTeams, setVipTeams] = useState<string[]>([]);
    const [vipLeagues, setVipLeagues] = useState<string[]>([]);
    const [events, setEvents] = useState<any>(DEFAULT_EVENTS);
    const [templates, setTemplates] = useState<any>(DEFAULT_TEMPLATES); 
    
    const [credentials, setCredentials] = useState({ buffer_token: '', buffer_x1_id: '', buffer_x2_id: '', buffer_fb1_id: '', buffer_fb2_id: '', fb1_id: '', fb1_token: '', fb2_id: '', fb2_token: '', make_webhook_1: '', make_webhook_2: '', telegram_bot_token: '', betting_partner_link: '' });
    const [tgGeneralChannels, setTgGeneralChannels] = useState<{chatId: string, link: string, wants_preview: boolean, wants_summary: boolean, wants_freetips: boolean}[]>([]);
    const [tgVipChannels, setTgVipChannels] = useState<{chatId: string, link: string}[]>([]);
    
    const [newGenId, setNewGenId] = useState(''); const [newGenLink, setNewGenLink] = useState(''); const [newGenPrefs, setNewGenPrefs] = useState({ preview: true, summary: true, freetips: true });
    const [newVipId, setNewVipId] = useState(''); const [newVipLink, setNewVipLink] = useState('');
    const [newTeam, setNewTeam] = useState(''); const [newLeague, setNewLeague] = useState('');
    const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });
    const [dbLeagues, setDbLeagues] = useState<string[]>([]); const [dbTeams, setDbTeams] = useState<string[]>([]);
    const [upcomingMatches, setUpcomingMatches] = useState<any[]>([]);
    const [featuredMatchId, setFeaturedMatchId] = useState<string>('');

    const [activeModalEvent, setActiveModalEvent] = useState<string | null>(null);

    useEffect(() => { loadSettingsAndData(); }, []);

    const loadSettingsAndData = async () => {
        setIsLoading(true);
        const { data: settingsData } = await supabase.from('site_settings').select('social_config').single();
        if (settingsData?.social_config) {
            setVipTeams(settingsData.social_config.vip_teams || []);
            setVipLeagues(settingsData.social_config.vip_leagues || []);
            setFeaturedMatchId(settingsData.social_config.featured_match_id || ''); 
            setTemplates({ ...DEFAULT_TEMPLATES, ...(settingsData.social_config.templates || {}) }); 
            
            const savedCreds = settingsData.social_config.credentials || {};
            setCredentials({ 
                buffer_token: savedCreds.buffer_token || '', buffer_x1_id: savedCreds.buffer_x1_id || savedCreds.buffer_x_id || '', buffer_x2_id: savedCreds.buffer_x2_id || '', buffer_fb1_id: savedCreds.buffer_fb1_id || '', buffer_fb2_id: savedCreds.buffer_fb2_id || '', 
                fb1_id: savedCreds.fb1_id || '', fb1_token: savedCreds.fb1_token || '', fb2_id: savedCreds.fb2_id || '', fb2_token: savedCreds.fb2_token || '', make_webhook_1: savedCreds.make_webhook_1 || '', make_webhook_2: savedCreds.make_webhook_2 || '', telegram_bot_token: savedCreds.telegram_bot_token || '', betting_partner_link: savedCreds.betting_partner_link || '' 
            });

            const loadedGenChannels = (savedCreds.tg_general_channels || []).map((ch: any) => ({ ...ch, wants_preview: ch.wants_preview !== false, wants_summary: ch.wants_summary !== false, wants_freetips: ch.wants_freetips !== false }));
            setTgGeneralChannels(loadedGenChannels);
            setTgVipChannels(savedCreds.tg_vip_channels || []);
            
            const savedEvents = settingsData.social_config.events || {};
            const mergedEvents: any = JSON.parse(JSON.stringify(DEFAULT_EVENTS)); 
            Object.keys(mergedEvents).forEach(key => {
                if (savedEvents[key]) {
                    ['buf_x1', 'buf_x2', 'buf_fb1', 'buf_fb2', 'fb1','fb2','make1','make2','tg_general','tg_vip'].forEach(plat => {
                        if (savedEvents[key][plat] !== undefined) mergedEvents[key][plat] = savedEvents[key][plat];
                    });
                }
            });
            setEvents(mergedEvents);
        }

        const now = new Date().toISOString();
        const [ { data: matchData }, { data: upcoming } ] = await Promise.all([
            supabase.from('matches').select('league, home_team, away_team'),
            supabase.from('matches').select('id, home_team, away_team, match_date').gte('match_date', now).order('match_date', { ascending: true }).limit(50)
        ]);

        if (matchData) {
            const uniqueLeagues = new Set<string>(); const uniqueTeams = new Set<string>();
            matchData.forEach(match => { if (match.league) uniqueLeagues.add(match.league); if (match.home_team) uniqueTeams.add(match.home_team); if (match.away_team) uniqueTeams.add(match.away_team); });
            setDbLeagues(Array.from(uniqueLeagues).sort()); setDbTeams(Array.from(uniqueTeams).sort());
        }
        if (upcoming) setUpcomingMatches(upcoming);
        setIsLoading(false);
    };

    const handleSave = async () => {
        setIsSaving(true); setStatusMsg({ text: '', type: '' });
        const payload = { vip_teams: vipTeams, vip_leagues: vipLeagues, events: events, templates: templates, featured_match_id: featuredMatchId || null, credentials: { ...credentials, tg_general_channels: tgGeneralChannels, tg_vip_channels: tgVipChannels } };
        const { error } = await supabase.from('site_settings').update({ social_config: payload }).eq('id', 1);
        if (error) setStatusMsg({ text: 'Failed to save settings.', type: 'error' });
        else setStatusMsg({ text: 'Social settings updated successfully.', type: 'success' });
        setIsSaving(false); setTimeout(() => setStatusMsg({ text: '', type: '' }), 3000);
    };

    const addItem = (type: 'team' | 'league') => {
        if (type === 'team' && newTeam.trim() && !vipTeams.includes(newTeam.trim())) { setVipTeams([...vipTeams, newTeam.trim()]); setNewTeam(''); } 
        else if (type === 'league' && newLeague.trim() && !vipLeagues.includes(newLeague.trim())) { setVipLeagues([...vipLeagues, newLeague.trim()]); setNewLeague(''); }
    };

    const removeItem = (type: 'team' | 'league', itemToRemove: string) => {
        if (type === 'team') setVipTeams(vipTeams.filter(t => t !== itemToRemove));
        if (type === 'league') setVipLeagues(vipLeagues.filter(l => l !== itemToRemove));
    };

    const toggleEvent = (eventKey: string, platform: string) => {
        setEvents((prev: any) => ({ ...prev, [eventKey]: { ...prev[eventKey], [platform]: !prev[eventKey][platform] } }));
    };

    const handleTemplateChange = (eventKey: string, platform: string, value: string) => {
        setTemplates((prev: any) => ({ ...prev, [eventKey]: { ...(prev[eventKey] || {}), [platform]: value } }));
    };

    const addChannel = (type: 'general' | 'vip') => {
        if (type === 'general' && newGenId.trim()) {
            setTgGeneralChannels([...tgGeneralChannels, { chatId: newGenId.trim(), link: newGenLink.trim() || 'https://factsport.com', wants_preview: newGenPrefs.preview, wants_summary: newGenPrefs.summary, wants_freetips: newGenPrefs.freetips }]);
            setNewGenId(''); setNewGenLink(''); setNewGenPrefs({ preview: true, summary: true, freetips: true });
        } else if (type === 'vip' && newVipId.trim()) {
            setTgVipChannels([...tgVipChannels, { chatId: newVipId.trim(), link: newVipLink.trim() || 'https://factsport.com' }]);
            setNewVipId(''); setNewVipLink('');
        }
    };
    const removeChannel = (type: 'general' | 'vip', index: number) => { if (type === 'general') setTgGeneralChannels(tgGeneralChannels.filter((_, i) => i !== index)); else setTgVipChannels(tgVipChannels.filter((_, i) => i !== index)); };
    const toggleGenPref = (pref: 'preview'|'summary'|'freetips') => setNewGenPrefs(prev => ({...prev, [pref]: !prev[pref]}));

    if (isLoading) return <div className="h-64 flex items-center justify-center bg-white"><Loader2 className="animate-spin text-blue-500" size={32} /></div>;

    const liveEvents = ['goals', 'lineups', 'kickoff', 'fulltime', 'halftime', 'var_overturn', 'penalty_awarded'];
    const backgroundEvents = ['daily_preview', 'daily_summary', 'free_tips', 'vip_tips'];
    
    // 🟢 EXPANDED: Template platforms array now fully unlocks Buffer Direct text boxes
    const templatePlatforms = ['buf_x1', 'buf_x2', 'buf_fb1', 'buf_fb2', 'fb1', 'fb2', 'make1', 'make2', 'tg_general', 'tg_vip'];

    return (
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden mt-8 relative">
            
            {activeModalEvent && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-6">
                    <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-full overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-black text-slate-800 text-lg flex items-center gap-2"><Edit3 size={18} className="text-blue-600"/> Edit Templates: <span className="text-blue-600">{events[activeModalEvent].label}</span></h3>
                            <button onClick={() => setActiveModalEvent(null)} className="text-slate-400 hover:text-red-500 bg-white border border-slate-200 p-1.5 rounded-lg"><CloseIcon size={20}/></button>
                        </div>
                        <div className="p-4 bg-blue-50/50 border-b border-blue-100 text-xs text-blue-800 font-medium leading-relaxed">
                            <span className="font-black">Supported Variables:</span><br/>
                            <span className="font-mono bg-white px-1 py-0.5 rounded border border-blue-200">[HOME]</span> <span className="font-mono bg-white px-1 py-0.5 rounded border border-blue-200">[AWAY]</span> <span className="font-mono bg-white px-1 py-0.5 rounded border border-blue-200">[H_SCORE]</span> <span className="font-mono bg-white px-1 py-0.5 rounded border border-blue-200">[A_SCORE]</span> <span className="font-mono bg-white px-1 py-0.5 rounded border border-blue-200">[TIME]</span> <span className="font-mono bg-white px-1 py-0.5 rounded border border-blue-200">[LINK]</span> <span className="font-mono bg-white px-1 py-0.5 rounded border border-blue-200">[SCORER]</span> <span className="font-mono bg-white px-1 py-0.5 rounded border border-blue-200">[STATUS]</span> <span className="font-mono bg-white px-1 py-0.5 rounded border border-blue-200">[CTA]</span> <span className="font-mono bg-white px-1 py-0.5 rounded border border-blue-200">[PRE_CTA]</span> <span className="font-mono bg-white px-1 py-0.5 rounded border border-blue-200">[HASHTAGS]</span>
                        </div>
                        <div className="p-4 overflow-y-auto space-y-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {templatePlatforms.map(plat => {
                                if (events[activeModalEvent][plat] === undefined) return null; 
                                return (
                                    <div key={plat} className="flex flex-col">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{plat.replace('_', ' ')} Text</label>
                                        <textarea 
                                            value={templates[activeModalEvent]?.[plat] !== undefined ? templates[activeModalEvent][plat] : (DEFAULT_TEMPLATES[activeModalEvent]?.[plat] || '')} 
                                            onChange={(e) => handleTemplateChange(activeModalEvent, plat, e.target.value)}
                                            placeholder={`Type custom text for ${plat}...`}
                                            className="w-full h-28 p-3 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-slate-50"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                            <button onClick={() => setActiveModalEvent(null)} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700">Done</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-[#0a1428] text-white">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600/30 p-2 rounded-lg"><Layers size={20} className="text-blue-400" /></div>
                    <div>
                        <h2 className="font-black text-lg tracking-tight">Social Media Matrix</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Control Triggers, Routing & Credentials</p>
                    </div>
                </div>
                <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all">
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Settings
                </button>
            </div>

            {statusMsg.text && ( <div className={`p-3 text-xs font-bold text-center flex items-center justify-center gap-2 ${statusMsg.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}><AlertCircle size={14} /> {statusMsg.text}</div> )}

            <div className="p-6 grid grid-cols-1 xl:grid-cols-12 gap-8">
                
                <div className="xl:col-span-8 space-y-6">
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 overflow-x-auto shadow-inner">
                        <h3 className="font-black text-slate-800 text-sm mb-4 flex items-center gap-2"><Globe size={16} className="text-blue-500"/> Advanced Routing Matrix</h3>
                        
                        <div className="space-y-3 min-w-[750px]">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-300 px-2 bg-slate-100 rounded-t-lg pt-2">
                                <div className="w-[18%] text-[9px] font-black text-slate-500 uppercase tracking-widest">Event Trigger</div>
                                <div className="w-[7%] flex justify-center text-[9px] font-black text-purple-600 title='Buffer X Account 1'">B-X1</div>
                                <div className="w-[7%] flex justify-center text-[9px] font-black text-purple-500 title='Buffer X Account 2'">B-X2</div>
                                <div className="w-[7%] flex justify-center text-[9px] font-black text-indigo-600 title='Buffer FB Page 1'">B-FB1</div>
                                <div className="w-[7%] flex justify-center text-[9px] font-black text-indigo-500 title='Buffer FB Page 2'">B-FB2</div>
                                <div className="w-[7%] flex justify-center text-[9px] font-black text-blue-600 title='Direct Graph API FB 1'">D-FB1</div>
                                <div className="w-[7%] flex justify-center text-[9px] font-black text-blue-400 title='Direct Graph API FB 2'">D-FB2</div>
                                <div className="w-[7%] flex justify-center text-[9px] font-black text-slate-800 title='Make/Activepieces 1'">MK1</div>
                                <div className="w-[7%] flex justify-center text-[9px] font-black text-slate-600 title='Make/Activepieces 2'">MK2</div>
                                <div className="w-[7%] flex justify-center text-[9px] font-black text-blue-400 title='Telegram General'">TG-G</div>
                                <div className="w-[7%] flex justify-center text-[9px] font-black text-yellow-600 title='Telegram VIP'">TG-V</div>
                                <div className="w-[5%]"></div>
                            </div>
                            
                            <div className="pt-2 pb-1 text-[8px] uppercase tracking-widest font-black text-slate-400">Live Triggers</div>
                            {liveEvents.map((key) => {
                                const config = events[key];
                                return (
                                <div key={key} className="flex items-center justify-between py-1.5 px-2 hover:bg-white rounded-lg transition-colors group border border-transparent hover:border-slate-200">
                                    <div className="w-[18%] font-bold text-slate-700 text-[10px] truncate pr-2">{config.label}</div>
                                    <div className="w-[7%] flex justify-center"><button onClick={() => toggleEvent(key, 'buf_x1')} className={`w-6 h-3 rounded-full relative transition-colors ${config.buf_x1 ? 'bg-purple-600' : 'bg-slate-200'}`}><div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all ${config.buf_x1 ? 'left-3.5' : 'left-0.5'}`}></div></button></div>
                                    <div className="w-[7%] flex justify-center"><button onClick={() => toggleEvent(key, 'buf_x2')} className={`w-6 h-3 rounded-full relative transition-colors ${config.buf_x2 ? 'bg-purple-500' : 'bg-slate-200'}`}><div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all ${config.buf_x2 ? 'left-3.5' : 'left-0.5'}`}></div></button></div>
                                    <div className="w-[7%] flex justify-center"><button onClick={() => toggleEvent(key, 'buf_fb1')} className={`w-6 h-3 rounded-full relative transition-colors ${config.buf_fb1 ? 'bg-indigo-600' : 'bg-slate-200'}`}><div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all ${config.buf_fb1 ? 'left-3.5' : 'left-0.5'}`}></div></button></div>
                                    <div className="w-[7%] flex justify-center"><button onClick={() => toggleEvent(key, 'buf_fb2')} className={`w-6 h-3 rounded-full relative transition-colors ${config.buf_fb2 ? 'bg-indigo-500' : 'bg-slate-200'}`}><div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all ${config.buf_fb2 ? 'left-3.5' : 'left-0.5'}`}></div></button></div>
                                    <div className="w-[7%] flex justify-center"><button onClick={() => toggleEvent(key, 'fb1')} className={`w-6 h-3 rounded-full relative transition-colors ${config.fb1 ? 'bg-blue-600' : 'bg-slate-200'}`}><div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all ${config.fb1 ? 'left-3.5' : 'left-0.5'}`}></div></button></div>
                                    <div className="w-[7%] flex justify-center"><button onClick={() => toggleEvent(key, 'fb2')} className={`w-6 h-3 rounded-full relative transition-colors ${config.fb2 ? 'bg-blue-400' : 'bg-slate-200'}`}><div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all ${config.fb2 ? 'left-3.5' : 'left-0.5'}`}></div></button></div>
                                    <div className="w-[7%] flex justify-center"><button onClick={() => toggleEvent(key, 'make1')} className={`w-6 h-3 rounded-full relative transition-colors ${config.make1 ? 'bg-slate-800' : 'bg-slate-200'}`}><div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all ${config.make1 ? 'left-3.5' : 'left-0.5'}`}></div></button></div>
                                    <div className="w-[7%] flex justify-center"><button onClick={() => toggleEvent(key, 'make2')} className={`w-6 h-3 rounded-full relative transition-colors ${config.make2 ? 'bg-slate-500' : 'bg-slate-200'}`}><div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all ${config.make2 ? 'left-3.5' : 'left-0.5'}`}></div></button></div>
                                    <div className="w-[7%]"></div><div className="w-[7%]"></div>
                                    <div className="w-[5%] flex justify-end"><button onClick={() => setActiveModalEvent(key)} className="text-slate-300 hover:text-blue-600 transition-colors bg-white shadow-sm border border-slate-200 p-1 rounded"><Edit3 size={12}/></button></div>
                                </div>
                            )})}

                            <div className="pt-3 pb-1 text-[8px] uppercase tracking-widest font-black text-slate-400 border-t border-slate-200">Scheduled Scripts</div>
                            {backgroundEvents.map((key) => {
                                const config = events[key];
                                return (
                                <div key={key} className="flex items-center justify-between py-1.5 px-2 hover:bg-white rounded-lg transition-colors group border border-transparent hover:border-slate-200">
                                    <div className="w-[18%] font-bold text-slate-700 text-[10px] truncate pr-2">{config.label}</div>
                                    <div className="w-[7%] flex justify-center">{config.buf_x1 !== undefined && <button onClick={() => toggleEvent(key, 'buf_x1')} className={`w-6 h-3 rounded-full relative transition-colors ${config.buf_x1 ? 'bg-purple-600' : 'bg-slate-200'}`}><div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all ${config.buf_x1 ? 'left-3.5' : 'left-0.5'}`}></div></button>}</div>
                                    <div className="w-[7%] flex justify-center">{config.buf_x2 !== undefined && <button onClick={() => toggleEvent(key, 'buf_x2')} className={`w-6 h-3 rounded-full relative transition-colors ${config.buf_x2 ? 'bg-purple-500' : 'bg-slate-200'}`}><div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all ${config.buf_x2 ? 'left-3.5' : 'left-0.5'}`}></div></button>}</div>
                                    <div className="w-[7%] flex justify-center">{config.buf_fb1 !== undefined && <button onClick={() => toggleEvent(key, 'buf_fb1')} className={`w-6 h-3 rounded-full relative transition-colors ${config.buf_fb1 ? 'bg-indigo-600' : 'bg-slate-200'}`}><div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all ${config.buf_fb1 ? 'left-3.5' : 'left-0.5'}`}></div></button>}</div>
                                    <div className="w-[7%] flex justify-center">{config.buf_fb2 !== undefined && <button onClick={() => toggleEvent(key, 'buf_fb2')} className={`w-6 h-3 rounded-full relative transition-colors ${config.buf_fb2 ? 'bg-indigo-500' : 'bg-slate-200'}`}><div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all ${config.buf_fb2 ? 'left-3.5' : 'left-0.5'}`}></div></button>}</div>
                                    <div className="w-[7%] flex justify-center">{config.fb1 !== undefined && <button onClick={() => toggleEvent(key, 'fb1')} className={`w-6 h-3 rounded-full relative transition-colors ${config.fb1 ? 'bg-blue-600' : 'bg-slate-200'}`}><div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all ${config.fb1 ? 'left-3.5' : 'left-0.5'}`}></div></button>}</div>
                                    <div className="w-[7%] flex justify-center">{config.fb2 !== undefined && <button onClick={() => toggleEvent(key, 'fb2')} className={`w-6 h-3 rounded-full relative transition-colors ${config.fb2 ? 'bg-blue-400' : 'bg-slate-200'}`}><div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all ${config.fb2 ? 'left-3.5' : 'left-0.5'}`}></div></button>}</div>
                                    <div className="w-[7%] flex justify-center">{config.make1 !== undefined && <button onClick={() => toggleEvent(key, 'make1')} className={`w-6 h-3 rounded-full relative transition-colors ${config.make1 ? 'bg-slate-800' : 'bg-slate-200'}`}><div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all ${config.make1 ? 'left-3.5' : 'left-0.5'}`}></div></button>}</div>
                                    <div className="w-[7%] flex justify-center">{config.make2 !== undefined && <button onClick={() => toggleEvent(key, 'make2')} className={`w-6 h-3 rounded-full relative transition-colors ${config.make2 ? 'bg-slate-500' : 'bg-slate-200'}`}><div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all ${config.make2 ? 'left-3.5' : 'left-0.5'}`}></div></button>}</div>
                                    <div className="w-[7%] flex justify-center">{config.tg_general !== undefined && <button onClick={() => toggleEvent(key, 'tg_general')} className={`w-6 h-3 rounded-full relative transition-colors ${config.tg_general ? 'bg-blue-400' : 'bg-slate-200'}`}><div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all ${config.tg_general ? 'left-3.5' : 'left-0.5'}`}></div></button>}</div>
                                    <div className="w-[7%] flex justify-center">{config.tg_vip !== undefined && <button onClick={() => toggleEvent(key, 'tg_vip')} className={`w-6 h-3 rounded-full relative transition-colors ${config.tg_vip ? 'bg-yellow-500' : 'bg-slate-200'}`}><div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all ${config.tg_vip ? 'left-3.5' : 'left-0.5'}`}></div></button>}</div>
                                    <div className="w-[5%] flex justify-end"><button onClick={() => setActiveModalEvent(key)} className="text-slate-300 hover:text-blue-600 transition-colors bg-white shadow-sm border border-slate-200 p-1 rounded"><Edit3 size={12}/></button></div>
                                </div>
                            )})}
                        </div>
                    </div>

                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex gap-4">
                        <div className="flex-1">
                            <h3 className="font-black text-slate-800 text-[10px] uppercase mb-2">VIP Teams</h3>
                            <div className="flex gap-1 mb-2"><input type="text" value={newTeam} onChange={e => setNewTeam(e.target.value)} onKeyDown={e => e.key === 'Enter' && addItem('team')} className="w-full border rounded px-2 py-1 text-xs outline-none" /><button onClick={() => addItem('team')} className="bg-slate-800 text-white px-2 rounded">+</button></div>
                            <div className="flex flex-wrap gap-1">{vipTeams.map(t => <span key={t} className="bg-white border text-[9px] px-1.5 rounded">{t} <button onClick={()=>removeItem('team',t)} className="text-red-400">x</button></span>)}</div>
                        </div>
                        <div className="flex-1">
                            <h3 className="font-black text-slate-800 text-[10px] uppercase mb-2">VIP Leagues</h3>
                            <div className="flex gap-1 mb-2"><input type="text" value={newLeague} onChange={e => setNewLeague(e.target.value)} onKeyDown={e => e.key === 'Enter' && addItem('league')} className="w-full border rounded px-2 py-1 text-xs outline-none" /><button onClick={() => addItem('league')} className="bg-slate-800 text-white px-2 rounded">+</button></div>
                            <div className="flex flex-wrap gap-1">{vipLeagues.map(l => <span key={l} className="bg-white border text-[9px] px-1.5 rounded">{l} <button onClick={()=>removeItem('league',l)} className="text-red-400">x</button></span>)}</div>
                        </div>
                    </div>
                </div>

                <div className="xl:col-span-4 space-y-6">
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                        <div className="flex items-center gap-2 mb-4"><KeyRound size={16} className="text-red-500" /><h3 className="font-black text-slate-800 text-sm">Webhooks & API Keys</h3></div>
                        <div className="space-y-3">
                            <div className="bg-white p-3 rounded-xl border border-slate-200">
                                <h4 className="text-[10px] font-black text-purple-600 mb-2 uppercase tracking-widest"><Twitter size={12} className="inline mr-1"/> Buffer API (Direct)</h4>
                                <input type="password" placeholder="Global Buffer Access Token" value={credentials.buffer_token} onChange={e => setCredentials({...credentials, buffer_token: e.target.value})} className="w-full mb-3 bg-purple-50 border border-purple-100 rounded p-1.5 text-xs outline-none" />
                                <div className="grid grid-cols-2 gap-2">
                                    <input type="text" placeholder="X (Twitter) 1 ID" value={credentials.buffer_x1_id} onChange={e => setCredentials({...credentials, buffer_x1_id: e.target.value})} className="w-full bg-slate-50 border rounded p-1.5 text-xs outline-none" />
                                    <input type="text" placeholder="X (Twitter) 2 ID" value={credentials.buffer_x2_id} onChange={e => setCredentials({...credentials, buffer_x2_id: e.target.value})} className="w-full bg-slate-50 border rounded p-1.5 text-xs outline-none" />
                                    <input type="text" placeholder="FB Page 1 ID" value={credentials.buffer_fb1_id} onChange={e => setCredentials({...credentials, buffer_fb1_id: e.target.value})} className="w-full bg-slate-50 border rounded p-1.5 text-xs outline-none" />
                                    <input type="text" placeholder="FB Page 2 ID" value={credentials.buffer_fb2_id} onChange={e => setCredentials({...credentials, buffer_fb2_id: e.target.value})} className="w-full bg-slate-50 border rounded p-1.5 text-xs outline-none" />
                                </div>
                            </div>

                            <div className="bg-white p-3 rounded-xl border border-slate-200">
                                <h4 className="text-[10px] font-black text-blue-600 mb-2 uppercase"><Facebook size={12} className="inline mr-1"/> Graph API (Direct FB)</h4>
                                <input type="text" placeholder="Page 1 ID" value={credentials.fb1_id} onChange={e => setCredentials({...credentials, fb1_id: e.target.value})} className="w-full mb-1 bg-slate-50 border rounded p-1.5 text-xs outline-none" />
                                <input type="password" placeholder="Page 1 Token" value={credentials.fb1_token} onChange={e => setCredentials({...credentials, fb1_token: e.target.value})} className="w-full mb-3 bg-slate-50 border rounded p-1.5 text-xs outline-none" />
                                <input type="text" placeholder="Page 2 ID" value={credentials.fb2_id} onChange={e => setCredentials({...credentials, fb2_id: e.target.value})} className="w-full mb-1 bg-slate-50 border rounded p-1.5 text-xs outline-none" />
                                <input type="password" placeholder="Page 2 Token" value={credentials.fb2_token} onChange={e => setCredentials({...credentials, fb2_token: e.target.value})} className="w-full bg-slate-50 border rounded p-1.5 text-xs outline-none" />
                            </div>
                            
                            <div className="bg-white p-3 rounded-xl border border-slate-200">
                                <h4 className="text-[10px] font-black text-slate-800 mb-2 uppercase"><Globe size={12} className="inline mr-1"/> Automation Webhooks</h4>
                                <input type="text" placeholder="Webhook URL 1 (Make / AP)" value={credentials.make_webhook_1} onChange={e => setCredentials({...credentials, make_webhook_1: e.target.value})} className="w-full mb-2 bg-slate-50 border rounded p-1.5 text-xs outline-none" />
                                <input type="text" placeholder="Webhook URL 2 (Make / AP)" value={credentials.make_webhook_2} onChange={e => setCredentials({...credentials, make_webhook_2: e.target.value})} className="w-full bg-slate-50 border rounded p-1.5 text-xs outline-none" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-50 p-5 rounded-2xl border border-blue-200">
                        <div className="flex items-center gap-2 mb-4"><Send size={16} className="text-blue-600" /><h3 className="font-black text-blue-900 text-sm">Telegram Manager</h3></div>
                        <input type="password" placeholder="Bot Token" value={credentials.telegram_bot_token} onChange={e => setCredentials({...credentials, telegram_bot_token: e.target.value})} className="w-full mb-4 bg-white border border-blue-200 rounded-xl p-2 text-xs outline-none shadow-sm" />
                        
                        <div className="mb-4">
                            <h4 className="text-[10px] font-black text-blue-800 mb-2 uppercase tracking-widest">General Channels</h4>
                            <div className="bg-white p-2 rounded-lg border border-blue-200 mb-2 shadow-sm">
                                <div className="flex gap-2 mb-2"><input type="text" placeholder="Chat ID" value={newGenId} onChange={e => setNewGenId(e.target.value)} className="w-1/3 bg-slate-50 border rounded p-1 text-xs outline-none" /><input type="text" placeholder="Partner Link" value={newGenLink} onChange={e => setNewGenLink(e.target.value)} className="flex-1 bg-slate-50 border rounded p-1 text-xs outline-none" /></div>
                                <div className="flex items-center justify-between">
                                    <div className="flex gap-2 text-[9px] font-bold text-slate-600">
                                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={newGenPrefs.preview} onChange={()=>toggleGenPref('preview')} /> Prev</label>
                                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={newGenPrefs.summary} onChange={()=>toggleGenPref('summary')} /> Sum</label>
                                        <label className="flex items-center gap-1 cursor-pointer text-blue-600"><input type="checkbox" checked={newGenPrefs.freetips} onChange={()=>toggleGenPref('freetips')} /> Tips</label>
                                    </div>
                                    <button onClick={() => addChannel('general')} className="bg-blue-600 text-white px-3 py-1 text-xs font-black rounded hover:bg-blue-700">Add</button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                {tgGeneralChannels.map((ch, i) => (
                                    <div key={i} className="flex flex-col bg-white border border-blue-100 p-2 rounded-lg shadow-sm">
                                        <div className="flex items-center justify-between mb-1"><div className="truncate text-xs font-black text-blue-800">{ch.chatId}</div><button onClick={() => removeChannel('general', i)} className="text-red-400 hover:text-red-600"><CloseIcon size={14}/></button></div>
                                        <div className="text-[9px] text-slate-400 truncate mb-1">{ch.link}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-blue-100">
                            <div className="flex items-center gap-2 mb-2"><Target size={14} className="text-amber-600" /><h3 className="font-black text-amber-900 text-xs">Free Tip Override</h3></div>
                            <select value={featuredMatchId} onChange={(e) => setFeaturedMatchId(e.target.value)} className="w-full bg-white border border-amber-300 rounded-lg p-2 text-xs font-bold text-slate-800 outline-none">
                                <option value="">⚡ Auto-Select (Best Match of Today)</option>
                                {upcomingMatches.map(m => ( <option key={m.id} value={m.id}>{new Date(m.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - {m.home_team} vs {m.away_team}</option> ))}
                            </select>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}