'use client';
export const runtime = 'edge';

import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { Loader2, Plus, Trash2, Star, Activity, Shield, Bot, Pencil, X, Save, RefreshCw } from 'lucide-react';

export default function AdminNewsPage() {
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [botLoading, setBotLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({ 
    title: '', 
    body: '', 
    imageUrl: '', 
    team1Logo: '', 
    team2Logo: '', 
    isBreaking: false, 
    isHeadline: false 
  });
  
  const supabase = createClient();

  useEffect(() => { fetchNews(); }, []);

  // 🪄 AUTO-SUGGEST LOGOS (Updated to Search 1000 Matches)
  useEffect(() => {
    if (editingId) return;

    const findLogos = async () => {
        if (!formData.title || formData.title.length < 4) return;
        if (formData.team1Logo && formData.team2Logo) return;

        // ✅ INCREASED LIMIT to 1000 to find older teams
        const { data } = await supabase
            .from('matches')
            .select('home_team, home_logo, away_team, away_logo')
            .or(`home_team.ilike.%${formData.title.split(' ')[0]}%,away_team.ilike.%${formData.title.split(' ')[0]}%`)
            .limit(1000); 

        if (data && data.length > 0) {
             const titleLower = formData.title.toLowerCase();
             let t1 = formData.team1Logo;
             let t2 = formData.team2Logo;

             data.forEach(m => {
                 if (!t1 && titleLower.includes(m.home_team.toLowerCase())) t1 = m.home_logo;
                 if (!t1 && titleLower.includes(m.away_team.toLowerCase())) t1 = m.away_logo;
                 
                 if (t1) {
                     if (!t2 && m.home_logo !== t1 && titleLower.includes(m.home_team.toLowerCase())) t2 = m.home_logo;
                     if (!t2 && m.away_logo !== t1 && titleLower.includes(m.away_team.toLowerCase())) t2 = m.away_logo;
                 }
             });

             if (t1 || t2) {
                 setFormData(prev => ({ ...prev, team1Logo: t1 || prev.team1Logo, team2Logo: t2 || prev.team2Logo }));
             }
        }
    };
    
    const timeoutId = setTimeout(findLogos, 800);
    return () => clearTimeout(timeoutId);
  }, [formData.title, editingId]);

  const fetchNews = async () => {
    const { data } = await supabase.from('news').select('*').order('created_at', { ascending: false });
    setNews(data || []);
  };

  const runAutoBot = async () => {
    setBotLoading(true);
    try {
        const key = process.env.NEXT_PUBLIC_CRON_KEY;
        const res = await fetch(`/api/cron/news?key=${key}`);
        const json = await res.json();
        if (json.success) {
            alert(`✅ Success: ${json.message}`);
            fetchNews();
        } else {
            alert(`❌ Error: ${json.error || json.message}`);
        }
    } catch (e) {
        alert("Failed to connect to Bot API.");
    }
    setBotLoading(false);
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setFormData({
        title: item.title,
        body: item.body || '',
        imageUrl: item.image_url || '',
        team1Logo: item.team_1_logo || '',
        team2Logo: item.team_2_logo || '',
        isBreaking: item.is_breaking,
        isHeadline: item.is_headline
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData({ title: '', body: '', imageUrl: '', team1Logo: '', team2Logo: '', isBreaking: false, isHeadline: false });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const slug = formData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    
    const payload = {
        title: formData.title, 
        body: formData.body, 
        image_url: formData.imageUrl || null,
        team_1_logo: formData.team1Logo || null,
        team_2_logo: formData.team2Logo || null,
        is_breaking: formData.isBreaking, 
        is_headline: formData.isHeadline, 
        slug: slug
    };

    if (editingId) {
        await supabase.from('news').update(payload).eq('id', editingId);
        setEditingId(null);
    } else {
        await supabase.from('news').insert(payload);
    }
    
    setFormData({ title: '', body: '', imageUrl: '', team1Logo: '', team2Logo: '', isBreaking: false, isHeadline: false });
    fetchNews();
    setLoading(false);
  };

  const deleteNews = async (id: string) => {
    if(confirm("Delete article?")) { 
        await supabase.from('news').delete().eq('id', id); 
        fetchNews(); 
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-200 pb-6">
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Newsroom</h1>
          <button onClick={runAutoBot} disabled={botLoading} className="px-6 py-3 rounded-xl text-sm font-bold shadow-lg flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700">
              {botLoading ? <Loader2 className="animate-spin" size={18} /> : <Bot size={18} />} {botLoading ? 'Scraping...' : 'Run Bot'}
          </button>
      </div>
      
      <div className={`p-6 rounded-2xl shadow-sm border transition-all ${editingId ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-slate-100'}`}>
        <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-lg flex items-center gap-2 text-slate-800">
                {editingId ? <><Pencil size={18} className="text-yellow-600"/> Editing</> : "New Article"}
            </h2>
            {editingId && <button onClick={handleCancelEdit} className="text-xs font-bold text-slate-500 flex items-center gap-1 hover:text-red-500"><X size={14}/> Cancel</button>}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
            <input type="text" placeholder="Headline" className="w-full text-xl font-bold border-b-2 border-slate-100 pb-2 outline-none bg-transparent" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} required />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                 <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-white rounded-lg border flex items-center justify-center shrink-0">{formData.team1Logo ? <img src={formData.team1Logo} className="w-6 h-6 object-contain" /> : <Shield size={16} className="text-slate-300"/>}</div>
                     <input type="text" placeholder="Home Team Logo URL" className="flex-1 bg-transparent text-xs border-b border-slate-200 outline-none" value={formData.team1Logo} onChange={(e) => setFormData({...formData, team1Logo: e.target.value})} />
                 </div>
                 <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-white rounded-lg border flex items-center justify-center shrink-0">{formData.team2Logo ? <img src={formData.team2Logo} className="w-6 h-6 object-contain" /> : <Shield size={16} className="text-slate-300"/>}</div>
                     <input type="text" placeholder="Away Team Logo URL" className="flex-1 bg-transparent text-xs border-b border-slate-200 outline-none" value={formData.team2Logo} onChange={(e) => setFormData({...formData, team2Logo: e.target.value})} />
                 </div>
            </div>

            <div className="flex flex-wrap gap-4">
                <input type="text" placeholder="Cover Image URL" className="flex-[2] border rounded-lg px-4 py-2 text-sm outline-none" value={formData.imageUrl} onChange={(e) => setFormData({...formData, imageUrl: e.target.value})} />
                <label className={`flex gap-2 items-center px-4 py-2 rounded-lg border cursor-pointer ${formData.isHeadline ? 'bg-blue-50 text-blue-700 font-bold' : 'bg-white'}`}><input type="checkbox" className="hidden" checked={formData.isHeadline} onChange={(e) => setFormData({...formData, isHeadline: e.target.checked})} /><Star size={16}/> Slider</label>
                <label className={`flex gap-2 items-center px-4 py-2 rounded-lg border cursor-pointer ${formData.isBreaking ? 'bg-red-50 text-red-700 font-bold' : 'bg-white'}`}><input type="checkbox" className="hidden" checked={formData.isBreaking} onChange={(e) => setFormData({...formData, isBreaking: e.target.checked})} /><Activity size={16}/> Ticker</label>
            </div>

            <textarea placeholder="Article content..." className="w-full h-48 border rounded-lg p-4 text-sm outline-none resize-none" value={formData.body} onChange={(e) => setFormData({...formData, body: e.target.value})}></textarea>
            
            <button type="submit" disabled={loading} className={`w-full py-3 rounded-xl font-bold text-sm flex justify-center items-center gap-2 shadow-md text-white ${editingId ? 'bg-yellow-500 text-black' : 'bg-black'}`}>
                {loading ? <Loader2 className="animate-spin" size={18}/> : (editingId ? <><Save size={18}/> Update</> : <><Plus size={18}/> Publish</>)}
            </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100">
        {news.map((item) => (
            <div key={item.id} className="p-4 flex justify-between items-center border-b hover:bg-slate-50 transition">
                <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden border shrink-0">
                        {item.image_url ? <img src={item.image_url} className="w-full h-full object-cover" /> : <div className="flex -space-x-2">{item.team_1_logo && <img src={item.team_1_logo} className="w-6 h-6 object-contain z-10" />}{item.team_2_logo && <img src={item.team_2_logo} className="w-6 h-6 object-contain z-0" />}</div>}
                    </div>
                    <div>
                        <h4 className="font-bold text-sm line-clamp-1">{item.title}</h4>
                        <span className="text-[10px] text-slate-400">{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => handleEdit(item)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600"><Pencil size={16}/></button>
                    <button onClick={() => deleteNews(item.id)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-red-600"><Trash2 size={16}/></button>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
}