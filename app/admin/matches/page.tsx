'use client';

export const runtime = 'edge';

import { useState } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { Search, Youtube, Ticket, Loader2, Save, Check } from 'lucide-react';

export default function AdminMatchesPage() {
  const [search, setSearch] = useState('');
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null); // Track which match is saving
  const supabase = createClient();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data } = await supabase
        .from('matches')
        .select('*')
        .or(`home_team.ilike.%${search}%,away_team.ilike.%${search}%`)
        .order('match_date', { ascending: false })
        .limit(20);
    setMatches(data || []);
    setLoading(false);
  };

  // Helper to update local state so inputs don't lag
  const handleChange = (id: string, field: string, value: any) => {
    setMatches(matches.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const saveMatch = async (match: any) => {
    setSavingId(match.id);
    
    const { error } = await supabase.from('matches').update({
        booking_code: match.booking_code,
        affiliate_link: match.affiliate_link,
        video_url: match.video_url,
        is_featured_video: match.is_featured_video
    }).eq('id', match.id);

    if (error) {
        alert("Failed to save: " + error.message);
    }
    
    // Fake delay for visual feedback
    setTimeout(() => setSavingId(null), 1000);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-slate-800">Match Manager</h1>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input 
            type="text" 
            placeholder="Search Team (e.g. Arsenal)" 
            className="flex-1 border border-slate-300 rounded-xl px-4 py-3 outline-none focus:border-blue-600 font-bold"
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
        />
        <button type="submit" className="bg-blue-600 text-white px-6 rounded-xl font-bold">
            {loading ? <Loader2 className="animate-spin" /> : 'Search'}
        </button>
      </form>

      <div className="grid gap-4">
        {matches.map((match) => (
            <div key={match.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-6">
                
                {/* Match Info */}
                <div className="w-48 shrink-0">
                    <div className="text-[10px] font-bold text-slate-400">{new Date(match.match_date).toDateString()}</div>
                    <div className="font-black text-slate-800 text-lg leading-tight mb-2">{match.home_team} <br/><span className="text-xs text-slate-400">vs</span><br/> {match.away_team}</div>
                    
                    {/* SAVE BUTTON IS HERE NOW */}
                    <button 
                        onClick={() => saveMatch(match)}
                        disabled={savingId === match.id}
                        className={`w-full py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition ${savingId === match.id ? 'bg-green-600 text-white' : 'bg-black text-white hover:bg-slate-800'}`}
                    >
                        {savingId === match.id ? <><Check size={14}/> Saved</> : <><Save size={14}/> Save Changes</>}
                    </button>
                </div>

                {/* Controls */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 flex gap-1"><Ticket size={12}/> Booking Code</label>
                        <input 
                            type="text" 
                            value={match.booking_code || ''} 
                            onChange={(e) => handleChange(match.id, 'booking_code', e.target.value)}
                            placeholder="Code" 
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold text-blue-700 focus:bg-white focus:border-blue-500" 
                        />
                        <label className="text-[10px] font-bold text-slate-400 flex gap-1 mt-2">Affiliate Link</label>
                        <input 
                            type="text" 
                            value={match.affiliate_link || ''} 
                            onChange={(e) => handleChange(match.id, 'affiliate_link', e.target.value)}
                            placeholder="https://..." 
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:border-blue-500" 
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 flex gap-1"><Youtube size={12}/> Video URL</label>
                        <input 
                            type="text" 
                            value={match.video_url || ''} 
                            onChange={(e) => handleChange(match.id, 'video_url', e.target.value)}
                            placeholder="YouTube Link" 
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:border-blue-500" 
                        />
                        <label className="flex items-center gap-2 cursor-pointer mt-3 p-2 border border-dashed border-slate-300 rounded-lg hover:bg-slate-50">
                            <input 
                                type="checkbox" 
                                checked={match.is_featured_video || false} 
                                onChange={(e) => handleChange(match.id, 'is_featured_video', e.target.checked)}
                            />
                            <span className="text-xs font-bold text-slate-600">Feature on Homepage?</span>
                        </label>
                    </div>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
}