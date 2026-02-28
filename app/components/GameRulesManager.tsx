// app/components/GameRulesManager.tsx
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { Settings, Save, Loader2, CheckCircle } from 'lucide-react';

export default function GameRulesManager() {
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    
    const [rules, setRules] = useState({
        daily_limit: 5,
        target_exact_scores: 4,
        min_points_floor: 100
    });

    useEffect(() => {
        fetchRules();
    }, []);

    const fetchRules = async () => {
        const { data } = await supabase.from('site_settings').select('*').limit(1).single();
        if (data) {
            setRules({
                daily_limit: data.daily_limit || 5,
                target_exact_scores: data.target_exact_scores || 4,
                min_points_floor: data.min_points_floor || 100
            });
        }
        setLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        // Assuming your settings row has id = 1
        const { error } = await supabase
            .from('site_settings')
            .update(rules)
            .eq('id', 1); 

        if (!error) {
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } else {
            alert("Error saving rules: " + error.message);
        }
        setSaving(false);
    };

    if (loading) return <div className="p-6 text-center text-slate-400 animate-pulse">Loading Rules...</div>;

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h2 className="font-bold text-lg flex items-center gap-2">
                    <Settings size={20} className="text-slate-600" /> Dynamic Game Rules
                </h2>
            </div>
            <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2">Daily Prediction Limit</label>
                        <input 
                            type="number" 
                            value={rules.daily_limit} 
                            onChange={(e) => setRules({...rules, daily_limit: parseInt(e.target.value) || 0})}
                            className="w-full border rounded-lg p-3 text-sm focus:border-blue-500 outline-none font-black text-blue-600 bg-blue-50" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2">Target Exact Scores</label>
                        <input 
                            type="number" 
                            value={rules.target_exact_scores} 
                            onChange={(e) => setRules({...rules, target_exact_scores: parseInt(e.target.value) || 0})}
                            className="w-full border rounded-lg p-3 text-sm focus:border-green-500 outline-none font-black text-green-600 bg-green-50" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2">Minimum Points Floor</label>
                        <input 
                            type="number" 
                            value={rules.min_points_floor} 
                            onChange={(e) => setRules({...rules, min_points_floor: parseInt(e.target.value) || 0})}
                            className="w-full border rounded-lg p-3 text-sm focus:border-yellow-500 outline-none font-black text-yellow-600 bg-yellow-50" 
                        />
                    </div>
                </div>
                <p className="text-[10px] text-slate-400 italic mb-4">
                    Updating these will instantly change the database limits, the user dashboards, and the leaderboard podium requirements.
                </p>
                <button 
                    onClick={handleSave} 
                    disabled={saving}
                    className="bg-slate-900 text-white font-bold text-sm px-6 py-3 rounded-xl hover:bg-black transition flex items-center gap-2"
                >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {saved ? <span className="flex items-center gap-1 text-green-400"><CheckCircle size={16} /> Saved!</span> : 'Save Global Rules'}
                </button>
            </div>
        </div>
    );
}