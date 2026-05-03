'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { Save, Loader2, Trophy, Globe, Facebook, Twitter, X as CloseIcon, Plus, AlertCircle, KeyRound, Send, Target } from 'lucide-react';

const DEFAULT_EVENTS = {
    goals: { fb1: true, fb2: false, make1: true, make2: false, label: "Goals & Shootouts" },
    lineups: { fb1: true, fb2: false, make1: true, make2: false, label: "Starting XI Lineups" },
    kickoff: { fb1: true, fb2: false, make1: true, make2: false, label: "Match Kick-Off" },
    fulltime: { fb1: true, fb2: false, make1: true, make2: false, label: "Full Time Results" },
    halftime: { fb1: true, fb2: false, make1: false, make2: false, label: "Half Time Scores" },
    var_overturn: { fb1: true, fb2: false, make1: false, make2: false, label: "VAR Overturns" },
    penalty_awarded: { fb1: true, fb2: false, make1: false, make2: false, label: "Penalty Awarded" },
    daily_preview: { fb1: true, fb2: true, make1: true, make2: true, tg_general: true, label: "Morning Daily Preview" },
    daily_summary: { fb1: true, fb2: true, make1: true, make2: true, tg_general: true, label: "Evening Matchday Summary" },
    free_tips: { fb1: true, fb2: true, make1: true, make2: true, tg_general: true, label: "Free Bet of the Day" },
    vip_tips: { tg_vip: true, label: "Pro AI Analysis (VIP Only)" }
};

export default function SocialSettingsManager() {
    const supabase = createClient();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    const [vipTeams, setVipTeams] = useState<string[]>([]);
    const [vipLeagues, setVipLeagues] = useState<string[]>([]);
    const [events, setEvents] = useState<any>(DEFAULT_EVENTS);
    
    const [credentials, setCredentials] = useState({
        fb1_id: '', fb1_token: '', fb2_id: '', fb2_token: '',
        make_webhook_1: '', make_webhook_2: '', telegram_bot_token: '', betting_partner_link: '' 
    });

    const [tgGeneralChannels, setTgGeneralChannels] = useState<{chatId: string, link: string, wants_preview: boolean, wants_summary: boolean, wants_freetips: boolean}[]>([]);
    const [tgVipChannels, setTgVipChannels] = useState<{chatId: string, link: string}[]>([]);
    
    const [newGenId, setNewGenId] = useState('');
    const [newGenLink, setNewGenLink] = useState('');
    const [newGenPrefs, setNewGenPrefs] = useState({ preview: true, summary: true, freetips: true });
    
    const [newVipId, setNewVipId] = useState('');
    const [newVipLink, setNewVipLink] = useState('');

    const [newTeam, setNewTeam] = useState('');
    const [newLeague, setNewLeague] = useState('');
    const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });

    const [dbLeagues, setDbLeagues] = useState<string[]>([]);
    const [dbTeams, setDbTeams] = useState<string[]>([]);
    const [upcomingMatches, setUpcomingMatches] = useState<any[]>([]);
    const [featuredMatchId, setFeaturedMatchId] = useState<string>('');

    useEffect(() => { loadSettingsAndData(); }, []);

    const loadSettingsAndData = async () => {
        setIsLoading(true);
        const { data: settingsData } = await supabase.from('site_settings').select('social_config').single();
        if (settingsData?.social_config) {
            setVipTeams(settingsData.social_config.vip_teams || []);
            setVipLeagues(settingsData.social_config.vip_leagues || []);
            setFeaturedMatchId(settingsData.social_config.featured_match_id || ''); 
            
            const savedCreds = settingsData.social_config.credentials || {};
            setCredentials({
                fb1_id: savedCreds.fb1_id || '', fb1_token: savedCreds.fb1_token || '',
                fb2_id: savedCreds.fb2_id || '', fb2_token: savedCreds.fb2_token || '',
                make_webhook_1: savedCreds.make_webhook_1 || '', make_webhook_2: savedCreds.make_webhook_2 || '',
                telegram_bot_token: savedCreds.telegram_bot_token || '',
                betting_partner_link: savedCreds.betting_partner_link || ''
            });

            const loadedGenChannels = (savedCreds.tg_general_channels || []).map((ch: any) => ({
                ...ch,
                wants_preview: ch.wants_preview !== false,
                wants_summary: ch.wants_summary !== false,
                wants_freetips: ch.wants_freetips !== false
            }));
            setTgGeneralChannels(loadedGenChannels);
            setTgVipChannels(savedCreds.tg_vip_channels || []);
            
            const savedEvents = settingsData.social_config.events || {};
            const mergedEvents: any = JSON.parse(JSON.stringify(DEFAULT_EVENTS)); 
            Object.keys(mergedEvents).forEach(key => {
                if (savedEvents[key]) {
                    if (savedEvents[key].fb1 !== undefined) mergedEvents[key].fb1 = savedEvents[key].fb1;
                    if (savedEvents[key].fb2 !== undefined) mergedEvents[key].fb2 = savedEvents[key].fb2;
                    if (savedEvents[key].make1 !== undefined) mergedEvents[key].make1 = savedEvents[key].make1;
                    if (savedEvents[key].make2 !== undefined) mergedEvents[key].make2 = savedEvents[key].make2;
                    if (savedEvents[key].tg_general !== undefined) mergedEvents[key].tg_general = savedEvents[key].tg_general;
                    if (savedEvents[key].tg_vip !== undefined) mergedEvents[key].tg_vip = savedEvents[key].tg_vip;
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
            const uniqueLeagues = new Set<string>();
            const uniqueTeams = new Set<string>();
            matchData.forEach(match => {
                if (match.league) uniqueLeagues.add(match.league);
                if (match.home_team) uniqueTeams.add(match.home_team);
                if (match.away_team) uniqueTeams.add(match.away_team);
            });
            setDbLeagues(Array.from(uniqueLeagues).sort());
            setDbTeams(Array.from(uniqueTeams).sort());
        }
        if (upcoming) setUpcomingMatches(upcoming);
        setIsLoading(false);
    };

    const handleSave = async () => {
        setIsSaving(true);
        setStatusMsg({ text: '', type: '' });
        const payload = {
            vip_teams: vipTeams, vip_leagues: vipLeagues, events: events, featured_match_id: featuredMatchId || null, 
            credentials: { ...credentials, tg_general_channels: tgGeneralChannels, tg_vip_channels: tgVipChannels } 
        };
        const { error } = await supabase.from('site_settings').update({ social_config: payload }).eq('id', 1);
        if (error) setStatusMsg({ text: 'Failed to save settings.', type: 'error' });
        else setStatusMsg({ text: 'Social settings updated successfully.', type: 'success' });
        setIsSaving(false);
        setTimeout(() => setStatusMsg({ text: '', type: '' }), 3000);
    };

    const addItem = (type: 'team' | 'league') => {
        if (type === 'team' && newTeam.trim() && !vipTeams.includes(newTeam.trim())) { setVipTeams([...vipTeams, newTeam.trim()]); setNewTeam(''); } 
        else if (type === 'league' && newLeague.trim() && !vipLeagues.includes(newLeague.trim())) { setVipLeagues([...vipLeagues, newLeague.trim()]); setNewLeague(''); }
    };

    const removeItem = (type: 'team' | 'league', itemToRemove: string) => {
        if (type === 'team') setVipTeams(vipTeams.filter(t => t !== itemToRemove));
        if (type === 'league') setVipLeagues(vipLeagues.filter(l => l !== itemToRemove));
    };

    const toggleEvent = (eventKey: string, platform: 'fb1' | 'fb2' | 'make1' | 'make2' | 'tg_general' | 'tg_vip') => {
        setEvents((prev: any) => ({ ...prev, [eventKey]: { ...prev[eventKey], [platform]: !prev[eventKey][platform] } }));
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

    const removeChannel = (type: 'general' | 'vip', index: number) => {
        if (type === 'general') setTgGeneralChannels(tgGeneralChannels.filter((_, i) => i !== index));
        else setTgVipChannels(tgVipChannels.filter((_, i) => i !== index));
    };

    const toggleGenPref = (pref: 'preview'|'summary'|'freetips') => setNewGenPrefs(prev => ({...prev, [pref]: !prev[pref]}));

    if (isLoading) return <div className="h-64 flex items-center justify-center bg-white"><Loader2 className="animate-spin text-blue-500" size={32} /></div>;

    const liveEvents = ['goals', 'lineups', 'kickoff', 'fulltime', 'halftime', 'var_overturn', 'penalty_awarded'];
    const backgroundEvents = ['daily_preview', 'daily_summary', 'free_tips', 'vip_tips'];

    return (
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden mt-8">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-[#0a1428] text-white">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600/30 p-2 rounded-lg"><Globe size={20} className="text-blue-400" /></div>
                    <div>
                        <h2 className="font-black text-lg tracking-tight">Social Media Command Center</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Control Triggers, Routing & Credentials</p>
                    </div>
                </div>
                <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all">
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Settings
                </button>
            </div>

            {statusMsg.text && (
                <div className={`p-3 text-xs font-bold text-center flex items-center justify-center gap-2 ${statusMsg.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    <AlertCircle size={14} /> {statusMsg.text}
                </div>
            )}

            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* LEFT COLUMN */}
                <div className="space-y-6">
                    {/* VIP TEAMS / LEAGUES COMPRESSED FOR SPACE */}
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex gap-4">
                        <div className="flex-1">
                            <h3 className="font-black text-slate-800 text-[10px] uppercase mb-2">VIP Teams</h3>
                            <div className="flex gap-1 mb-2"><input type="text" value={newTeam} onChange={e => setNewTeam(e.target.value)} onKeyDown={e => e.key === 'Enter' && addItem('team')} className="w-full border rounded px-2 py-1 text-xs" /><button onClick={() => addItem('team')} className="bg-slate-800 text-white px-2 rounded">+</button></div>
                            <div className="flex flex-wrap gap-1">{vipTeams.map(t => <span key={t} className="bg-white border text-[9px] px-1.5 rounded">{t} <button onClick={()=>removeItem('team',t)} className="text-red-400">x</button></span>)}</div>
                        </div>
                        <div className="flex-1">
                            <h3 className="font-black text-slate-800 text-[10px] uppercase mb-2">VIP Leagues</h3>
                            <div className="flex gap-1 mb-2"><input type="text" value={newLeague} onChange={e => setNewLeague(e.target.value)} onKeyDown={e => e.key === 'Enter' && addItem('league')} className="w-full border rounded px-2 py-1 text-xs" /><button onClick={() => addItem('league')} className="bg-slate-800 text-white px-2 rounded">+</button></div>
                            <div className="flex flex-wrap gap-1">{vipLeagues.map(l => <span key={l} className="bg-white border text-[9px] px-1.5 rounded">{l} <button onClick={()=>removeItem('league',l)} className="text-red-400">x</button></span>)}</div>
                        </div>
                    </div>

                    {/* EVENT MATRIX (GRANULAR ACCOUNTS) */}
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                        <h3 className="font-black text-slate-800 text-sm mb-4">Automation Routing Matrix</h3>
                        
                        <div className="space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-200 px-2">
                                <div className="w-[30%] text-[9px] font-black text-slate-400 uppercase tracking-widest">Event</div>
                                <div className="w-[10%] flex justify-center text-[9px] font-bold text-blue-600">FB 1</div>
                                <div className="w-[10%] flex justify-center text-[9px] font-bold text-blue-400">FB 2</div>
                                <div className="w-[10%] flex justify-center text-[9px] font-bold text-slate-800">Make 1</div>
                                <div className="w-[10%] flex justify-center text-[9px] font-bold text-slate-600">Make 2</div>
                                <div className="w-[10%] flex justify-center text-[9px] font-bold text-blue-400">TG G</div>
                                <div className="w-[10%] flex justify-center text-[9px] font-bold text-yellow-600">TG VIP</div>
                            </div>
                            
                            {/* LIVE EVENTS */}
                            <div className="pt-2 pb-1 text-[8px] uppercase tracking-widest font-black text-slate-400">Live Triggers</div>
                            {liveEvents.map((key) => {
                                const config = events[key];
                                return (
                                <div key={key} className="flex items-center justify-between py-1.5 px-2 hover:bg-white rounded-lg transition-colors">
                                    <div className="w-[30%] font-bold text-slate-700 text-[10px]">{config.label}</div>
                                    <div className="w-[10%] flex justify-center"><button onClick={() => toggleEvent(key, 'fb1')} className={`w-6 h-3 rounded-full relative transition-colors ${config.fb1 ? 'bg-blue-600' : 'bg-slate-200'}`}><div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all ${config.fb1 ? 'left-3.5' : 'left-0.5'}`}></div></button></div>
                                    <div className="w-[10%] flex justify-center"><button onClick={() => toggleEvent(key, 'fb2')} className={`w-6 h-3 rounded-full relative transition-colors ${config.fb2 ? 'bg-blue-400' : 'bg-slate-200'}`}><div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all ${config.fb2 ? 'left-3.5' : 'left-0.5'}`}></div></button></div>
                                    <div className="w-[10%] flex justify-center"><button onClick={() => toggleEvent(key, 'make1')} className={`w-6 h-3 rounded-full relative transition-colors ${config.make1 ? 'bg-slate-800' : 'bg-slate-200'}`}><div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all ${config.make1 ? 'left-3.5' : 'left-0.5'}`}></div></button></div>
                                    <div className="w-[10%] flex justify-center"><button onClick={() => toggleEvent(key, 'make2')} className={`w-6 h-3 rounded-full relative transition-colors ${config.make2 ? 'bg-slate-500' : 'bg-slate-200'}`}><div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all ${config.make2 ? 'left-3.5' : 'left-0.5'}`}></div></button></div>
                                    <div className="w-[10%]"></div><div className="w-[10%]"></div>
                                </div>
                            )})}

                            {/* BACKGROUND EVENTS */}
                            <div className="pt-3 pb-1 text-[8px] uppercase tracking-widest font-black text-slate-400 border-t border-slate-200">Scheduled Scripts</div>
                            {backgroundEvents.map((key) => {
                                const config = events[key];
                                return (
                                <div key={key} className="flex items-center justify-between py-1.5 px-2 hover:bg-white rounded-lg transition-colors">
                                    <div className="w-[30%] font-bold text-slate-700 text-[10px]">{config.label}</div>
                                    <div className="w-[10%] flex justify-center">{config.fb1 !== undefined && <button onClick={() => toggleEvent(key, 'fb1')} className={`w-6 h-3 rounded-full relative transition-colors ${config.fb1 ? 'bg-blue-600' : 'bg-slate-200'}`}><div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all ${config.fb1 ? 'left-3.5' : 'left-0.5'}`}></div></button>}</div>
                                    <div className="w-[10%] flex justify-center">{config.fb2 !== undefined && <button onClick={() => toggleEvent(key, 'fb2')} className={`w-6 h-3 rounded-full relative transition-colors ${config.fb2 ? 'bg-blue-400' : 'bg-slate-200'}`}><div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all ${config.fb2 ? 'left-3.5' : 'left-0.5'}`}></div></button>}</div>
                                    <div className="w-[10%] flex justify-center">{config.make1 !== undefined && <button onClick={() => toggleEvent(key, 'make1')} className={`w-6 h-3 rounded-full relative transition-colors ${config.make1 ? 'bg-slate-800' : 'bg-slate-200'}`}><div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all ${config.make1 ? 'left-3.5' : 'left-0.5'}`}></div></button>}</div>
                                    <div className="w-[10%] flex justify-center">{config.make2 !== undefined && <button onClick={() => toggleEvent(key, 'make2')} className={`w-6 h-3 rounded-full relative transition-colors ${config.make2 ? 'bg-slate-500' : 'bg-slate-200'}`}><div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all ${config.make2 ? 'left-3.5' : 'left-0.5'}`}></div></button>}</div>
                                    <div className="w-[10%] flex justify-center">{config.tg_general !== undefined && <button onClick={() => toggleEvent(key, 'tg_general')} className={`w-6 h-3 rounded-full relative transition-colors ${config.tg_general ? 'bg-blue-400' : 'bg-slate-200'}`}><div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all ${config.tg_general ? 'left-3.5' : 'left-0.5'}`}></div></button>}</div>
                                    <div className="w-[10%] flex justify-center">{config.tg_vip !== undefined && <button onClick={() => toggleEvent(key, 'tg_vip')} className={`w-6 h-3 rounded-full relative transition-colors ${config.tg_vip ? 'bg-yellow-500' : 'bg-slate-200'}`}><div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all ${config.tg_vip ? 'left-3.5' : 'left-0.5'}`}></div></button>}</div>
                                </div>
                            )})}
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN */}
                <div className="space-y-6">
                    {/* API CREDENTIALS MANAGER */}
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                        <div className="flex items-center gap-2 mb-4">
                            <KeyRound size={16} className="text-red-500" />
                            <h3 className="font-black text-slate-800 text-sm">Webhooks & API Keys</h3>
                        </div>
                        <div className="space-y-3">
                            <div className="bg-white p-3 rounded-xl border border-slate-200">
                                <h4 className="text-[10px] font-black text-blue-600 mb-2 uppercase"><Facebook size={12} className="inline mr-1"/> FB Pages (Direct API)</h4>
                                <input type="text" placeholder="Page 1 ID" value={credentials.fb1_id} onChange={e => setCredentials({...credentials, fb1_id: e.target.value})} className="w-full mb-1 bg-slate-50 border rounded p-1.5 text-xs outline-none" />
                                <input type="password" placeholder="Page 1 Token" value={credentials.fb1_token} onChange={e => setCredentials({...credentials, fb1_token: e.target.value})} className="w-full mb-3 bg-slate-50 border rounded p-1.5 text-xs outline-none" />
                                
                                <input type="text" placeholder="Page 2 ID" value={credentials.fb2_id} onChange={e => setCredentials({...credentials, fb2_id: e.target.value})} className="w-full mb-1 bg-slate-50 border rounded p-1.5 text-xs outline-none" />
                                <input type="password" placeholder="Page 2 Token" value={credentials.fb2_token} onChange={e => setCredentials({...credentials, fb2_token: e.target.value})} className="w-full bg-slate-50 border rounded p-1.5 text-xs outline-none" />
                            </div>

                            <div className="bg-white p-3 rounded-xl border border-slate-200">
                                <h4 className="text-[10px] font-black text-slate-800 mb-2 uppercase"><Globe size={12} className="inline mr-1"/> Make / Activepieces Webhooks</h4>
                                <input type="text" placeholder="Webhook URL 1" value={credentials.make_webhook_1} onChange={e => setCredentials({...credentials, make_webhook_1: e.target.value})} className="w-full mb-2 bg-slate-50 border rounded p-1.5 text-xs outline-none" />
                                <input type="text" placeholder="Webhook URL 2" value={credentials.make_webhook_2} onChange={e => setCredentials({...credentials, make_webhook_2: e.target.value})} className="w-full bg-slate-50 border rounded p-1.5 text-xs outline-none" />
                            </div>
                        </div>
                    </div>

                    {/* TELEGRAM CHANNELS */}
                    <div className="bg-blue-50 p-5 rounded-2xl border border-blue-200">
                        <div className="flex items-center gap-2 mb-4"><Send size={16} className="text-blue-600" /><h3 className="font-black text-blue-900 text-sm">Telegram Manager</h3></div>
                        <input type="password" placeholder="Bot Token" value={credentials.telegram_bot_token} onChange={e => setCredentials({...credentials, telegram_bot_token: e.target.value})} className="w-full mb-4 bg-white border border-blue-200 rounded-xl p-2 text-xs outline-none shadow-sm" />
                        
                        {/* GENERAL CHANNELS */}
                        <div className="mb-4">
                            <h4 className="text-[10px] font-black text-blue-800 mb-2 uppercase tracking-widest">General Channels</h4>
                            <div className="bg-white p-2 rounded-lg border border-blue-200 mb-2 shadow-sm">
                                <div className="flex gap-2 mb-2">
                                    <input type="text" placeholder="Chat ID" value={newGenId} onChange={e => setNewGenId(e.target.value)} className="w-1/3 bg-slate-50 border rounded p-1 text-xs outline-none" />
                                    <input type="text" placeholder="Partner Link" value={newGenLink} onChange={e => setNewGenLink(e.target.value)} className="flex-1 bg-slate-50 border rounded p-1 text-xs outline-none" />
                                </div>
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
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="truncate text-xs font-black text-blue-800">{ch.chatId}</div>
                                            <button onClick={() => removeChannel('general', i)} className="text-red-400 hover:text-red-600"><CloseIcon size={14}/></button>
                                        </div>
                                        <div className="text-[9px] text-slate-400 truncate mb-1">{ch.link}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* FEATURED MATCH OVERRIDE */}
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