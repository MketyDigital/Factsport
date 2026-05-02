'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { Save, Loader2, Trophy, Globe, Facebook, Twitter, X as CloseIcon, Plus, AlertCircle, KeyRound } from 'lucide-react';

const DEFAULT_EVENTS = {
    goals: { fb: true, x: true, label: "Goals & Shootouts" },
    lineups: { fb: true, x: true, label: "Starting XI Lineups" },
    kickoff: { fb: true, x: true, label: "Match Kick-Off" },
    fulltime: { fb: true, x: true, label: "Full Time Results" },
    halftime: { fb: true, x: false, label: "Half Time Scores" },
    var_overturn: { fb: true, x: false, label: "VAR Overturns" },
    penalty_awarded: { fb: true, x: false, label: "Penalty Awarded" }
};

export default function SocialSettingsManager() {
    const supabase = createClient();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    const [vipTeams, setVipTeams] = useState<string[]>([]);
    const [vipLeagues, setVipLeagues] = useState<string[]>([]);
    const [events, setEvents] = useState<any>(DEFAULT_EVENTS);
    
    // 🟢 NEW: Credentials State
    const [credentials, setCredentials] = useState({
        fb1_id: '', fb1_token: '',
        fb2_id: '', fb2_token: '',
        make_webhook_1: '', make_webhook_2: ''
    });

    const [newTeam, setNewTeam] = useState('');
    const [newLeague, setNewLeague] = useState('');
    const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });

    const [dbLeagues, setDbLeagues] = useState<string[]>([]);
    const [dbTeams, setDbTeams] = useState<string[]>([]);

    useEffect(() => {
        loadSettingsAndData();
    }, []);

    const loadSettingsAndData = async () => {
        setIsLoading(true);

        const { data: settingsData } = await supabase.from('site_settings').select('social_config').single();
        if (settingsData?.social_config) {
            setVipTeams(settingsData.social_config.vip_teams || []);
            setVipLeagues(settingsData.social_config.vip_leagues || []);
            setCredentials(settingsData.social_config.credentials || { fb1_id: '', fb1_token: '', fb2_id: '', fb2_token: '', make_webhook_1: '', make_webhook_2: '' });
            
            const savedEvents = settingsData.social_config.events || {};
            const mergedEvents = { ...DEFAULT_EVENTS };
            Object.keys(mergedEvents).forEach(key => {
                if (savedEvents[key]) {
                    mergedEvents[key as keyof typeof DEFAULT_EVENTS].fb = savedEvents[key].fb;
                    mergedEvents[key as keyof typeof DEFAULT_EVENTS].x = savedEvents[key].x;
                }
            });
            setEvents(mergedEvents);
        }

        const { data: matchData } = await supabase.from('matches').select('league, home_team, away_team');
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

        setIsLoading(false);
    };

    const handleSave = async () => {
        setIsSaving(true);
        setStatusMsg({ text: '', type: '' });

        const payload = {
            vip_teams: vipTeams,
            vip_leagues: vipLeagues,
            events: events,
            credentials: credentials // 🟢 NEW: Saving credentials safely
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

    const toggleEvent = (eventKey: string, platform: 'fb' | 'x') => {
        setEvents((prev: any) => ({
            ...prev,
            [eventKey]: {
                ...prev[eventKey],
                [platform]: !prev[eventKey][platform]
            }
        }));
    };

    if (isLoading) return <div className="h-64 flex items-center justify-center bg-white rounded-3xl border border-slate-200"><Loader2 className="animate-spin text-blue-500" size={32} /></div>;

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
                        <p className="text-[10px] text-slate-500 font-bold mb-3 uppercase tracking-wider">Overrides teams. Posts ALL matches in these leagues.</p>
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
                </div>

                {/* RIGHT COLUMN */}
                <div className="space-y-6">
                    {/* EVENT MATRIX */}
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                        <h3 className="font-black text-slate-800 text-sm mb-1">Platform Distribution Matrix</h3>
                        <p className="text-[10px] text-slate-500 font-bold mb-6 uppercase tracking-wider">Toggle which events trigger posts on which platforms.</p>
                        
                        <div className="space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-200 px-2">
                                <div className="w-1/2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Match Event</div>
                                <div className="w-1/4 flex justify-center"><Facebook size={16} className="text-blue-600" /></div>
                                <div className="w-1/4 flex justify-center"><Twitter size={16} className="text-slate-800" /></div>
                            </div>

                            {Object.entries(events).map(([key, config]: [string, any]) => (
                                <div key={key} className="flex items-center justify-between py-2 px-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200">
                                    <div className="w-1/2 font-bold text-slate-700 text-xs">{config.label}</div>
                                    <div className="w-1/4 flex justify-center">
                                        <button onClick={() => toggleEvent(key, 'fb')} className={`w-10 h-5 rounded-full relative transition-colors ${config.fb ? 'bg-blue-500' : 'bg-slate-300'}`}>
                                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${config.fb ? 'left-5' : 'left-0.5'}`}></div>
                                        </button>
                                    </div>
                                    <div className="w-1/4 flex justify-center">
                                        <button onClick={() => toggleEvent(key, 'x')} className={`w-10 h-5 rounded-full relative transition-colors ${config.x ? 'bg-slate-800' : 'bg-slate-300'}`}>
                                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${config.x ? 'left-5' : 'left-0.5'}`}></div>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 🟢 NEW: API CREDENTIALS MANAGER */}
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                        <div className="flex items-center gap-2 mb-4">
                            <KeyRound size={16} className="text-red-500" />
                            <h3 className="font-black text-slate-800 text-sm">API Integrations & Webhooks</h3>
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold mb-4 uppercase tracking-wider">Leave blank to use default .env variables.</p>
                        
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
                                <h4 className="text-[10px] font-black text-slate-800 mb-2 flex items-center gap-1 uppercase tracking-widest"><Globe size={12}/> Make.com Routers (For X & Others)</h4>
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