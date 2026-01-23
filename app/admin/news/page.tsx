'use client';
export const runtime = 'edge';

import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { Loader2, Plus, Trash2, Star, Activity } from 'lucide-react';

export default function AdminNewsPage() {
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ title: '', body: '', imageUrl: '', isBreaking: false, isHeadline: false });
  const supabase = createClient();

  useEffect(() => { fetchNews(); }, []);

  const fetchNews = async () => {
    const { data } = await supabase.from('news').select('*').order('created_at', { ascending: false });
    setNews(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const slug = formData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await supabase.from('news').insert({
        title: formData.title, body: formData.body, image_url: formData.imageUrl,
        is_breaking: formData.isBreaking, is_headline: formData.isHeadline, slug: slug
    });
    setFormData({ title: '', body: '', imageUrl: '', isBreaking: false, isHeadline: false });
    fetchNews();
    setLoading(false);
  };

  const deleteNews = async (id: string) => {
    if(confirm("Delete article?")) { await supabase.from('news').delete().eq('id', id); fetchNews(); }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-slate-800">News Editor</h1>
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <form onSubmit={handleSubmit} className="space-y-4">
            <input type="text" placeholder="Article Headline" className="w-full text-lg font-bold border-b pb-2 outline-none" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} required />
            <div className="flex gap-4">
                <input type="text" placeholder="Image URL" className="flex-1 border rounded-lg px-3 py-2 text-sm" value={formData.imageUrl} onChange={(e) => setFormData({...formData, imageUrl: e.target.value})} />
                <label className={`flex gap-2 px-3 py-2 rounded-lg border cursor-pointer ${formData.isHeadline ? 'bg-blue-50 text-blue-700' : ''}`}><input type="checkbox" className="hidden" checked={formData.isHeadline} onChange={(e) => setFormData({...formData, isHeadline: e.target.checked})} /><Star size={16}/> Slider</label>
                <label className={`flex gap-2 px-3 py-2 rounded-lg border cursor-pointer ${formData.isBreaking ? 'bg-red-50 text-red-700' : ''}`}><input type="checkbox" className="hidden" checked={formData.isBreaking} onChange={(e) => setFormData({...formData, isBreaking: e.target.checked})} /><Activity size={16}/> Ticker</label>
            </div>
            <textarea placeholder="Article content..." className="w-full h-32 border rounded-lg p-3 text-sm outline-none" value={formData.body} onChange={(e) => setFormData({...formData, body: e.target.value})}></textarea>
            <button type="submit" disabled={loading} className="bg-black text-white px-6 py-2 rounded-lg font-bold text-sm flex gap-2 hover:bg-slate-800">{loading ? <Loader2 className="animate-spin" size={16}/> : <><Plus size={16}/> Publish</>}</button>
        </form>
      </div>
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {news.map((item) => (
            <div key={item.id} className="p-4 border-b flex justify-between items-center hover:bg-slate-50">
                <div className="flex gap-3 items-center">
                    {item.image_url && <img src={item.image_url} className="w-10 h-10 rounded object-cover" />}
                    <span className="font-bold text-sm">{item.title}</span>
                </div>
                <button onClick={() => deleteNews(item.id)} className="text-slate-400 hover:text-red-600"><Trash2 size={16}/></button>
            </div>
        ))}
      </div>
    </div>
  );
}