'use client';
export const runtime = 'edge';

import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { Search, Plus, Save, Trash2, Calendar, Link as LinkIcon, Video, ExternalLink, Star, Filter } from 'lucide-react';

export default function AdminMatchesPage() {
  const supabase = createClient();
  
  // States
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  
  // Default to 'future' to see upcoming games easily
  const [filterMode, setFilterMode] = useState<'week' | 'future' | 'finished'>('future');

  // 🟢 UPDATED: 'league' is now a text input for flexibility (FA Cup, Friendly, etc.)
  const [newMatch, setNewMatch] = useState({
    home_team: '', away_team: '', league: 'FA Cup', match_date: '', home_logo: '', away_logo: ''
  });

  useEffect(() => { fetchMatches(); }, [filterMode]);

  const fetchMatches = async () => {
    setLoading(true);
    let query = supabase.from('matches').select('*');

    if (filterMode === 'future') {
        query = query.gte('match_date', new Date().toISOString())
                     .order('match_date', { ascending: true })
                     .limit(50);
    } else if (filterMode === 'finished') {
        query = query.lte('match_date', new Date().toISOString())
                     .order('match_date', { ascending: false })
                     .limit(50);
    } else {
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

  const handleCreate = async () => {
    if (!newMatch.home_team || !newMatch.match_date) return alert("Please fill required fields");
    setLoading(true);
    // Status defaults to SCHEDULED
    const { error } = await supabase.from('matches').insert([{ ...newMatch, status: 'SCHEDULED' }]);
    if (error) alert("Error: " + error.message);
    else { setIsCreating(false); fetchMatches(); }
    setLoading(false);
  };

  const handleUpdateChange = (id: string, field: string, value: any) => {
    setMatches(matches.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const saveMatch = async (match: any) => {
    setSavingId(match.id);
    const { error } = await supabase.from('matches').update({
        home_score: match.home_score,
        away_score: match.away_score,
        status: match.status,
        widget_id: match.widget_id,  
        booking_code: match.booking_code,
        affiliate_link: match.affiliate_link,
        video_url: match.video_url,         
        livestream_url: match.livestream_url, 
        audio_url: match.audio_url,         
        is_featured_video: match.is_featured_video
    }).eq('id', match.id);

    if (error) alert("Save failed: " + error.message);
    setTimeout(() => setSavingId(null), 1000);
  };

  const deleteMatch = async (id: string) => {
    if (!confirm("Delete this match?")) return;
    await supabase.from('matches').delete().eq('id', id);
    fetchMatches();
  };

  const groupedMatches: { [key: string]: any[] } = {};
  matches.forEach(m => {
      const dateKey = new Date(m.match_date).toDateString();
      if (!groupedMatches[dateKey]) groupedMatches[dateKey] = [];
      groupedMatches[dateKey].push(m);
  });

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      
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
                <Plus size={16} /> New Match
            </button>
        </div>
      </div>

      {/* CREATE FORM */}
      {isCreating && (
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-blue-100 mb-8 animate-in fade-in">
            <h2 className="text-sm font-black uppercase text-blue-600 mb-4 flex items-center gap-2"><Calendar size={16}/> New Manual Match</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <input type="text" placeholder="Home Team (e.g. Man City)" className="border p-3 rounded-xl font-bold" value={newMatch.home_team} onChange={e => setNewMatch({...newMatch, home_team: e.target.value})} />
                <input type="text" placeholder="Away Team (e.g. Chelsea)" className="border p-3 rounded-xl font-bold" value={newMatch.away_team} onChange={e => setNewMatch({...newMatch, away_team: e.target.value})} />
                <input type="datetime-local" className="border p-3 rounded-xl" value={newMatch.match_date} onChange={e => setNewMatch({...newMatch, match_date: e.target.value})} />
                {/* 🟢 CHANGED: Regular Input to allow typing "FA Cup" or "Friendly" */}
                <div className="relative">
                    <input list="leagues" type="text" placeholder="League Name (Type or Select)" className="border p-3 rounded-xl w-full" value={newMatch.league} onChange={e => setNewMatch({...newMatch, league: e.target.value})} />
                    <datalist id="leagues">
                        <option value="FA Cup"/>
                        <option value="Carabao Cup"/>
                        <option value="Champions League"/>
                        <option value="Premier League"/>
                        <option value="Europa League"/>
                    </datalist>
                </div>
            </div>
            <div className="flex justify-end">
                <button onClick={handleCreate} disabled={loading} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold">
                    {loading ? 'Creating...' : 'Create Match'}
                </button>
            </div>
        </div>
      )}

      {/* SEARCH */}
      <div className="relative mb-6">
         <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
         <input type="text" placeholder="Search matches..." className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500 transition shadow-sm" value={search} onChange={(e) => setSearch(e.target.value)}/>
      </div>

      {/* MATCH LIST */}
      <div className="space-y-8">
        {Object.keys(groupedMatches).map((dateKey) => (
            <div key={dateKey}>
                <h3 className="font-black text-slate-400 uppercase text-xs tracking-wider mb-3 sticky top-20 bg-slate-50/90 backdrop-blur py-2 z-10 w-fit px-3 rounded">{dateKey}</h3>
                <div className="space-y-4">
                    {groupedMatches[dateKey].map((match) => (
                        <div key={match.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col lg:flex-row ${match.status === 'FT' ? 'opacity-70 border-slate-200' : 'border-blue-100'}`}>
                            
                            {/* 1. TEAMS & SCORES */}
                            <div className="p-4 lg:w-[35%] border-b lg:border-b-0 lg:border-r border-slate-100 bg-slate-50/30">
                                <div className="flex justify-between mb-2">
                                    <span className="text-[9px] font-bold uppercase text-slate-500 border px-1.5 rounded">{match.league}</span>
                                    <span className="text-[9px] font-mono text-slate-400">{new Date(match.match_date).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
                                </div>
                                <div className="flex items-center justify-between gap-2 mb-3">
                                    <div className="font-bold text-sm text-slate-800 w-full truncate text-right">{match.home_team}</div>
                                    <div className="flex gap-1 shrink-0">
                                        <input type="number" className="w-8 h-8 text-center font-bold border rounded bg-white" value={match.home_score} onChange={(e) => handleUpdateChange(match.id, 'home_score', e.target.value)} />
                                        <input type="number" className="w-8 h-8 text-center font-bold border rounded bg-white" value={match.away_score} onChange={(e) => handleUpdateChange(match.id, 'away_score', e.target.value)} />
                                    </div>
                                    <div className="font-bold text-sm text-slate-800 w-full truncate">{match.away_team}</div>
                                </div>
                                <div className="flex gap-2">
                                    <select className="h-8 border rounded text-xs font-bold px-1 bg-white flex-1" value={match.status} onChange={(e) => handleUpdateChange(match.id, 'status', e.target.value)}>
                                        <option value="SCHEDULED">SCHEDULED</option><option value="LIVE">LIVE</option><option value="HT">HT</option><option value="FT">FT</option>
                                    </select>
                                    <button onClick={() => saveMatch(match)} disabled={savingId === match.id} className={`px-4 py-1 rounded text-xs font-bold text-white transition ${savingId === match.id ? 'bg-green-500' : 'bg-slate-900'}`}>
                                        {savingId === match.id ? 'Saved' : 'Save'}
                                    </button>
                                </div>
                            </div>

                            {/* 2. WIDGET & LINKS */}
                            <div className="p-4 lg:w-[35%] border-b lg:border-b-0 lg:border-r border-slate-100">
                                <div className="flex flex-col gap-3 h-full justify-center">
                                     <div className={`p-2 rounded border ${match.widget_id ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                         <div className="flex justify-between mb-1">
                                            <label className="text-[9px] font-bold text-slate-600">Widget ID (For FA Cup/Other)</label>
                                            <a href="https://www.scoreaxis.com/widget/live-match-widget" target="_blank" className="text-[9px] text-blue-600 underline font-bold">Get ID</a>
                                         </div>
                                         <input type="text" placeholder="Paste ScoreAxis ID..." className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono" value={match.widget_id || ''} onChange={(e) => handleUpdateChange(match.id, 'widget_id', e.target.value)} />
                                     </div>
                                     <div className="grid grid-cols-2 gap-2">
                                         <input type="text" placeholder="Booking Code" className="border rounded px-2 py-1 text-xs" value={match.booking_code || ''} onChange={(e) => handleUpdateChange(match.id, 'booking_code', e.target.value)} />
                                         <input type="text" placeholder="Affiliate Link" className="border rounded px-2 py-1 text-xs" value={match.affiliate_link || ''} onChange={(e) => handleUpdateChange(match.id, 'affiliate_link', e.target.value)} />
                                     </div>
                                </div>
                            </div>

                            {/* 3. MEDIA */}
                            <div className="p-4 lg:w-[30%] bg-slate-50/20 flex flex-col gap-2">
                                <input type="text" placeholder="🔴 Live Stream URL" className="w-full border rounded px-2 py-1 text-xs" value={match.livestream_url || ''} onChange={(e) => handleUpdateChange(match.id, 'livestream_url', e.target.value)} />
                                <div className="flex items-center justify-between mt-1">
                                    <label className="flex items-center gap-1 cursor-pointer">
                                        <input type="checkbox" checked={match.is_featured_video || false} onChange={(e) => handleUpdateChange(match.id, 'is_featured_video', e.target.checked)} />
                                        <span className="text-[10px] font-bold text-slate-500">Feature</span>
                                    </label>
                                    <button onClick={() => deleteMatch(match.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                                </div>
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