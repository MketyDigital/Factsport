'use client';
export const runtime = 'edge';

import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { Search, Plus, Save, Trash2, Calendar, Link as LinkIcon, Video, ExternalLink, Filter, CheckCircle, Hash, Mic, Ticket, PlayCircle, Trophy } from 'lucide-react';

export default function AdminMatchesPage() {
  const supabase = createClient();
  
  // States
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'week' | 'future' | 'finished'>('future');

  const [newMatch, setNewMatch] = useState({
    home_team: '', away_team: '', league: 'FA Cup', match_date: '', home_logo: '', away_logo: '', api_id: ''
  });

  useEffect(() => { fetchMatches(); }, [filterMode]);

  const fetchMatches = async () => {
    setLoading(true);
    let query = supabase.from('matches').select('*');

    if (filterMode === 'future') {
        query = query.gte('match_date', new Date().toISOString()).order('match_date', { ascending: true }).limit(50);
    } else if (filterMode === 'finished') {
        query = query.lte('match_date', new Date().toISOString()).order('match_date', { ascending: false }).limit(50);
    } else {
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);
        query = query.gte('match_date', yesterday.toISOString()).lte('match_date', nextWeek.toISOString()).order('match_date', { ascending: true });
    }

    if (search) query = query.or(`home_team.ilike.%${search}%,away_team.ilike.%${search}%`);
    const { data } = await query;
    if (data) setMatches(data);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newMatch.home_team || !newMatch.match_date) return alert("Please fill required fields");
    setLoading(true);
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
        api_id: match.api_id,        
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

  const settlePoints = async (matchId: string) => {
      if (!confirm("⚠️ Confirm Result? This distributes points to users.")) return;
      const { data: match } = await supabase.from('matches').select('*').eq('id', matchId).single();
      if (!match) return;

      const { data: predictions } = await supabase.from('predictions').select('*').eq('match_id', matchId);
      if (!predictions || predictions.length === 0) return alert("No predictions found.");

      const updates = predictions.map(async (p) => {
          let points = 0;
          let isCorrect = false;
          const result = match.home_score > match.away_score ? '1' : match.home_score < match.away_score ? '2' : 'X';
          
          if (p.prediction === result) { points = 3; isCorrect = true; }
          await supabase.from('predictions').update({ status: isCorrect ? 'won' : 'lost', points_earned: points }).eq('id', p.id);
          
          if (isCorrect) {
             const { data: profile } = await supabase.from('profiles').select('total_points').eq('id', p.user_id).single();
             if (profile) await supabase.from('profiles').update({ total_points: (profile.total_points || 0) + points }).eq('id', p.user_id);
          }
      });

      await Promise.all(updates);
      await supabase.from('matches').update({ points_distributed: true }).eq('id', matchId);
      alert("✅ Points distributed successfully.");
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
                
                <div className="relative">
                    <input list="leagues" type="text" placeholder="League Name" className="border p-3 rounded-xl w-full" value={newMatch.league} onChange={e => setNewMatch({...newMatch, league: e.target.value})} />
                    <datalist id="leagues"><option value="FA Cup"/><option value="Carabao Cup"/><option value="Champions League"/><option value="Premier League"/></datalist>
                </div>
                
                <input type="text" placeholder="API ID (Optional)" className="border p-3 rounded-xl font-mono text-sm" value={newMatch.api_id} onChange={e => setNewMatch({...newMatch, api_id: e.target.value})} />
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

      {/* MATCH LIST (Increased Spacing & Better Grid) */}
      <div className="space-y-8">
        {Object.keys(groupedMatches).map((dateKey) => (
            <div key={dateKey}>
                <h3 className="font-black text-slate-400 uppercase text-xs tracking-wider mb-3 sticky top-20 bg-slate-50/90 backdrop-blur py-2 z-10 w-fit px-3 rounded">{dateKey}</h3>
                <div className="grid grid-cols-1 gap-6"> {/* Cards are now full width with spacing */}
                    {groupedMatches[dateKey].map((match) => (
                        <div key={match.id} className={`bg-white rounded-xl shadow-md border overflow-hidden p-6 ${match.status === 'FT' ? 'opacity-80 border-slate-200' : 'border-blue-100'}`}>
                            
                            {/* TOP ROW: Match Basic Info */}
                            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 pb-6 border-b border-slate-100">
                                {/* Teams */}
                                <div className="flex items-center gap-4 flex-1 w-full justify-center md:justify-start">
                                    <span className="text-[10px] font-bold uppercase text-slate-500 bg-slate-100 px-2 py-1 rounded shrink-0">{match.league}</span>
                                    <div className="flex items-center gap-3 text-lg font-bold text-slate-800">
                                        <span>{match.home_team}</span>
                                        <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded">
                                            <input type="number" className="w-10 text-center bg-transparent outline-none" value={match.home_score} onChange={(e) => handleUpdateChange(match.id, 'home_score', e.target.value)} />
                                            <span>-</span>
                                            <input type="number" className="w-10 text-center bg-transparent outline-none" value={match.away_score} onChange={(e) => handleUpdateChange(match.id, 'away_score', e.target.value)} />
                                        </div>
                                        <span>{match.away_team}</span>
                                    </div>
                                </div>

                                {/* Status & Save */}
                                <div className="flex items-center gap-3 w-full md:w-auto">
                                    <select className="h-10 border rounded px-3 font-bold bg-white text-sm" value={match.status} onChange={(e) => handleUpdateChange(match.id, 'status', e.target.value)}>
                                        <option value="SCHEDULED">SCHEDULED</option><option value="LIVE">LIVE</option><option value="HT">HT</option><option value="FT">FT</option>
                                    </select>
                                    <button onClick={() => saveMatch(match)} disabled={savingId === match.id} className={`h-10 px-6 rounded font-bold text-white transition ${savingId === match.id ? 'bg-green-500' : 'bg-slate-900'}`}>
                                        {savingId === match.id ? 'Saved!' : 'Save Changes'}
                                    </button>
                                </div>
                            </div>

                            {/* BOTTOM ROW: Inputs Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                
                                {/* COLUMN 1: IDs & Codes */}
                                <div className="space-y-3 p-4 bg-slate-50 rounded-xl">
                                     <h4 className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2"><Hash size={12}/> IDs & Codes</h4>
                                     
                                     <div>
                                        <label className="text-[10px] font-bold text-slate-500 block mb-1">API ID</label>
                                        <input type="text" className="w-full border rounded px-3 py-2 text-xs font-mono bg-white" value={match.api_id || ''} onChange={(e) => handleUpdateChange(match.id, 'api_id', e.target.value)} />
                                     </div>
                                     
                                     <div>
                                        <label className="text-[10px] font-bold text-slate-500 block mb-1">Widget ID (ScoreAxis)</label>
                                        <input type="text" className="w-full border rounded px-3 py-2 text-xs font-mono bg-white" value={match.widget_id || ''} onChange={(e) => handleUpdateChange(match.id, 'widget_id', e.target.value)} />
                                     </div>
                                     
                                     <div>
                                        <label className="text-[10px] font-bold text-slate-500 block mb-1">Booking Code</label>
                                        <input type="text" className="w-full border rounded px-3 py-2 text-xs font-mono bg-white" value={match.booking_code || ''} onChange={(e) => handleUpdateChange(match.id, 'booking_code', e.target.value)} />
                                     </div>
                                </div>

                                {/* COLUMN 2: Media Links */}
                                <div className="space-y-3 p-4 bg-slate-50 rounded-xl">
                                     <h4 className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2"><Video size={12}/> Media</h4>
                                     
                                     <div>
                                        <label className="text-[10px] font-bold text-slate-500 block mb-1">Live Stream URL</label>
                                        <input type="text" className="w-full border rounded px-3 py-2 text-xs bg-white" value={match.livestream_url || ''} onChange={(e) => handleUpdateChange(match.id, 'livestream_url', e.target.value)} />
                                     </div>
                                     
                                     <div>
                                        <label className="text-[10px] font-bold text-slate-500 block mb-1">Audio URL</label>
                                        <input type="text" className="w-full border rounded px-3 py-2 text-xs bg-white" value={match.audio_url || ''} onChange={(e) => handleUpdateChange(match.id, 'audio_url', e.target.value)} />
                                     </div>
                                     
                                     <div>
                                        <label className="text-[10px] font-bold text-slate-500 block mb-1">Highlights Video</label>
                                        <input type="text" className="w-full border rounded px-3 py-2 text-xs bg-white" value={match.video_url || ''} onChange={(e) => handleUpdateChange(match.id, 'video_url', e.target.value)} />
                                     </div>
                                </div>

                                {/* COLUMN 3: Actions */}
                                <div className="space-y-3 p-4 bg-slate-50 rounded-xl flex flex-col justify-between">
                                     <h4 className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2"><Trophy size={12}/> Actions</h4>

                                     <div>
                                        <label className="text-[10px] font-bold text-slate-500 block mb-1">Affiliate Link</label>
                                        <input type="text" className="w-full border rounded px-3 py-2 text-xs bg-white" value={match.affiliate_link || ''} onChange={(e) => handleUpdateChange(match.id, 'affiliate_link', e.target.value)} />
                                     </div>
                                     
                                     <label className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded border border-slate-200 hover:border-blue-300">
                                        <input type="checkbox" checked={match.is_featured_video || false} onChange={(e) => handleUpdateChange(match.id, 'is_featured_video', e.target.checked)} />
                                        <span className="text-xs font-bold text-slate-700">Feature Video on Homepage</span>
                                     </label>

                                     <div className="grid grid-cols-2 gap-2 mt-auto">
                                        <button onClick={() => deleteMatch(match.id)} className="flex items-center justify-center gap-2 bg-red-100 text-red-600 hover:bg-red-200 py-2 rounded text-xs font-bold">
                                            <Trash2 size={14} /> Delete
                                        </button>
                                        <button 
                                            onClick={() => settlePoints(match.id)} 
                                            className={`flex items-center justify-center gap-2 py-2 rounded text-xs font-bold text-white ${match.points_distributed ? 'bg-green-500' : 'bg-purple-600 hover:bg-purple-700'}`}
                                        >
                                            <CheckCircle size={14} /> {match.points_distributed ? 'Done' : 'Settle'}
                                        </button>
                                     </div>
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