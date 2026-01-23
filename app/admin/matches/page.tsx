'use client';
export const runtime = 'edge';

import { useState } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { Search, Youtube, Ticket, Loader2 } from 'lucide-react';

export default function AdminMatchesPage() {
  const [search, setSearch] = useState('');
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data } = await supabase.from('matches').select('*').or(`home_team.ilike.%${search}%,away_team.ilike.%${search}%`).order('match_date', { ascending: false }).limit(20);
    setMatches(data || []);
    setLoading(false);
  };

  const updateMatch = async (id: string, field: string, value: any) => {
    await supabase.from('matches').update({ [field]: value }).eq('id', id);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-slate-800">Match Manager</h1>
      <form onSubmit={handleSearch} className="flex gap-2">
        <input type="text" placeholder="Search Team (e.g. Arsenal)" className="flex-1 border rounded-xl px-4 py-3 outline-none" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button type="submit" className="bg-blue-600 text-white px-6 rounded-xl font-bold">{loading ? <Loader2 className="animate-spin"/> : 'Search'}</button>
      </form>
      <div className="grid gap-4">
        {matches.map((match) => (
            <div key={match.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-6">
                <div className="w-48 shrink-0">
                    <div className="text-[10px] font-bold text-slate-400">{new Date(match.match_date).toDateString()}</div>
                    <div className="font-black text-slate-800">{match.home_team} vs {match.away_team}</div>
                </div>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 flex gap-1"><Ticket size={12}/> Booking Code</label>
                        <input type="text" defaultValue={match.booking_code} onBlur={(e) => updateMatch(match.id, 'booking_code', e.target.value)} placeholder="Code" className="w-full bg-slate-50 border rounded-lg px-3 py-2 text-sm font-mono font-bold text-blue-700" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 flex gap-1"><Youtube size={12}/> Video URL</label>
                        <input type="text" defaultValue={match.video_url} onBlur={(e) => updateMatch(match.id, 'video_url', e.target.value)} placeholder="YouTube Link" className="w-full bg-slate-50 border rounded-lg px-3 py-2 text-sm" />
                    </div>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
}