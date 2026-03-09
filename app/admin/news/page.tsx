'use client';
export const runtime = 'edge';

import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { Loader2, Plus, Trash2, Star, Activity, Shield, Bot, Pencil, X, Save, Search, Tag, ChevronLeft, ChevronRight } from 'lucide-react';

const CATEGORIES = ['Football', 'Transfers', 'Sports Update', 'Champions League', 'Euros', 'World Cup', 'AFCON', 'Copa America'];
const ITEMS_PER_PAGE = 10;

export default function AdminNewsPage() {
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [botLoading, setBotLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState(''); 
  
  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Form State
  const [formData, setFormData] = useState({ 
    title: '', 
    body: '', 
    imageUrl: '', 
    team1Logo: '', 
    team2Logo: '', 
    isBreaking: false, 
    isHeadline: false,
    category: 'Football'
  });
  
  const supabase = createClient();

  // Reset to page 1 when searching
  useEffect(() => { 
      setCurrentPage(1);
      const timer = setTimeout(() => fetchNews(1), 500);
      return () => clearTimeout(timer);
  }, [search]);

  // Fetch when page changes
  useEffect(() => {
      fetchNews(currentPage);
  }, [currentPage]);

  // 🪄 AUTO-SUGGEST LOGOS
  useEffect(() => {
    if (editingId) return;

    const findLogos = async () => {
        if (!formData.title || formData.title.length < 4) return;
        if (formData.team1Logo && formData.team2Logo) return;

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

  const fetchNews = async (page: number) => {
    setLoading(true);
    const from = (page - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    let query = supabase.from('news').select('*', { count: 'exact' });
    if (search) query = query.ilike('title', `%${search}%`);
    
    query = query.order('created_at', { ascending: false }).range(from, to);
    
    const { data, count } = await query;
    setNews(data || []);
    if (count !== null) setTotalPages(Math.ceil(count / ITEMS_PER_PAGE) || 1);
    setLoading(false);
  };

  const runAutoBot = async () => {
    setBotLoading(true);
    try {
        const key = process.env.NEXT_PUBLIC_CRON_KEY;
        const res = await fetch(`/api/cron/news?key=${key}`);
        const json = await res.json();
        if (json.success) {
            alert(`✅ Success: ${json.message}`);
            fetchNews(currentPage);
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
        isHeadline: item.is_headline,
        category: item.category || 'Football'
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData({ title: '', body: '', imageUrl: '', team1Logo: '', team2Logo: '', isBreaking: false, isHeadline: false, category: 'Football' });
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
        slug: slug,
        category: formData.category
    };

    if (editingId) {
        await supabase.from('news').update(payload).eq('id', editingId);
        setEditingId(null);
    } else {
        await supabase.from('news').insert(payload);
    }
    
    setFormData({ title: '', body: '', imageUrl: '', team1Logo: '', team2Logo: '', isBreaking: false, isHeadline: false, category: 'Football' });
    fetchNews(currentPage);
    setLoading(false);
  };

  const deleteNews = async (id: string) => {
    if(confirm("Delete article?")) { 
        await supabase.from('news').delete().eq('id', id); 
        fetchNews(currentPage); 
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24 p-4 md:p-8 font-sans">
      
      {/* HEADER & SEARCH BAR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-6">
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Newsroom</h1>
          
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                      type="text" 
                      placeholder="Search articles..." 
                      className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:border-blue-500 outline-none shadow-sm"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                  />
              </div>
              <button onClick={runAutoBot} disabled={botLoading} className="w-full sm:w-auto px-6 py-3 rounded-xl text-sm font-bold shadow-lg flex justify-center items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap">
                  {botLoading ? <Loader2 className="animate-spin" size={18} /> : <Bot size={18} />} {botLoading ? 'Scraping...' : 'Run Bot'}
              </button>
          </div>
      </div>
      
      {/* EDITOR SECTION */}
      <div className={`p-6 rounded-2xl shadow-sm border transition-all ${editingId ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-slate-100'}`}>
        <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-lg flex items-center gap-2 text-slate-800">
                {editingId ? <><Pencil size={18} className="text-yellow-600"/> Editing</> : "New Article"}
            </h2>
            {editingId && <button onClick={handleCancelEdit} className="text-xs font-bold text-slate-500 flex items-center gap-1 hover:text-red-500"><X size={14}/> Cancel</button>}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
            <input type="text" placeholder="Headline" className="w-full text-xl font-bold border-b-2 border-slate-100 pb-2 outline-none bg-transparent" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} required />
            
            <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <Tag size={16} className="text-slate-400 shrink-0"/>
                <select 
                    className="bg-transparent text-sm font-bold text-slate-700 outline-none w-full cursor-pointer"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                >
                    {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>
            </div>

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

            <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-xs font-bold text-slate-500 mb-1">
                    <span>Article Content</span>
                    <span className="text-[10px] font-normal opacity-70">Supports Markdown for Links & Images</span>
                </div>
                <textarea 
                    placeholder="Write your article here...&#10;&#10;To add a Link: [Click Here](/match/123)&#10;To add an Image: ![Image Description](https://example.com/image.jpg)&#10;&#10;Leave a blank line between paragraphs." 
                    className="w-full h-64 border rounded-lg p-4 text-sm outline-none resize-none bg-slate-50 focus:bg-white transition" 
                    value={formData.body} 
                    onChange={(e) => setFormData({...formData, body: e.target.value})}>
                </textarea>
            </div>
            
            <button type="submit" disabled={loading} className={`w-full py-3 rounded-xl font-bold text-sm flex justify-center items-center gap-2 shadow-md text-white ${editingId ? 'bg-yellow-500 text-black' : 'bg-black'}`}>
                {loading ? <Loader2 className="animate-spin" size={18}/> : (editingId ? <><Save size={18}/> Update</> : <><Plus size={18}/> Publish</>)}
            </button>
        </form>
      </div>

      {/* NEWS LIST */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100">
        {news.map((item) => (
            <div key={item.id} className="p-4 flex justify-between items-center border-b hover:bg-slate-50 transition">
                <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden border shrink-0">
                        {item.image_url ? <img src={item.image_url} className="w-full h-full object-cover" /> : <div className="flex -space-x-2">{item.team_1_logo && <img src={item.team_1_logo} className="w-6 h-6 object-contain z-10" />}{item.team_2_logo && <img src={item.team_2_logo} className="w-6 h-6 object-contain z-0" />}</div>}
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            {item.category && <span className="bg-slate-100 text-slate-500 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">{item.category}</span>}
                            <span className="text-[9px] text-slate-400">{new Date(item.created_at).toLocaleDateString()}</span>
                        </div>
                        <h4 className="font-bold text-sm line-clamp-1">{item.title}</h4>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => handleEdit(item)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600"><Pencil size={16}/></button>
                    <button onClick={() => deleteNews(item.id)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-red-600"><Trash2 size={16}/></button>
                </div>
            </div>
        ))}
        {news.length === 0 && !loading && (
            <div className="text-center py-12 bg-slate-50">
                <p className="text-slate-500 font-bold">No articles found.</p>
            </div>
        )}
      </div>

      {/* 🟢 PAGINATION CONTROLS */}
      {totalPages > 1 && (
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mt-6">
              <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={`px-4 py-2 flex items-center gap-2 rounded-xl text-xs font-black uppercase tracking-widest ${currentPage === 1 ? 'pointer-events-none opacity-30 bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition'}`}
              >
                  <ChevronLeft size={14}/> Prev
              </button>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Page {currentPage} of {totalPages}</span>
              <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className={`px-4 py-2 flex items-center gap-2 rounded-xl text-xs font-black uppercase tracking-widest ${currentPage === totalPages ? 'pointer-events-none opacity-30 bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition'}`}
              >
                  Next <ChevronRight size={14}/>
              </button>
          </div>
      )}
    </div>
  );
}