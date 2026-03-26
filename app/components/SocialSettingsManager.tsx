'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { Save, Loader2, Trophy, Globe, Facebook, Twitter, X as CloseIcon, Plus, AlertCircle } from 'lucide-react';

// Default matrix mirroring your current exact setup
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

    const [newTeam, setNewTeam] = useState('');
    const [newLeague, setNewLeague] = useState('');
    const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        const { data, error } = await supabase.from('site_settings').select('social_config').single();
        if (data?.social_config) {
            setVipTeams(data.social_config.vip_teams || []);
            setVipLeagues(data.social_config.vip_leagues || []);
            
            // Merge saved event toggles with defaults to preserve labels
            const savedEvents = data.social_config.events || {};
            const mergedEvents = { ...DEFAULT_EVENTS };
            Object.keys(mergedEvents).forEach(key => {
                if (savedEvents[key]) {
                    mergedEvents[key as keyof typeof DEFAULT_EVENTS].fb = savedEvents[key].fb;
                    mergedEvents[key as keyof typeof DEFAULT_EVENTS].x = savedEvents[key].x;
                }
            });
            setEvents(mergedEvents);
        }
        setIsLoading(false);
    };

    const handleSave = async () => {
        setIsSaving(true);
        setStatusMsg({ text: '', type: '' });

        const payload = {
            vip_teams: vipTeams,
            vip_leagues: vipLeagues,
            events: events
        };

        const { error } = await supabase
            .from('site_settings')
            .update({ social_config: payload })
            .eq('id', 1); // Assuming you have a single row with ID 1 for site settings

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
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Control VIP Triggers & Platform Routing</p>
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
                
                {/* LEFT COLUMN: VIP LISTS */}
                <div className="space-y-6">
                    {/* VIP Teams */}
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                        <div className="flex items-center gap-2 mb-4">
                            <Trophy size={16} className="text-amber-500" />
                            <h3 className="font-black text-slate-800 text-sm">VIP Teams & Nations</h3>
                        </div>
                        <div className="flex gap-2 mb-4">
                            <input 
                                type="text" 
                                value={newTeam} 
                                onChange={(e) => setNewTeam(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addItem('team')}
                                placeholder="e.g. Arsenal, Brazil..." 
                                className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-colors"
                            />
                            <button onClick={() => addItem('team')} className="bg-slate-800 text-white p-2 rounded-lg hover:bg-slate-700 transition-colors"><Plus size={20}/></button>
                        </div>
                        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
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
                                type="text" 
                                value={newLeague} 
                                onChange={(e) => setNewLeague(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addItem('league')}
                                placeholder="e.g. World Cup..." 
                                className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-colors"
                            />
                            <button onClick={() => addItem('league')} className="bg-slate-800 text-white p-2 rounded-lg hover:bg-slate-700 transition-colors"><Plus size={20}/></button>
                        </div>
                        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
                            {vipLeagues.map(league => (
                                <span key={league} className="inline-flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-black px-3 py-1.5 rounded-full shadow-sm">
                                    {league}
                                    <button onClick={() => removeItem('league', league)} className="text-slate-400 hover:text-red-500"><CloseIcon size={14} /></button>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: EVENT MATRIX */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                    <h3 className="font-black text-slate-800 text-sm mb-1">Platform Distribution Matrix</h3>
                    <p className="text-[10px] text-slate-500 font-bold mb-6 uppercase tracking-wider">Toggle which events trigger posts on which platforms.</p>
                    
                    <div className="space-y-3">
                        {/* Header Row */}
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200 px-2">
                            <div className="w-1/2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Match Event</div>
                            <div className="w-1/4 flex justify-center"><Facebook size={16} className="text-blue-600" /></div>
                            <div className="w-1/4 flex justify-center"><Twitter size={16} className="text-slate-800" /></div>
                        </div>

                        {/* Event Rows */}
                        {Object.entries(events).map(([key, config]: [string, any]) => (
                            <div key={key} className="flex items-center justify-between py-2 px-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200">
                                <div className="w-1/2 font-bold text-slate-700 text-xs">{config.label}</div>
                                
                                <div className="w-1/4 flex justify-center">
                                    <button 
                                        onClick={() => toggleEvent(key, 'fb')}
                                        className={`w-10 h-5 rounded-full relative transition-colors ${config.fb ? 'bg-blue-500' : 'bg-slate-300'}`}
                                    >
                                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${config.fb ? 'left-5' : 'left-0.5'}`}></div>
                                    </button>
                                </div>
                                
                                <div className="w-1/4 flex justify-center">
                                    <button 
                                        onClick={() => toggleEvent(key, 'x')}
                                        className={`w-10 h-5 rounded-full relative transition-colors ${config.x ? 'bg-slate-800' : 'bg-slate-300'}`}
                                    >
                                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${config.x ? 'left-5' : 'left-0.5'}`}></div>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}