'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { Trophy, Calendar, Save, Plus, Loader2, Target, Zap, Trash2, Globe, Crown } from 'lucide-react';

export default function AdminCampaignManager() {
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [campaigns, setCampaigns] = useState<any[]>([]);
    
    const [isEditing, setIsEditing] = useState(false);
    const [leagueInput, setLeagueInput] = useState('');
    const [formData, setFormData] = useState({
        id: '', 
        title: '', 
        type: 'WEEKEND_GIVEAWAY', 
        start_date: '', 
        end_date: '', 
        is_active: true, 
        is_vip_required: true, 
        target_leagues: [] as string[],
        rules: { 
            min_points_floor: 50, 
            points_outcome: 5, 
            points_score: 20, 
            require_score: false, 
            points_first_scorer: 15, 
            points_red_card: 5, 
            points_penalty: 5 
        }
    });

    useEffect(() => { 
        fetchCampaigns(); 
    }, []);

    const fetchCampaigns = async () => {
        setLoading(true);
        const { data } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
        if (data) setCampaigns(data);
        setLoading(false);
    };

    const handleSave = async () => {
        if (!formData.title || !formData.start_date || !formData.end_date) {
            return alert("Please fill in the title and dates.");
        }
        
        setSaving(true);
        
        const payload = {
            title: formData.title, 
            type: formData.type, 
            start_date: new Date(formData.start_date).toISOString(), 
            end_date: new Date(formData.end_date).toISOString(),
            is_active: formData.is_active, 
            is_vip_required: formData.is_vip_required, 
            target_leagues: formData.target_leagues, 
            rules: formData.rules
        };

        if (formData.id) {
            await supabase.from('campaigns').update(payload).eq('id', formData.id);
        } else {
            await supabase.from('campaigns').insert([payload]);
        }

        await fetchCampaigns(); 
        resetForm(); 
        setSaving(false);
    };

    const toggleActive = async (id: string, currentStatus: boolean) => {
        await supabase.from('campaigns').update({ is_active: !currentStatus }).eq('id', id); 
        fetchCampaigns();
    };

    const deleteCampaign = async (id: string) => {
        if(!confirm("Delete campaign and its leaderboard?")) return;
        await supabase.from('campaigns').delete().eq('id', id); 
        fetchCampaigns();
    };

    const editCampaign = (camp: any) => {
        const r = camp.rules || {};
        setFormData({
            id: camp.id, 
            title: camp.title, 
            type: camp.type, 
            start_date: new Date(camp.start_date).toISOString().slice(0, 16), 
            end_date: new Date(camp.end_date).toISOString().slice(0, 16),
            is_active: camp.is_active, 
            is_vip_required: camp.is_vip_required ?? true, 
            target_leagues: camp.target_leagues || [],
            rules: { 
                min_points_floor: r.min_points_floor ?? 50, 
                points_outcome: r.points_outcome ?? 5, 
                points_score: r.points_score ?? 20, 
                require_score: r.require_score ?? false, 
                points_first_scorer: r.points_first_scorer ?? 15, 
                points_red_card: r.points_red_card ?? 5, 
                points_penalty: r.points_penalty ?? 5 
            }
        });
        setIsEditing(true);
    };

    const resetForm = () => {
        setFormData({ 
            id: '', 
            title: '', 
            type: 'WEEKEND_GIVEAWAY', 
            start_date: '', 
            end_date: '', 
            is_active: true, 
            is_vip_required: true, 
            target_leagues: [], 
            rules: { 
                min_points_floor: 50, 
                points_outcome: 5, 
                points_score: 20, 
                require_score: false, 
                points_first_scorer: 15, 
                points_red_card: 5, 
                points_penalty: 5 
            } 
        });
        setLeagueInput(''); 
        setIsEditing(false);
    };

    const addLeague = () => {
        if (leagueInput.trim() && !formData.target_leagues.includes(leagueInput.trim())) { 
            setFormData({ ...formData, target_leagues: [...formData.target_leagues, leagueInput.trim()] }); 
            setLeagueInput(''); 
        }
    };

    if (loading) return <div className="p-6 text-center text-slate-400 animate-pulse">Loading Campaigns...</div>;

    return (
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden mt-8 mb-8">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-lg">
                        <Trophy size={20} />
                    </div>
                    <div>
                        <h2 className="font-black text-lg tracking-tight">Campaign Gamification Engine</h2>
                        <p className="text-[10px] text-amber-100 font-bold uppercase tracking-widest mt-0.5">Manage Custom Tournaments & Points</p>
                    </div>
                </div>
                {!isEditing && (
                    <button 
                        onClick={() => setIsEditing(true)} 
                        className="flex items-center gap-2 bg-white text-orange-600 px-4 py-2 rounded-xl font-black text-xs uppercase hover:bg-amber-50 transition shadow-md active:scale-95"
                    >
                        <Plus size={16} /> New Campaign
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
                {isEditing && (
                    <div className="lg:col-span-5 p-6 bg-slate-50 border-r border-slate-100">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-black text-sm text-slate-800 uppercase tracking-widest">
                                {formData.id ? 'Edit Campaign' : 'New Campaign'}
                            </h3>
                            <button onClick={resetForm} className="text-xs text-slate-400 font-bold hover:text-slate-600">
                                Cancel
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Title</label>
                                <input 
                                    type="text" 
                                    value={formData.title} 
                                    onChange={e => setFormData({...formData, title: e.target.value})} 
                                    placeholder="e.g. World Cup Predictor" 
                                    className="w-full border border-slate-200 rounded-xl p-3 text-sm font-bold focus:border-orange-500 outline-none" 
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Start</label>
                                    <input 
                                        type="datetime-local" 
                                        value={formData.start_date} 
                                        onChange={e => setFormData({...formData, start_date: e.target.value})} 
                                        className="w-full border border-slate-200 rounded-xl p-3 text-xs font-bold focus:border-orange-500 outline-none" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">End</label>
                                    <input 
                                        type="datetime-local" 
                                        value={formData.end_date} 
                                        onChange={e => setFormData({...formData, end_date: e.target.value})} 
                                        className="w-full border border-slate-200 rounded-xl p-3 text-xs font-bold focus:border-orange-500 outline-none" 
                                    />
                                </div>
                            </div>

                            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
                                <h4 className="text-[10px] font-black text-orange-500 uppercase tracking-widest flex items-center gap-1">
                                    <Crown size={12}/> Entry Requirements
                                </h4>
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={formData.is_vip_required} 
                                        onChange={e => setFormData({...formData, is_vip_required: e.target.checked})} 
                                        className="w-4 h-4 rounded text-orange-500"
                                    /> 
                                    Require VIP Status to Win
                                </label>
                                <p className="text-[9px] text-slate-400 italic ml-6 leading-tight">
                                    If unchecked, any registered user can qualify for prizes in this specific campaign.
                                </p>
                            </div>

                            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
                                <h4 className="text-[10px] font-black text-orange-500 uppercase tracking-widest flex items-center gap-1">
                                    <Globe size={12}/> Auto-Target Leagues
                                </h4>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={leagueInput} 
                                        onChange={e => setLeagueInput(e.target.value)} 
                                        onKeyDown={e => e.key === 'Enter' && addLeague()} 
                                        placeholder="e.g. World Cup" 
                                        className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold focus:border-orange-500 outline-none" 
                                    />
                                    <button onClick={addLeague} className="bg-slate-800 text-white p-2 rounded-lg hover:bg-slate-700 transition">
                                        <Plus size={16}/>
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {formData.target_leagues.map(l => (
                                        <span key={l} className="bg-slate-100 text-[10px] font-bold px-2 py-1 rounded border border-slate-200 flex items-center gap-1">
                                            {l} 
                                            <button onClick={() => setFormData({...formData, target_leagues: formData.target_leagues.filter(x => x !== l)})} className="text-red-500 hover:text-red-700 font-black">
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
                                <h4 className="text-[10px] font-black text-orange-500 uppercase tracking-widest flex items-center gap-1">
                                    <Zap size={12}/> Points & Rules
                                </h4>
                                <div>
                                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Min. Points Required to Win (Floor)</label>
                                    <input 
                                        type="number" 
                                        value={formData.rules.min_points_floor} 
                                        onChange={e => setFormData({...formData, rules: {...formData.rules, min_points_floor: parseInt(e.target.value)}})} 
                                        className="w-full bg-orange-50 border border-orange-200 text-orange-700 rounded-lg p-2 text-sm font-black text-center outline-none focus:border-orange-400" 
                                    />
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3 mt-3 border-t border-slate-100 pt-3">
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-400 uppercase">Outcome Pts</label>
                                        <input 
                                            type="number" 
                                            value={formData.rules.points_outcome} 
                                            onChange={e => setFormData({...formData, rules: {...formData.rules, points_outcome: parseInt(e.target.value)}})} 
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm font-black text-center outline-none focus:border-orange-400" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-400 uppercase">Exact Score Pts</label>
                                        <input 
                                            type="number" 
                                            value={formData.rules.points_score} 
                                            onChange={e => setFormData({...formData, rules: {...formData.rules, points_score: parseInt(e.target.value)}})} 
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm font-black text-center outline-none focus:border-orange-400" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-400 uppercase">First Scorer Pts</label>
                                        <input 
                                            type="number" 
                                            value={formData.rules.points_first_scorer} 
                                            onChange={e => setFormData({...formData, rules: {...formData.rules, points_first_scorer: parseInt(e.target.value)}})} 
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm font-black text-center outline-none focus:border-orange-400" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-400 uppercase">Card/Pen Pts</label>
                                        <input 
                                            type="number" 
                                            value={formData.rules.points_penalty} 
                                            onChange={e => setFormData({...formData, rules: {...formData.rules, points_penalty: parseInt(e.target.value), points_red_card: parseInt(e.target.value)}})} 
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm font-black text-center outline-none focus:border-orange-400" 
                                        />
                                    </div>
                                </div>
                                
                                <div className="pt-2 border-t border-slate-100">
                                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={!formData.rules.require_score} 
                                            onChange={e => setFormData({...formData, rules: {...formData.rules, require_score: !e.target.checked}})} 
                                            className="w-4 h-4 rounded text-orange-500"
                                        /> 
                                        Make Exact Score Optional
                                    </label>
                                </div>
                            </div>

                            <button 
                                onClick={handleSave} 
                                disabled={saving} 
                                className="w-full bg-slate-900 hover:bg-black text-white font-black uppercase text-xs py-3 rounded-xl transition shadow-lg flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                            >
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Deploy Campaign
                            </button>
                        </div>
                    </div>
                )}

                <div className={`p-6 ${isEditing ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
                    <h3 className="font-black text-sm text-slate-800 uppercase tracking-widest mb-4">Command Roster</h3>
                    
                    {campaigns.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                            <Target size={32} className="text-slate-300 mb-2" />
                            <p className="text-xs font-bold text-slate-400 uppercase">No active campaigns</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {campaigns.map(camp => (
                                <div key={camp.id} className={`p-4 rounded-2xl border transition-all ${camp.is_active ? 'bg-white border-orange-200 shadow-md ring-1 ring-orange-50' : 'bg-slate-50 border-slate-200 opacity-70'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-black text-slate-800 text-sm line-clamp-1">{camp.title}</h4>
                                        <button 
                                            onClick={() => toggleActive(camp.id, camp.is_active)} 
                                            className={`text-[8px] font-black px-2 py-1 rounded uppercase ${camp.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'}`}
                                        >
                                            {camp.is_active ? 'Active' : 'Offline'}
                                        </button>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                                        <Calendar size={10} /> {new Date(camp.start_date).toLocaleDateString()} - {new Date(camp.end_date).toLocaleDateString()}
                                    </div>
                                    
                                    <div className="flex flex-wrap items-center gap-2 mb-3">
                                        <div className={`px-2 py-1 rounded text-[8px] font-black flex items-center gap-1 ${camp.is_vip_required ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' : 'bg-green-100 text-green-800 border border-green-200'}`}>
                                            {camp.is_vip_required ? <><Crown size={10}/> VIP REQUIRED</> : 'FREE FOR ALL'}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2 mb-3">
                                        <div className="bg-slate-100 border border-slate-200 px-2 py-1 rounded text-[9px] font-black text-slate-600">WIN: {camp.rules?.points_outcome || 0}</div>
                                        <div className="bg-slate-100 border border-slate-200 px-2 py-1 rounded text-[9px] font-black text-slate-600">CS: {camp.rules?.points_score || 0}</div>
                                        <div className="bg-slate-100 border border-slate-200 px-2 py-1 rounded text-[9px] font-black text-slate-600">SCORER: {camp.rules?.points_first_scorer || 0}</div>
                                        <div className="bg-orange-100 border border-orange-200 px-2 py-1 rounded text-[9px] font-black text-orange-700">FLOOR: {camp.rules?.min_points_floor || 50}</div>
                                        {!camp.rules?.require_score && <div className="bg-blue-50 text-blue-600 px-2 py-1 rounded text-[9px] font-black border border-blue-200">CS OPTIONAL</div>}
                                    </div>

                                    <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                                        <button 
                                            onClick={() => editCampaign(camp)} 
                                            className="flex-1 bg-slate-900 text-white text-[10px] font-bold py-2 rounded-lg hover:bg-black transition"
                                        >
                                            Edit Rules
                                        </button>
                                        <button 
                                            onClick={() => deleteCampaign(camp.id)} 
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}