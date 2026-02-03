'use client';
export const runtime = 'edge';

import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { 
  Search, Plus, Save, Trash2, Calendar, Link as LinkIcon, 
  Video, ExternalLink, Star, Filter 
} from 'lucide-react';

export default function AdminMatchesPage() {
  const supabase = createClient();
  
  // States
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  
  // 🟢 UPDATED: Filter defaults to 'future' so you always see what's next
  const [filterMode, setFilterMode] = useState<'week' | 'future' | 'finished'>('future');

  const [newMatch, setNewMatch] = useState({
    home_team: '', away_team: '', league: 'Premier League', match_date: '', home_logo: '', away_logo: ''
  });

  useEffect(() => { fetchMatches(); }, [filterMode]);

  const fetchMatches = async () => {
    setLoading(true);
    let query = supabase.from('matches').select('*');

    // 🟢 UPDATED LOGIC:
    if (filterMode === 'future') {
        // Show EVERYTHING coming up (No 7-day limit)
        query = query.gte('match_date', new Date().toISOString())
                     .order('match_date', { ascending: true })
                     .limit(50); // Shows next 50 upcoming games
    } else if (filterMode === 'finished') {
        // Show history
        query = query.lte('match_date', new Date().toISOString())
                     .order('match_date', { ascending: false })
                     .limit(50);
    } else {
        // "This Week" (Focus Mode)
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);
        query = query.gte('match_date', yesterday.toISOString())
                     .lte('match_date', nextWeek.toISOString())
                     .order('match_date', { ascending: true });
    }

    if (search) query = query.or(`home_team.ilike.%${search}%,away_team.ilike.%${search}%`);
    
    const { data } = await query;
    if (data) setMatches(data);
    setLoading(false);
  };

  // ... (Keep handleCreate, handleUpdateChange, saveMatch, settlePoints, deleteMatch exactly as before)
  // For brevity, I am not repeating the helper functions unless you need them. 
  // They are identical to the previous code.

  // ... (Keep groupedMatches logic)
  const groupedMatches: { [key: string]: any[] } = {};
  matches.forEach(m => {
      const dateKey = new Date(m.match_date).toDateString();
      if (!groupedMatches[dateKey]) groupedMatches[dateKey] = [];
      groupedMatches[dateKey].push(m);
  });

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 sticky top-0 bg-slate-50 z-20 py-2">
        <div>
            <h1 className="text-2xl font-black text-slate-900">Match Manager</h1>
            <p className="text-sm text-slate-500">Manage fixtures & Widget IDs.</p>
        </div>
        <div className="flex items-center gap-2">
            <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
                <button onClick={()=>setFilterMode('week')} className={`px-3 py-1 text-xs font-bold rounded ${filterMode==='week'?'bg-slate-100 text-slate-900':'text-slate-400'}`}>This Week</button>
                <button onClick={()=>setFilterMode('future')} className={`px-3 py-1 text-xs font-bold rounded ${filterMode==='future'?'bg-slate-100 text-slate-900':'text-slate-400'}`}>All Upcoming</button>
                <button onClick={()=>setFilterMode('finished')} className={`px-3 py-1 text-xs font-bold rounded ${filterMode==='finished'?'bg-slate-100 text-slate-900':'text-slate-400'}`}>History</button>
            </div>
            <button onClick={() => setIsCreating(!isCreating)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg transition text-sm">
                <Plus size={16} /> New
            </button>
        </div>
      </div>

      {/* ... (Keep Create Form, Search, and Match List Rendering exactly as before) */}
      {/* If you need the full render code again, let me know, but it is just the layout! */}
      
      {/* SEARCH */}
      <div className="relative mb-6">
         <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
         <input type="text" placeholder="Search matches..." className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500 transition shadow-sm" value={search} onChange={(e) => setSearch(e.target.value)}/>
      </div>

      <div className="space-y-8">
        {Object.keys(groupedMatches).map((dateKey) => (
            <div key={dateKey}>
                <h3 className="font-black text-slate-400 uppercase text-xs tracking-wider mb-3 sticky top-20 bg-slate-50/90 backdrop-blur py-2 z-10 w-fit px-3 rounded">{dateKey}</h3>
                <div className="space-y-4">
                    {groupedMatches[dateKey].map((match) => (
                        <div key={match.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col lg:flex-row ${match.status === 'FT' ? 'opacity-70 border-slate-200' : 'border-blue-100'}`}>
                             {/* ... Paste the inner content of the match card from the previous code here ... */}
                             {/* It is safe to use the previous card layout code. */}
                             <div className="p-4 w-full text-center">
                                {match.home_team} vs {match.away_team} 
                                {/* (I'm simplifying here to save space, but use your full card code!) */}
                             </div>
                        </div>
                    ))}
                </div>
            </div>
        ))}
      </div>
    </div>
  );
}