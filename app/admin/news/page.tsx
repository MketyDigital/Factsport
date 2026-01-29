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

  // Load news on mount
  useEffect(() => { fetchNews(); }, []);

  // 🪄 AUTO-SUGGEST LOGOS FROM TITLE
  // This listens to your typing. If you type "Chelsea", it finds the Chelsea logo.
  useEffect(() => {
    if (editingId) return; // Don't overwrite if editing existing news

    const findLogos = async () => {
        if (!formData.title || formData.title.length < 4) return;
        // Stop if we already have logos
        if (formData.team1Logo && formData.team2Logo) return;

        const { data } = await supabase
            .from('matches')
            .select('home_team, home_logo, away_team, away_logo')
            .or(`home_team.ilike.%${formData.title.split(' ')[0]}%,away_team.ilike.%${formData.title.split(' ')[0]}%`)
            .limit(20);

        if (data && data.length > 0) {
             const titleLower = formData.title.toLowerCase();
             let t1 = formData.team1Logo;
             let t2 = formData.team2Logo;

             // Smart matching logic
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
    
    const timeoutId = setTimeout(findLogos, 800); // Wait 800ms after typing stops
    return () => clearTimeout(timeoutId);
  }, [formData.title, editingId]);

  const fetchNews = async () => {
    const { data } = await supabase.from('news').select('*').order('created_at', { ascending: false });
    setNews(data || []);
  };

  // ✅ RUN THE DEEP SCRAPER BOT
  const runAutoBot = async () => {
    setBotLoading(true);
    try {
        // Uses the Public Key from your .env.local file
        const key = process.env.NEXT_PUBLIC_CRON_KEY;
        if (!key) {
            alert("Missing NEXT_PUBLIC_CRON_KEY in .env.local");
            setBotLoading(false);
            return;
        }

        const res = await fetch(`/api/cron/news?key=${key}`);
        const json = await res.json();

        if (json.success) {
            alert(`✅ Success: ${json.message}`);
            fetchNews(); // Reload the list instantly
        } else {
            alert(`❌ Error: ${json.error || json.message}`);
        }
    } catch (e) {
        alert("Failed to connect to Bot API.");
        console.error(e);
    }
    setBotLoading(false);
  };

  // Populate form for editing
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
        // UPDATE Existing
        await supabase.from('news').update(payload).eq('id', editingId);
        setEditingId(null);
    } else {
        // CREATE New
        await supabase.from('news').insert(payload);
    }
    
    setFormData({ title: '', body: '', imageUrl: '', team1Logo: '', team2Logo: '', isBreaking: false, isHeadline: false });
    fetchNews();
    setLoading(false);
  };

  const deleteNews = async (id: string) => {
    if(confirm("Are you sure you want to delete this article?")) { 
        await supabase.from('news').delete().eq('id', id); 
        fetchNews(); 
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Newsroom</h1>
            <p className="text-slate-500 text-sm">Manage articles, headlines, and run the AI Scraper.</p>
          </div>
          
          <button 
              onClick={runAutoBot}
              disabled={botLoading}
              className={`px-6 py-3 rounded-xl text-sm font-bold shadow-lg transition active:scale-95 flex items-center gap-2 border 
                ${botLoading ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white border-blue-500 hover:shadow-blue-500/20'}`}
          >
              {botLoading ? <Loader2 className="animate-spin" size={18} /> : <Bot size={18} />}
              {botLoading ? 'Scraping & Writing...' : 'Run Deep Scraper'}
          </button>
      </div>
      
      {/* EDITOR CARD */}
      <div className={`p-6 rounded-2xl shadow-sm border transition-all ${editingId ? 'bg-yellow-50 border-yellow-200 ring-4 ring-yellow-500/10' : 'bg-white border-slate-100'}`}>
        <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-lg flex items-center gap-2 text-slate-800">
                {editingId ? <><Pencil size={18} className="text-yellow-600"/> Editing Article</> : "Create New Article"}
            </h2>
            {editingId && (
                <button onClick={handleCancelEdit} className="text-xs font-bold text-slate-500 flex items-center gap-1 hover:text-red-500 bg-white px-3 py-1.5 rounded-full border border-slate-200 hover:border-red-200 transition">
                    <X size={14}/> Cancel Edit
                </button>
            )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
                 <input 
                    type="text" 
                    placeholder="Headline (e.g. Man City agree deal for Doku)" 
                    className="w-full text-xl font-bold border-b-2 border-slate-100 pb-2 outline-none focus:border-black transition bg-transparent placeholder:text-slate-300" 
                    value={formData.title} 
                    onChange={(e) => setFormData({...formData, title: e.target.value})} 
                    required 
                 />
                 {!editingId && <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1"><Bot size={10}/> Type team names to auto-detect logos.</p>}
            </div>

            {/* Logo Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                 <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-white rounded-lg border border-slate-200 flex items-center justify-center shrink-0 shadow-sm">
                         {formData.team1Logo ? <img src={formData.team1Logo} className="w-6 h-6 object-contain" /> : <Shield size={16} className="text-slate-300"/>}
                     </div>
                     <input 
                        type="text" 
                        placeholder="Home Team Logo URL" 
                        className="flex-1 bg-transparent text-xs border-b border-slate-200 focus:border-blue-500 outline-none pb-1" 
                        value={formData.team1Logo} 
                        onChange={(e) => setFormData({...formData, team1Logo: e.target.value})} 
                     />
                 </div>
                 <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-white rounded-lg border border-slate-200 flex items-center justify-center shrink-0 shadow-sm">
                         {formData.team2Logo ? <img src={formData.team2Logo} className="w-6 h-6 object-contain" /> : <Shield size={16} className="text-slate-300"/>}
                     </div>
                     <input 
                        type="text" 
                        placeholder="Away Team Logo URL" 
                        className="flex-1 bg-transparent text-xs border-b border-slate-200 focus:border-blue-500 outline-none pb-1" 
                        value={formData.team2Logo} 
                        onChange={(e) => setFormData({...formData, team2Logo: e.target.value})} 
                     />
                 </div>
            </div>

            {/* Options */}
            <div className="flex flex-wrap gap-4">
                <input 
                    type="text" 
                    placeholder="Cover Image URL (Optional - will override logos)" 
                    className="flex-[2] border rounded-lg px-4 py-2.5 text-sm outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition" 
                    value={formData.imageUrl} 
                    onChange={(e) => setFormData({...formData, imageUrl: e.target.value})} 
                />
                
                <label className={`flex gap-2 items-center px-4 py-2.5 rounded-lg border cursor-pointer select-none transition ${formData.isHeadline ? 'bg-blue-50 text-blue-700 border-blue-200 font-bold' : 'hover:bg-slate-50 bg-white text-slate-600'}`}>
                    <input type="checkbox" className="hidden" checked={formData.isHeadline} onChange={(e) => setFormData({...formData, isHeadline: e.target.checked})} />
                    <Star size={16}/> Slider
                </label>
                
                <label className={`flex gap-2 items-center px-4 py-2.5 rounded-lg border cursor-pointer select-none transition ${formData.isBreaking ? 'bg-red-50 text-red-700 border-red-200 font-bold' : 'hover:bg-slate-50 bg-white text-slate-600'}`}>
                    <input type="checkbox" className="hidden" checked={formData.isBreaking} onChange={(e) => setFormData({...formData, isBreaking: e.target.checked})} />
                    <Activity size={16}/> Ticker
                </label>
            </div>

            {/* Body */}
            <textarea 
                placeholder="Write the full article here..." 
                className="w-full h-48 border rounded-lg p-4 text-sm outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition leading-relaxed resize-none" 
                value={formData.body} 
                onChange={(e) => setFormData({...formData, body: e.target.value})}
            ></textarea>
            
            {/* Submit */}
            <button 
                type="submit" 
                disabled={loading} 
                className={`w-full py-3 rounded-xl font-bold text-sm flex justify-center items-center gap-2 transition active:scale-95 shadow-md text-white 
                ${editingId ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : 'bg-black hover:bg-slate-800'}`}
            >
                {loading ? <Loader2 className="animate-spin" size={18}/> : (editingId ? <><Save size={18}/> Update Article</> : <><Plus size={18}/> Publish Article</>)}
            </button>
        </form>
      </div>

      {/* NEWS LIST */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-slate-700 text-sm">Published Articles ({news.length})</h3>
            <button onClick={fetchNews} className="text-slate-400 hover:text-blue-600 transition"><RefreshCw size={14}/></button>
        </div>
        
        {news.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm flex flex-col items-center gap-3">
                <Bot size={32} className="text-slate-200"/>
                <p>No news yet. Run the Deep Scraper or create one manually!</p>
            </div>
        ) : (
            <div className="divide-y divide-slate-100">
                {news.map((item) => (
                    <div key={item.id} className={`p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between transition group ${editingId === item.id ? 'bg-yellow-50' : 'hover:bg-slate-50'}`}>
                        
                        <div className="flex gap-4 items-center flex-1">
                            {/* Thumbnail */}
                            <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 shrink-0 relative">
                                {item.image_url ? (
                                    <img src={item.image_url} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="flex items-center -space-x-2">
                                        {item.team_1_logo && <img src={item.team_1_logo} className="w-6 h-6 object-contain z-10" />}
                                        {item.team_2_logo && <img src={item.team_2_logo} className="w-6 h-6 object-contain z-0" />}
                                        {!item.team_1_logo && !item.team_2_logo && <Activity size={18} className="text-slate-300" />}
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div>
                                <h4 className="font-bold text-sm text-slate-800 line-clamp-1 group-hover:text-blue-600 transition">{item.title}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] text-slate-400 font-mono">{new Date(item.created_at).toLocaleDateString()}</span>
                                    {item.is_breaking && <span className="bg-red-100 text-red-600 text-[9px] font-bold px-1.5 py-0.5 rounded">TICKER</span>}
                                    {item.is_headline && <span className="bg-blue-100 text-blue-600 text-[9px] font-bold px-1.5 py-0.5 rounded">SLIDER</span>}
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 self-end md:self-center">
                            <button onClick={() => handleEdit(item)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white text-slate-400 hover:text-yellow-600 transition border border-transparent hover:border-slate-200 hover:shadow-sm" title="Edit">
                                <Pencil size={14}/>
                            </button>
                            <button onClick={() => deleteNews(item.id)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white text-slate-400 hover:text-red-600 transition border border-transparent hover:border-slate-200 hover:shadow-sm" title="Delete">
                                <Trash2 size={14}/>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
}