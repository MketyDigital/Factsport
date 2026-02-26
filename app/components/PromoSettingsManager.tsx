'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { Save, Loader2, Link2 } from 'lucide-react';

export default function PromoSettingsManager() {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        code_1xbet: '', link_1xbet: '', code_melbet: '', link_melbet: ''
    });

    useEffect(() => {
        const fetchSettings = async () => {
            const supabase = createClient();
            const { data } = await supabase.from('site_settings').select('*').eq('id', 1).single();
            if (data) setFormData(data);
        };
        fetchSettings();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const supabase = createClient();
        await supabase.from('site_settings').upsert({ id: 1, ...formData });
        alert('✅ Promo Codes Updated!');
        setLoading(false);
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-6">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                <h2 className="font-bold text-lg flex items-center gap-2"><Link2 size={20} className="text-green-600" /> Global Promo Settings</h2>
                <p className="text-[10px] text-slate-500">Update the codes/links that appear across the whole website instantly.</p>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 border p-3 rounded-lg bg-blue-50/50">
                        <label className="text-xs font-bold text-blue-700">1xBet Code</label>
                        <input type="text" className="w-full border rounded p-2 text-sm" value={formData.code_1xbet} onChange={e => setFormData({...formData, code_1xbet: e.target.value})} />
                        <label className="text-xs font-bold text-blue-700 mt-2 block">1xBet Link</label>
                        <input type="text" className="w-full border rounded p-2 text-xs" value={formData.link_1xbet} onChange={e => setFormData({...formData, link_1xbet: e.target.value})} />
                    </div>
                    <div className="space-y-2 border p-3 rounded-lg bg-yellow-50/50">
                        <label className="text-xs font-bold text-yellow-700">Melbet Code</label>
                        <input type="text" className="w-full border rounded p-2 text-sm" value={formData.code_melbet} onChange={e => setFormData({...formData, code_melbet: e.target.value})} />
                        <label className="text-xs font-bold text-yellow-700 mt-2 block">Melbet Link</label>
                        <input type="text" className="w-full border rounded p-2 text-xs" value={formData.link_melbet} onChange={e => setFormData({...formData, link_melbet: e.target.value})} />
                    </div>
                </div>
                <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Changes
                </button>
            </form>
        </div>
    );
}