'use client';
export const runtime = 'edge';

import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { 
  Search, Plus, Save, Trash2, Calculator, 
  Loader2, Link as LinkIcon, Video, Calendar, Image as ImageIcon,
  CheckCircle, Radio, Mic, Hash
} from 'lucide-react';

export default function AdminMatchesPage() {
  const supabase = createClient();
    
  // States
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  // New Match Form State
  const [newMatch, setNewMatch] = useState({
    home_team: '',
    away_team: '',
    league: 'Premier League',
    match_date: '',
    home_logo: '', 
    away_logo: ''
  });

  // 1. Fetch Matches on Load
  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    setLoading(true);
    let query = supabase.from('matches').select('*').order('match_date', { ascending: false }).limit(50);
      
    if (search) {
      query = query.or(`home_team.ilike.%${search}%,away_team.ilike.%${search}%`);
    }

    const { data } = await query;
    if (data) setMatches(data);
    setLoading(false);
  };

  // 2. Create a New Match
  const handleCreate = async () => {
    if (!newMatch.home_team || !newMatch.away_team || !newMatch.match_date) {
        alert("Please fill in Team Names and Date");
        return;
    }
    setLoading(true);
    const { error } = await supabase.from('matches').insert([{
        ...newMatch,
        status: 'SCHEDULED' 
    }]);
      
    if (error) alert("Error creating match: " + error.message);
    else {
        setIsCreating(false);
        setNewMatch({ home_team: '', away_team: '', league: 'Premier League', match_date: '', home_logo: '', away_logo: '' });
        fetchMatches(); 
    }
    setLoading(false);
  };

  // 3. Update Existing Match (Live Edit)
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
        widget_id: match.widget_id, // 🟢 ADDED: Allows saving Widget ID
        booking_code: match.booking_code,
        affiliate_link: match.affiliate_link,
        video_url: match.video_url,         
        livestream_url: match.livestream_url, 
        audio_url: match.audio_url,         
        is_featured_video: match.is_featured_video,
        points_distributed: match.points_distributed 
    }).eq('id', match.id);

    if (error) alert("Save failed: " + error.message);
    
    setTimeout(() => setSavingId(null), 1000);
  };

  // 4. Distribute Points
  const settlePoints = async (matchId: string) => {
    if (!confirm("⚠️ CONFIRM SETTLEMENT: \n\nAre you sure the match is finished? \nThis will calculate points for all users.")) return;
    
    const { error } = await supabase.rpc('settle_match_points', { 
        target_match_id: matchId 
    });
    
    if (error) {
        alert("Error: " + error.message);
    } else {
        alert("✅ Success! Points distributed.");
        handleUpdateChange(matchId, 'points_distributed', true);
        await supabase.from('matches').update({ points_distributed: true }).eq('id', matchId);
    }
  };

  // 5. Delete Match
  const deleteMatch = async (id: string) => {
    if (!confirm("Are you sure? This will delete all predictions associated with this match!")) return;
    await supabase.from('matches').delete().eq('id', id);
    fetchMatches();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
            <h1 className="text-2xl font-black text-slate-900">Match Manager</h1>
            <p className="text-sm text-slate-500">Create matches, set ESPN IDs, and manage results.</p>
        </div>
        <button 
            onClick={() => setIsCreating(!isCreating)} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition"
        >
            <Plus size={18} /> {isCreating ? 'Cancel' : 'Add New Match'}
        </button>
      </div>

      {/* CREATE FORM */}
      {isCreating && (
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-blue-100 mb-8 animate-in fade-in slide-in-from-top-4">
            <h2 className="text-sm font-black uppercase text-blue-600 mb-4 flex items-center gap-2"><Calendar size={16}/> New Match Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <input type="text" placeholder="Home Team" className="border p-3 rounded-xl font-bold" value={newMatch.home_team} onChange={e => setNewMatch({...newMatch, home_team: e.target.value})} />
                <input type="text" placeholder="Away Team" className="border p-3 rounded-xl font-bold" value={newMatch.away_team} onChange={e => setNewMatch({...newMatch, away_team: e.target.value})} />
                <input type="datetime-local" className="border p-3 rounded-xl" value={newMatch.match_date} onChange={e => setNewMatch({...newMatch, match_date: e.target.value})} />
                
                {/* 🟢 CHANGED: Allow typing custom league names like 'FA Cup' */}
                <div className="relative">
                    <input 
                        list="leagues" 
                        type="text" 
                        placeholder="League (Type or Select)" 
                        className="border p-3 rounded-xl w-full bg-white" 
                        value={newMatch.league} 
                        onChange={e => setNewMatch({...newMatch, league: e.target.value})} 
                    />
                    <datalist id="leagues">
                        <option value="Premier League"/>
                        <option value="La Liga"/>
                        <option value="Champions League"/>
                        <option value="Serie A"/>
                        <option value="Bundesliga"/>
                        <option value="Ligue 1"/>
                        <option value="FA Cup"/>
                        <option value="Carabao Cup"/>
                        <option value="Europa League"/>
                    </datalist>
                </div>

                <input type="text" placeholder="Home Logo URL (Optional)" className="border p-3 rounded-xl text-xs" value={newMatch.home_logo} onChange={e => setNewMatch({...newMatch, home_logo: e.target.value})} />
                <input type="text" placeholder="Away Logo URL (Optional)" className="border p-3 rounded-xl text-xs" value={newMatch.away_logo} onChange={e => setNewMatch({...newMatch, away_logo: e.target.value})} />
            </div>
            <div className="flex justify-end">
                <button onClick={handleCreate} disabled={loading} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold">
                    {loading ? 'Creating...' : 'Create Match'}
                </button>
            </div>
        </div>
      )}

      {/* SEARCH BAR */}
      <form onSubmit={(e) => { e.preventDefault(); fetchMatches(); }} className="flex gap-3 mb-6">
        <div className="relative flex-1">
            <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
            <input 
                type="text" 
                placeholder="Search matches..." 
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500 transition shadow-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />
        </div>
        <button type="submit" className="bg-white border border-slate-200 text-slate-700 px-6 rounded-xl font-bold hover:bg-slate-50 transition">Refresh</button>
      </form>

      {/* MATCH LIST */}
      <div className="space-y-4">
        {loading && <div className="text-center py-10"><Loader2 className="animate-spin mx-auto text-blue-600" /></div>}
        
        {matches.map((match) => (
            <div key={match.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col lg:flex-row">
                
                {/* 1. LEFT: Match Info & Score */}
                <div className="p-5 lg:w-1/3 border-b lg:border-b-0 lg:border-r border-slate-100 bg-slate-50/50">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold uppercase text-slate-400 bg-white px-2 py-1 rounded border border-slate-200">{match.league}</span>
                        <span className="text-[10px] font-mono text-slate-400">{new Date(match.match_date).toLocaleDateString()}</span>
                    </div>
                    
                    <h3 className="text-lg font-black text-slate-800 mb-4">{match.home_team} <span className="text-slate-400 font-normal">vs</span> {match.away_team}</h3>
                    
                    <div className="flex items-center gap-2 mb-4">
                        <input 
                            type="number" 
                            className="w-12 h-10 text-center font-black text-lg border rounded-lg" 
                            value={match.home_score ?? 0}
                            onChange={(e) => handleUpdateChange(match.id, 'home_score', e.target.value)}
                        />
                        <span className="font-black text-slate-300">-</span>
                        <input 
                            type="number" 
                            className="w-12 h-10 text-center font-black text-lg border rounded-lg" 
                            value={match.away_score ?? 0}
                            onChange={(e) => handleUpdateChange(match.id, 'away_score', e.target.value)}
                        />
                         <select 
                            className={`h-10 border rounded-lg text-xs font-bold px-2 ${match.status === 'LIVE' ? 'text-red-600 bg-red-50 border-red-200' : 'bg-white'}`}
                            value={match.status}
                            onChange={(e) => handleUpdateChange(match.id, 'status', e.target.value)}
                        >
                            <option value="SCHEDULED">SCHEDULED</option>
                            <option value="LIVE">LIVE</option>
                            <option value="HT">HALF TIME</option>
                            <option value="FT">FINISHED</option>
                        </select>
                    </div>

                    <div className="flex gap-2">
                         <button 
                            onClick={() => saveMatch(match)} 
                            disabled={savingId === match.id}
                            className={`flex-1 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition ${savingId === match.id ? 'bg-green-600 text-white' : 'bg-slate-900 text-white hover:bg-black'}`}
                         >
                            <Save size={14} /> {savingId === match.id ? 'Saved' : 'Save'}
                         </button>
                         <button onClick={() => deleteMatch(match.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 border border-red-100"><Trash2 size={16} /></button>
                    </div>
                </div>

                {/* 2. MIDDLE: Automation & Links */}
                <div className="p-5 lg:w-1/3 border-b lg:border-b-0 lg:border-r border-slate-100">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 mb-3">Automation & Revenue</h4>
                    
                    <div className="space-y-3">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block">ESPN Match ID (Auto-Sync)</label>
                            <div className="relative">
                                <LinkIcon size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="e.g. 690564" 
                                    className="w-full pl-8 border rounded-lg py-2 text-xs font-mono bg-blue-50/50 border-blue-100"
                                    value={match.api_id || ''}
                                    onChange={(e) => handleUpdateChange(match.id, 'api_id', e.target.value)}
                                />
                            </div>
                        </div>

                        {/* 🟢 NEW: WIDGET ID INPUT */}
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 flex justify-between">
                                ScoreAxis Widget ID
                                <a href="https://www.scoreaxis.com/widget/live-match-widget" target="_blank" className="text-blue-500 hover:underline">Get ID</a>
                            </label>
                            <div className="relative">
                                <Hash size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="e.g. 12345" 
                                    className="w-full pl-8 border rounded-lg py-2 text-xs font-mono"
                                    value={match.widget_id || ''}
                                    onChange={(e) => handleUpdateChange(match.id, 'widget_id', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 mb-1 block">Booking Code</label>
                                <input 
                                    type="text" 
                                    className="w-full border rounded-lg py-2 px-3 text-xs font-mono"
                                    value={match.booking_code || ''}
                                    onChange={(e) => handleUpdateChange(match.id, 'booking_code', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 mb-1 block">Affiliate Link</label>
                                <input 
                                    type="text" 
                                    className="w-full border rounded-lg py-2 px-3 text-xs"
                                    value={match.affiliate_link || ''}
                                    onChange={(e) => handleUpdateChange(match.id, 'affiliate_link', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. RIGHT: Live Media Center (Updated) */}
                <div className="p-5 lg:w-1/3 bg-slate-50/30 flex flex-col justify-between">
                    <div>
                         <h4 className="text-[10px] font-black uppercase text-slate-400 mb-3 flex items-center gap-1">
                            <Radio size={12} className="text-red-500" /> Live Media Center
                         </h4>
                         
                         <div className="space-y-2 mb-3">
                            <div className="relative">
                                <Video size={12} className="absolute left-2.5 top-2.5 text-red-500" />
                                <input 
                                    type="text" 
                                    placeholder="🔴 Live Stream URL (YouTube)" 
                                    className="w-full pl-8 border border-red-100 rounded-lg py-2 text-xs bg-red-50/30 focus:bg-white transition"
                                    value={match.livestream_url || ''}
                                    onChange={(e) => handleUpdateChange(match.id, 'livestream_url', e.target.value)}
                                />
                            </div>
                            <div className="relative">
                                <Mic size={12} className="absolute left-2.5 top-2.5 text-blue-500" />
                                <input 
                                    type="text" 
                                    placeholder="🎙️ Live Radio URL (Zeno/Mixlr)" 
                                    className="w-full pl-8 border border-blue-100 rounded-lg py-2 text-xs bg-blue-50/30 focus:bg-white transition"
                                    value={match.audio_url || ''}
                                    onChange={(e) => handleUpdateChange(match.id, 'audio_url', e.target.value)}
                                />
                            </div>
                            <div className="relative">
                                <ImageIcon size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="📺 Highlights URL (Post-Game)" 
                                    className="w-full pl-8 border rounded-lg py-2 text-xs text-slate-500"
                                    value={match.video_url || ''}
                                    onChange={(e) => handleUpdateChange(match.id, 'video_url', e.target.value)}
                                />
                            </div>
                         </div>
                         
                         <div className="space-y-2">
                            <label className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded border border-slate-100">
                                <input 
                                    type="checkbox" 
                                    checked={match.is_featured_video || false}
                                    onChange={(e) => handleUpdateChange(match.id, 'is_featured_video', e.target.checked)}
                                />
                                <span className="text-xs font-bold text-slate-600">Feature Video on Homepage</span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded border border-slate-100">
                                <input 
                                    type="checkbox" 
                                    checked={match.points_distributed || false}
                                    onChange={(e) => handleUpdateChange(match.id, 'points_distributed', e.target.checked)}
                                />
                                <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                                    Points Distributed?
                                    {match.points_distributed && <CheckCircle size={12} className="text-green-600" />}
                                </span>
                            </label>
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-200">
                        {match.points_distributed ? (
                             <button 
                                onClick={() => settlePoints(match.id)} 
                                className="w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 bg-green-100 text-green-700 cursor-default"
                             >
                                <CheckCircle size={16} /> POINTS DISTRIBUTED
                             </button>
                        ) : (
                             <button 
                                onClick={() => settlePoints(match.id)} 
                                className="w-full py-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-200 hover:shadow-xl hover:scale-[1.02] transition"
                             >
                                <Calculator size={16} /> DISTRIBUTE POINTS
                             </button>
                        )}
                        <p className="text-[9px] text-center text-slate-400 mt-2">
                            {match.points_distributed ? "Uncheck 'Points Distributed' above to re-run." : "Click when match is finished."}
                        </p>
                    </div>
                </div>

            </div>
        ))}
      </div>
    </div>
  );
}