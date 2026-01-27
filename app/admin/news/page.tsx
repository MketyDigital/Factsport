'use client';
export const runtime = 'edge';

import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { Loader2, Plus, Trash2, Star, Activity, Search, Shield, Bot } from 'lucide-react';

export default function AdminNewsPage() {
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
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

  // 🪄 AUTO-SUGGEST LOGOS FROM TITLE
  useEffect(() => {
    const findLogos = async () => {
        if (!formData.title || formData.title.length < 5) return;
        if (formData.team1Logo && formData.team2Logo) return;

        const { data } = await supabase
            .from('matches')
            .select('home_team, home_logo, away_team, away_logo')
            .or(`home_team.ilike.%${formData.title.split(' ')[0]}%,away_team.ilike.%${formData.title.split(' ')[0]}%`)
            .limit(50);

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
    
    const timeoutId = setTimeout(findLogos, 1000);
    return () => clearTimeout(timeoutId);
  }, [formData.title]);

  const fetchNews = async () => {
    const { data } = await supabase.from('news').select('*').order('created_at', { ascending: false });
    setNews(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const slug = formData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    await supabase.from('news').insert({
        title: formData.title, 
        body: formData.body, 
        image_url: formData.imageUrl,
        team_1_logo: formData.team1Logo,
        team_2_logo: formData.team2Logo,
        is_breaking: formData.isBreaking, 
        is_headline: formData.isHeadline, 
        slug: slug
    });
    
    setFormData({ title: '', body: '', imageUrl: '', team1Logo: '', team2Logo: '', isBreaking: false, isHeadline: false });
    fetchNews();
    setLoading(false);
  };

  const deleteNews = async (id: string) => {
    if(confirm("Delete article?")) { await supabase.from('news').delete().eq('id', id); fetchNews(); }
  };

  return (
    <div className="space-y-6">
      {/* HEADER WITH AUTO-BOT BUTTON */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <h1 className="text-2xl font-black text-slate-800">News Editor</h1>
          
          <button 
              onClick={async () => {
                  const btn = document.getElementById('bot-btn');
                  if(btn) btn.innerHTML = '⚙️ Running...';
                  try {
                    const res = await fetch('/api/cron/news');
                    const json = await res.json();
                    if(json.success) {
                        alert(json.message);
                        window.location.reload();
                    } else {
                        alert("Bot Error: " + json.error);
                    }
                  } catch (e) {
                    alert("Failed to run bot.");
                  }
                  if(btn) btn.innerHTML = '🤖 Run Auto-Bot';
              }}
              id="bot-btn"
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg transition active:scale-95 flex items-center gap-2 border border-blue-500"
          >
              <Bot size={18} /> Run Auto-Bot
          </button>
      </div>
      
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title Input */}
            <div>
                 <input 
                    type="text" 
                    placeholder="Article Headline (e.g. Man Utd vs Chelsea Preview)" 
                    className="w-full text-lg font-bold border-b pb-2 outline-none focus:border-black transition" 
                    value={formData.title} 
                    onChange={(e) => setFormData({...formData, title: e.target.value})} 
                    required 
                 />
                 <p className="text-[10px] text-slate-400 mt-1">💡 Pro Tip: Type team names clearly to auto-detect logos.</p>
            </div>

            {/* Logo Inputs (The "Smart Artwork" Section) */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                 <div className="flex items-center gap-2">
                     <div className="w-8 h-8 bg-white rounded border flex items-center justify-center shrink-0">
                         {formData.team1Logo ? <img src={formData.team1Logo} className="w-6 h-6 object-contain" /> : <Shield size={14} className="text-slate-300"/>}
                     </div>
                     <input 
                        type="text" 
                        placeholder="Team 1 Logo URL" 
                        className="flex-1 bg-transparent text-xs border-b border-slate-200 focus:border-blue-500 outline-none pb-1" 
                        value={formData.team1Logo} 
                        onChange={(e) => setFormData({...formData, team1Logo: e.target.value})} 
                     />
                 </div>
                 <div className="flex items-center gap-2">
                     <div className="w-8 h-8 bg-white rounded border flex items-center justify-center shrink-0">
                         {formData.team2Logo ? <img src={formData.team2Logo} className="w-6 h-6 object-contain" /> : <Shield size={14} className="text-slate-300"/>}
                     </div>
                     <input 
                        type="text" 
                        placeholder="Team 2 Logo URL" 
                        className="flex-1 bg-transparent text-xs border-b border-slate-200 focus:border-blue-500 outline-none pb-1" 
                        value={formData.team2Logo} 
                        onChange={(e) => setFormData({...formData, team2Logo: e.target.value})} 
                     />
                 </div>
            </div>

            {/* Standard Options */}
            <div className="flex gap-4">
                <input type="text" placeholder="Cover Image URL (Optional - overrides logos)" className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" value={formData.imageUrl} onChange={(e) => setFormData({...formData, imageUrl: e.target.value})} />
                <label className={`flex gap-2 px-3 py-2 rounded-lg border cursor-pointer select-none transition ${formData.isHeadline ? 'bg-blue-50 text-blue-700 border-blue-200' : 'hover:bg-slate-50'}`}><input type="checkbox" className="hidden" checked={formData.isHeadline} onChange={(e) => setFormData({...formData, isHeadline: e.target.checked})} /><Star size={16}/> Slider</label>
                <label className={`flex gap-2 px-3 py-2 rounded-lg border cursor-pointer select-none transition ${formData.isBreaking ? 'bg-red-50 text-red-700 border-red-200' : 'hover:bg-slate-50'}`}><input type="checkbox" className="hidden" checked={formData.isBreaking} onChange={(e) => setFormData({...formData, isBreaking: e.target.checked})} /><Activity size={16}/> Ticker</label>
            </div>

            <textarea placeholder="Article content..." className="w-full h-32 border rounded-lg p-3 text-sm outline-none focus:border-blue-500" value={formData.body} onChange={(e) => setFormData({...formData, body: e.target.value})}></textarea>
            
            <button type="submit" disabled={loading} className="bg-black text-white px-6 py-2 rounded-lg font-bold text-sm flex gap-2 hover:bg-slate-800 transition active:scale-95 shadow-lg">
                {loading ? <Loader2 className="animate-spin" size={16}/> : <><Plus size={16}/> Publish Article</>}
            </button>
        </form>
      </div>

      {/* NEWS LIST */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100">
        {news.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-sm">No news yet. Try running the bot!</div>
        ) : (
            news.map((item) => (
                <div key={item.id} className="p-4 border-b last:border-0 flex justify-between items-center hover:bg-slate-50 transition">
                    <div className="flex gap-3 items-center">
                        {/* Preview Thumbnail Logic */}
                        <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 shrink-0">
                            {item.image_url ? (
                                <img src={item.image_url} className="w-full h-full object-cover" />
                            ) : (
                                <div className="flex items-center -space-x-1">
                                    {item.team_1_logo && <img src={item.team_1_logo} className="w-5 h-5 object-contain" />}
                                    {item.team_2_logo && <img src={item.team_2_logo} className="w-5 h-5 object-contain" />}
                                    {!item.team_1_logo && !item.team_2_logo && <Activity size={16} className="text-slate-300" />}
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-sm line-clamp-1">{item.title}</span>
                            <span className="text-[10px] text-slate-400">{new Date(item.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <button onClick={() => deleteNews(item.id)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 text-slate-400 hover:text-red-600 transition shrink-0"><Trash2 size={16}/></button>
                </div>
            ))
        )}
      </div>
    </div>
  );
}