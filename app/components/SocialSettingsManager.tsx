'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { Save, Loader2, Trophy, Globe, Facebook, Twitter, X as CloseIcon, Plus, AlertCircle, KeyRound, Send, Link as LinkIcon, Target } from 'lucide-react';

const DEFAULT_EVENTS = {
    goals: { fb: true, x: true, label: "Goals & Shootouts" },
    lineups: { fb: true, x: true, label: "Starting XI Lineups" },
    kickoff: { fb: true, x: true, label: "Match Kick-Off" },
    fulltime: { fb: true, x: true, label: "Full Time Results" },
    halftime: { fb: true, x: false, label: "Half Time Scores" },
    var_overturn: { fb: true, x: false, label: "VAR Overturns" },
    penalty_awarded: { fb: true, x: false, label: "Penalty Awarded" },
    daily_preview: { fb: true, x: true, tg_general: true, label: "Morning Daily Preview" },
    daily_summary: { fb: true, x: true, tg_general: true, label: "Evening Matchday Summary" },
    free_tips: { fb: true, x: true, tg_general: true, label: "Free Bet of the Day" },
    vip_tips: { tg_vip: true, label: "Pro AI Analysis (VIP Only)" }
};

export default function SocialSettingsManager() {
    const supabase = createClient();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    const [vipTeams, setVipTeams] = useState<string[]>([]);
    const [vipLeagues, setVipLeagues] = useState<string[]>([]);
    const [events, setEvents] = useState<any>(DEFAULT_EVENTS);
    
    // 🟢 FIXED: Removed the old single-channel IDs to satisfy TypeScript
    const [credentials, setCredentials] = useState({
        fb1_id: '', fb1_token: '',
        fb2_id: '', fb2_token: '',
        make_webhook_1: '', make_webhook_2: '',
        telegram_bot_token: '',
        betting_partner_link: '' 
    });

    const [tgGeneralChannels, setTgGeneralChannels] = useState<{chatId: string, link: string}[]>([]);
    const [tgVipChannels, setTgVipChannels] = useState<{chatId: string, link: string}[]>([]);
    
    const [newGenId, setNewGenId] = useState('');
    const [newGenLink, setNewGenLink] = useState('');
    const [newVipId, setNewVipId] = useState('');
    const [newVipLink, setNewVipLink] = useState('');

    const [newTeam, setNewTeam] = useState('');
    const [newLeague, setNewLeague] = useState('');
    const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });

    const [dbLeagues, setDbLeagues] = useState<string[]>([]);
    const [dbTeams, setDbTeams] = useState<string[]>([]);
    
    const [upcomingMatches, setUpcomingMatches] = useState<any[]>([]);
    const [featuredMatchId, setFeaturedMatchId] = useState<string>('');

    useEffect(() => {
        loadSettingsAndData();
    }, []);

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

            setTgGeneralChannels(savedCreds.tg_general_channels || []);
            setTgVipChannels(savedCreds.tg_vip_channels || []);
            
            const savedEvents = settingsData.social_config.events || {};
            const mergedEvents = { ...DEFAULT_EVENTS };
            Object.keys(mergedEvents).forEach(key => {
                if (savedEvents[key]) {
                    mergedEvents[key as keyof typeof DEFAULT_EVENTS].fb = savedEvents[key].fb ?? mergedEvents[key as keyof typeof DEFAULT_EVENTS].fb;
                    mergedEvents[key as keyof typeof DEFAULT_EVENTS].x = savedEvents[key].x ?? mergedEvents[key as keyof typeof DEFAULT_EVENTS].x;
                    if (mergedEvents[key as keyof typeof DEFAULT_EVENTS].tg_general !== undefined) {
                        mergedEvents[key as keyof typeof DEFAULT_EVENTS].tg_general = savedEvents[key].tg_general ?? mergedEvents[key as keyof typeof DEFAULT_EVENTS].tg_general;
                    }
                    if (mergedEvents[key as keyof typeof DEFAULT_EVENTS].tg_vip !== undefined) {
                        mergedEvents[key as keyof typeof DEFAULT_EVENTS].tg_vip = savedEvents[key].tg_vip ?? mergedEvents[key as keyof typeof DEFAULT_EVENTS].tg_vip;
                    }
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
            vip_teams: vipTeams,
            vip_leagues: vipLeagues,
            events: events,
            featured_match_id: featuredMatchId || null, 
            credentials: {
                ...credentials,
                tg_general_channels: tgGeneralChannels,
                tg_vip_channels: tgVipChannels
            } 
        };

        const { error } = await supabase
            .from('site_settings')
            .update({ social_config: payload })
            .eq('id', 1);

        if (error) {
            setStatusMsg({ text: 'Failed to save settings.', type: 'error' });
        } else {
            setStatusMsg({ text: 'Social settings updated successfully.', type: 'success' });
        }
        setIsSaving(false);
        setTimeout(() => setStatusMsg({ text: '', type: '' }), 3000);
    };

    const addItem = (type: 'team' | 'league') => {
        if (type === 'team' && newTeam.trim() && !vipTeams.includes(newTeam.trim())) {
            setVipTeams([...vipTeams, newTeam.trim()]);
            setNewTeam('');
        } else if (type === 'league' && newLeague.trim() && !vipLeagues.includes(newLeague.trim())) {
            setVipLeagues([...vipLeagues, newLeague.trim()]);
            setNewLeague('');
        }
    };

    const removeItem = (type: 'team' | 'league', itemToRemove: string) => {
        if (type === 'team') setVipTeams(vipTeams.filter(t => t !== itemToRemove));
        if (type === 'league') setVipLeagues(vipLeagues.filter(l => l !== itemToRemove));
    };

    const toggleEvent = (eventKey: string, platform: 'fb' | 'x' | 'tg_general' | 'tg_vip') => {
        setEvents((prev: any) => ({
            ...prev,
            [eventKey]: {
                ...prev[eventKey],
                [platform]: !prev[eventKey][platform]
            }
        }));
    };

    const addChannel = (type: 'general' | 'vip') => {
        if (type === 'general' && newGenId.trim()) {
            setTgGeneralChannels([...tgGeneralChannels, { chatId: newGenId.trim(), link: newGenLink.trim() || 'https://factsport.com' }]);
            setNewGenId(''); setNewGenLink('');
        } else if (type === 'vip' && newVipId.trim()) {
            setTgVipChannels([...tgVipChannels, { chatId: newVipId.trim(), link: newVipLink.trim() || 'https://factsport.com' }]);
            setNewVipId(''); setNewVipLink('');
        }
    };

    const removeChannel = (type: 'general' | 'vip', index: number) => {
        if (type === 'general') {
            setTgGeneralChannels(tgGeneralChannels.filter((_, i) => i !== index));
        } else {
            setTgVipChannels(tgVipChannels.filter((_, i) => i !== index));
        }
    };

    if (isLoading) return <div className="h-64 flex items-center justify-center bg-white rounded-3xl border border-slate-200"><Loader2 className="animate-spin text-blue-500" size={32} /></div>;

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
                <button 
                    onClick={handleSave} 
                    disabled={isSaving}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-md shadow-blue-500/20 disabled:opacity-50"
                >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {isSaving ? 'Saving...' : 'Save Settings'}
                </button>
            </div>

            {statusMsg.text && (
                <div className={`p-3 text-xs font-bold text-center flex items-center justify-center gap-2 ${statusMsg.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    <AlertCircle size={14} /> {statusMsg.text}
                </div>
            )}

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* LEFT COLUMN */}
                <div className="space-y-6">
                    {/* FEATURED MATCH OVERRIDE */}
                    <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200">
                        <div className="flex items-center gap-2 mb-4">
                            <Target size={16} className="text-amber-600" />
                            <h3 className="font-black text-amber-900 text-sm">Free Bet of the Day (Override)</h3>
                        </div>
                        <p className="text-[10px] text-amber-700 font-bold mb-3 uppercase tracking-wider">Select a specific match to feature globally. Leave blank to auto-pick the last match of the day.</p>
                        <select 
                            value={featuredMatchId} 
                            onChange={(e) => setFeaturedMatchId(e.target.value)}
                            className="w-full bg-white border border-amber-300 rounded-lg p-3 text-xs font-bold text-slate-800 outline-none focus:border-amber-500"
                        >
                            <option value="">⚡ Auto-Select (Latest Match of the Day)</option>
                            {upcomingMatches.map(m => (
                                <option key={m.id} value={m.id}>
                                    {new Date(m.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - {m.home_team} vs {m.away_team}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* VIP Teams */}
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                        <div className="flex items-center gap-2 mb-4">
                            <Trophy size={16} className="text-amber-500" />
                            <h3 className="font-black text-slate-800 text-sm">VIP Teams & Nations</h3>
                        </div>
                        <div className="flex gap-2 mb-4">
                            <input 
                                type="text" list="db-teams-list"
                                value={newTeam} onChange={(e) => setNewTeam(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addItem('team')}
                                placeholder="Search DB or type a new team..." 
                                className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-colors"
                            />
                            <datalist id="db-teams-list">
                                {dbTeams.map(team => <option key={team} value={team} />)}
                            </datalist>
                            <button onClick={() => addItem('team')} className="bg-slate-800 text-white p-2 rounded-lg hover:bg-slate-700 transition-colors"><Plus size={20}/></button>
                        </div>
                        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1 styled-scrollbar">
                            {vipTeams.map(team => (
                                <span key={team} className="inline-flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-black px-3 py-1.5 rounded-full shadow-sm">
                                    {team}
                                    <button onClick={() => removeItem('team', team)} className="text-slate-400 hover:text-red-500"><CloseIcon size={14} /></button>
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* VIP Leagues */}
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                        <div className="flex items-center gap-2 mb-4">
                            <Globe size={16} className="text-blue-500" />
                            <h3 className="font-black text-slate-800 text-sm">VIP Competitions (World Cup, Euros)</h3>
                        </div>
                        <div className="flex gap-2 mb-4">
                            <input 
                                type="text" list="db-leagues-list"
                                value={newLeague} onChange={(e) => setNewLeague(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addItem('league')}
                                placeholder="Search DB or type a new league..." 
                                className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-colors"
                            />
                            <datalist id="db-leagues-list">
                                {dbLeagues.map(league => <option key={league} value={league} />)}
                            </datalist>
                            <button onClick={() => addItem('league')} className="bg-slate-800 text-white p-2 rounded-lg hover:bg-slate-700 transition-colors"><Plus size={20}/></button>
                        </div>
                        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1 styled-scrollbar">
                            {vipLeagues.map(league => (
                                <span key={league} className="inline-flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-black px-3 py-1.5 rounded-full shadow-sm">
                                    {league}
                                    <button onClick={() => removeItem('league', league)} className="text-slate-400 hover:text-red-500"><CloseIcon size={14} /></button>
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* MULTI-CHANNEL TELEGRAM MANAGER */}
                    <div className="bg-blue-50 p-5 rounded-2xl border border-blue-200">
                        <div className="flex items-center gap-2 mb-4">
                            <Send size={16} className="text-blue-600" />
                            <h3 className="font-black text-blue-900 text-sm">Telegram Channels & Links</h3>
                        </div>
                        <input type="password" placeholder="Master Bot Token (e.g. 123456:ABC-DEF)" value={credentials.telegram_bot_token} onChange={e => setCredentials({...credentials, telegram_bot_token: e.target.value})} className="w-full mb-6 bg-white border border-blue-200 rounded-xl p-3 text-xs outline-none focus:border-blue-500 shadow-sm" />
                        
                        {/* GENERAL CHANNELS */}
                        <div className="mb-6">
                            <h4 className="text-[10px] font-black text-blue-800 mb-2 uppercase tracking-widest">General Channels</h4>
                            <div className="flex gap-2 mb-3">
                                <input type="text" placeholder="Chat ID (@group)" value={newGenId} onChange={e => setNewGenId(e.target.value)} className="w-1/3 bg-white border border-blue-200 rounded p-2 text-xs outline-none" />
                                <input type="text" placeholder="Partner Link (e.g. Melbet)" value={newGenLink} onChange={e => setNewGenLink(e.target.value)} className="flex-1 bg-white border border-blue-200 rounded p-2 text-xs outline-none" />
                                <button onClick={() => addChannel('general')} className="bg-blue-600 text-white px-3 rounded hover:bg-blue-700"><Plus size={16}/></button>
                            </div>
                            <div className="space-y-2">
                                {tgGeneralChannels.map((ch, i) => (
                                    <div key={i} className="flex items-center justify-between bg-white border border-blue-100 p-2 rounded-lg shadow-sm">
                                        <div className="truncate text-xs"><span className="font-bold text-blue-800">{ch.chatId}</span> <span className="text-slate-400 text-[10px] ml-2 truncate">{ch.link}</span></div>
                                        <button onClick={() => removeChannel('general', i)} className="text-red-400 hover:text-red-600"><CloseIcon size={14}/></button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* VIP CHANNELS */}
                        <div>
                            <h4 className="text-[10px] font-black text-amber-600 mb-2 uppercase tracking-widest">VIP Channels</h4>
                            <div className="flex gap-2 mb-3">
                                <input type="text" placeholder="Chat ID (-100...)" value={newVipId} onChange={e => setNewVipId(e.target.value)} className="w-1/3 bg-white border border-amber-200 rounded p-2 text-xs outline-none" />
                                <input type="text" placeholder="Partner Link (e.g. Melbet)" value={newVipLink} onChange={e => setNewVipLink(e.target.value)} className="flex-1 bg-white border border-amber-200 rounded p-2 text-xs outline-none" />
                                <button onClick={() => addChannel('vip')} className="bg-amber-500 text-white px-3 rounded hover:bg-amber-600"><Plus size={16}/></button>
                            </div>
                            <div className="space-y-2">
                                {tgVipChannels.map((ch, i) => (
                                    <div key={i} className="flex items-center justify-between bg-white border border-amber-100 p-2 rounded-lg shadow-sm">
                                        <div className="truncate text-xs"><span className="font-bold text-amber-700">{ch.chatId}</span> <span className="text-slate-400 text-[10px] ml-2 truncate">{ch.link}</span></div>
                                        <button onClick={() => removeChannel('vip', i)} className="text-red-400 hover:text-red-600"><CloseIcon size={14}/></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN */}
                <div className="space-y-6">
                    {/* EVENT MATRIX */}
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                        <h3 className="font-black text-slate-800 text-sm mb-1">Live Updates Matrix</h3>
                        <p className="text-[10px] text-slate-500 font-bold mb-4 uppercase tracking-wider">Fired by Cloudflare Worker instantly.</p>
                        
                        <div className="space-y-3 mb-6">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-200 px-2">
                                <div className="w-1/2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Match Event</div>
                                <div className="w-1/4 flex justify-center"><Facebook size={16} className="text-blue-600" /></div>
                                <div className="w-1/4 flex justify-center"><Twitter size={16} className="text-slate-800" /></div>
                            </div>
                            {liveEvents.map((key) => {
                                const config = events[key];
                                return (
                                <div key={key} className="flex items-center justify-between py-2 px-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200">
                                    <div className="w-1/2 font-bold text-slate-700 text-xs">{config.label}</div>
                                    <div className="w-1/4 flex justify-center">
                                        <button onClick={() => toggleEvent(key, 'fb')} className={`w-10 h-5 rounded-full relative transition-colors ${config.fb ? 'bg-blue-500' : 'bg-slate-300'}`}><div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${config.fb ? 'left-5' : 'left-0.5'}`}></div></button>
                                    </div>
                                    <div className="w-1/4 flex justify-center">
                                        <button onClick={() => toggleEvent(key, 'x')} className={`w-10 h-5 rounded-full relative transition-colors ${config.x ? 'bg-slate-800' : 'bg-slate-300'}`}><div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${config.x ? 'left-5' : 'left-0.5'}`}></div></button>
                                    </div>
                                </div>
                            )})}
                        </div>

                        {/* BACKGROUND SCRIPT MATRIX */}
                        <h3 className="font-black text-slate-800 text-sm mb-1 mt-6 border-t border-slate-200 pt-4">Content Automation Matrix</h3>
                        <p className="text-[10px] text-slate-500 font-bold mb-4 uppercase tracking-wider">Fired by Node.js Cron Scripts.</p>
                        
                        <div className="space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-200 px-2">
                                <div className="w-2/5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Content Type</div>
                                <div className="w-[15%] flex justify-center"><Facebook size={14} className="text-blue-600" /></div>
                                <div className="w-[15%] flex justify-center"><Twitter size={14} className="text-slate-800" /></div>
                                <div className="w-[15%] flex justify-center"><Send size={14} className="text-blue-400" /> Gen</div>
                                <div className="w-[15%] flex justify-center"><Send size={14} className="text-yellow-500" /> VIP</div>
                            </div>
                            {backgroundEvents.map((key) => {
                                const config = events[key];
                                return (
                                <div key={key} className="flex items-center justify-between py-2 px-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200">
                                    <div className="w-2/5 font-bold text-slate-700 text-xs">{config.label}</div>
                                    <div className="w-[15%] flex justify-center">
                                        {config.fb !== undefined && <button onClick={() => toggleEvent(key, 'fb')} className={`w-8 h-4 rounded-full relative transition-colors ${config.fb ? 'bg-blue-500' : 'bg-slate-300'}`}><div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${config.fb ? 'left-4' : 'left-0.5'}`}></div></button>}
                                    </div>
                                    <div className="w-[15%] flex justify-center">
                                        {config.x !== undefined && <button onClick={() => toggleEvent(key, 'x')} className={`w-8 h-4 rounded-full relative transition-colors ${config.x ? 'bg-slate-800' : 'bg-slate-300'}`}><div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${config.x ? 'left-4' : 'left-0.5'}`}></div></button>}
                                    </div>
                                    <div className="w-[15%] flex justify-center">
                                        {config.tg_general !== undefined && <button onClick={() => toggleEvent(key, 'tg_general')} className={`w-8 h-4 rounded-full relative transition-colors ${config.tg_general ? 'bg-blue-400' : 'bg-slate-300'}`}><div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${config.tg_general ? 'left-4' : 'left-0.5'}`}></div></button>}
                                    </div>
                                    <div className="w-[15%] flex justify-center">
                                        {config.tg_vip !== undefined && <button onClick={() => toggleEvent(key, 'tg_vip')} className={`w-8 h-4 rounded-full relative transition-colors ${config.tg_vip ? 'bg-yellow-500' : 'bg-slate-300'}`}><div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${config.tg_vip ? 'left-4' : 'left-0.5'}`}></div></button>}
                                    </div>
                                </div>
                            )})}
                        </div>
                    </div>

                    {/* API CREDENTIALS MANAGER */}
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                        <div className="flex items-center gap-2 mb-4">
                            <KeyRound size={16} className="text-red-500" />
                            <h3 className="font-black text-slate-800 text-sm">Make & Facebook Webhooks</h3>
                        </div>
                        <div className="space-y-4">
                            <div className="bg-white p-3 rounded-xl border border-slate-200">
                                <h4 className="text-[10px] font-black text-blue-600 mb-2 flex items-center gap-1 uppercase tracking-widest"><Facebook size={12}/> FB Page 1 (Primary)</h4>
                                <input type="text" placeholder="Page ID" value={credentials.fb1_id} onChange={e => setCredentials({...credentials, fb1_id: e.target.value})} className="w-full mb-2 bg-slate-50 border border-slate-200 rounded p-2 text-xs outline-none focus:border-blue-400" />
                                <input type="password" placeholder="Access Token" value={credentials.fb1_token} onChange={e => setCredentials({...credentials, fb1_token: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs outline-none focus:border-blue-400" />
                            </div>

                            <div className="bg-white p-3 rounded-xl border border-slate-200">
                                <h4 className="text-[10px] font-black text-blue-600 mb-2 flex items-center gap-1 uppercase tracking-widest"><Facebook size={12}/> FB Page 2 (Secondary)</h4>
                                <input type="text" placeholder="Page ID" value={credentials.fb2_id} onChange={e => setCredentials({...credentials, fb2_id: e.target.value})} className="w-full mb-2 bg-slate-50 border border-slate-200 rounded p-2 text-xs outline-none focus:border-blue-400" />
                                <input type="password" placeholder="Access Token" value={credentials.fb2_token} onChange={e => setCredentials({...credentials, fb2_token: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs outline-none focus:border-blue-400" />
                            </div>

                            <div className="bg-white p-3 rounded-xl border border-slate-200">
                                <h4 className="text-[10px] font-black text-slate-800 mb-2 flex items-center gap-1 uppercase tracking-widest"><Globe size={12}/> Make.com Routers (For X)</h4>
                                <input type="text" placeholder="Make Webhook 1 URL" value={credentials.make_webhook_1} onChange={e => setCredentials({...credentials, make_webhook_1: e.target.value})} className="w-full mb-2 bg-slate-50 border border-slate-200 rounded p-2 text-xs outline-none focus:border-slate-800" />
                                <input type="text" placeholder="Make Webhook 2 URL" value={credentials.make_webhook_2} onChange={e => setCredentials({...credentials, make_webhook_2: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs outline-none focus:border-slate-800" />
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}