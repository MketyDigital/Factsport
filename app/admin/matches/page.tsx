'use client';
export const runtime = 'edge';

import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { 
  Search, Plus, Save, Trash2, Calculator, Loader2, 
  Link as LinkIcon, Video, Calendar, Image as ImageIcon, 
  CheckCircle, Radio, Mic, ExternalLink, Youtube, Star 
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
    home_team: '', away_team: '', league: 'Premier League', match_date: '', home_logo: '', away_logo: ''
  });

  // 1. Fetch Matches
  useEffect(() => { fetchMatches(); }, []);

  const fetchMatches = async () => {
    setLoading(true);
    let query = supabase.from('matches').select('*').order('match_date', { ascending: false }).limit(50);
    if (search) query = query.or(`home_team.ilike.%${search}%,away_team.ilike.%${search}%`);
    const { data } = await query;
    if (data) setMatches(data);
    setLoading(false);
  };

  // 2. Create Match
  const handleCreate = async () => {
    if (!newMatch.home_team || !newMatch.match_date) return alert("Please fill required fields");
    setLoading(true);
    const { error } = await supabase.from('matches').insert([{ ...newMatch, status: 'SCHEDULED' }]);
    if (error) alert("Error: " + error.message);
    else { setIsCreating(false); fetchMatches(); }
    setLoading(false);
  };

  // 3. Update Match
  const handleUpdateChange = (id: string, field: string, value: any) => {
    setMatches(matches.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const saveMatch = async (match: any) => {
    setSavingId(match.id);
    const { error } = await supabase.from('matches').update({
        home_score: match.home_score,
        away_score: match.away_score,
        status: match.status,
        api_id: match.api_id,        // Football-Data ID
        widget_id: match.widget_id,  // ScoreAxis Widget ID
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

  // 4. Points Settlement
  const settlePoints = async (matchId: string) => {
    if (!confirm("⚠️ Are you sure the match is finished? This will calculate points.")) return;
    const { error } = await supabase.rpc('settle_match_points', { target_match_id: matchId });
    if (error) alert("Error: " + error.message);
    else { alert("✅ Success! Points distributed."); handleUpdateChange(matchId, 'points_distributed', true); }
  };

  // 5. Delete
  const deleteMatch = async (id: string) => {
    if (!confirm("Delete this match?")) return;
    await supabase.from('matches').delete().eq('id', id);
    fetchMatches();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      
      {/* PAGE HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
            <h1 className="text-2xl font-black text-slate-900">Match Manager</h1>
            <p className="text-sm text-slate-500">Manage Scores, APIs, and Media Links.</p>
        </div>
        <button onClick={() => setIsCreating(!isCreating)} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition">
            <Plus size={18} /> {isCreating ? 'Cancel' : 'Add New Match'}
        </button>
      </div>

      {/* CREATE FORM */}
      {isCreating && (
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-blue-100 mb-8 animate-in fade-in">
            <h2 className="text-sm font-black uppercase text-blue-600 mb-4 flex items-center gap-2"><Calendar size={16}/> New Match Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <input type="text" placeholder="Home Team" className="border p-3 rounded-xl font-bold" value={newMatch.home_team} onChange={e => setNewMatch({...newMatch, home_team: e.target.value})} />
                <input type="text" placeholder="Away Team" className="border p-3 rounded-xl font-bold" value={newMatch.away_team} onChange={e => setNewMatch({...newMatch, away_team: e.target.value})} />
                <input type="datetime-local" className="border p-3 rounded-xl" value={newMatch.match_date} onChange={e => setNewMatch({...newMatch, match_date: e.target.value})} />
                <select className="border p-3 rounded-xl bg-white" value={newMatch.league} onChange={e => setNewMatch({...newMatch, league: e.target.value})}>
                    <option>Premier League</option><option>La Liga</option><option>Champions League</option><option>Serie A</option><option>Bundesliga</option><option>Ligue 1</option><option>Other</option>
                </select>
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

      {/* SEARCH */}
      <div className="relative mb-6">
         <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
         <input type="text" placeholder="Search matches..." className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500 transition shadow-sm" value={search} onChange={(e) => setSearch(e.target.value)}/>
      </div>

      {/* MATCH LIST */}
      <div className="space-y-4">
        {matches.map((match) => (
            <div key={match.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col lg:flex-row">
                
                {/* 1. LEFT: Score & Status */}
                <div className="p-5 lg:w-[35%] border-b lg:border-b-0 lg:border-r border-slate-100 bg-slate-50/50">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold uppercase text-slate-400 bg-white px-2 py-1 rounded border border-slate-200">{match.league}</span>
                        <span className="text-[10px] font-mono text-slate-400">{new Date(match.match_date).toLocaleDateString()}</span>
                    </div>
                    
                    <h3 className="text-lg font-black text-slate-800 mb-4">{match.home_team} <span className="text-slate-400 font-normal">vs</span> {match.away_team}</h3>
                    
                    <div className="flex items-center gap-2 mb-4">
                        <input type="number" className="w-12 h-10 text-center font-black text-lg border rounded-lg" value={match.home_score ?? 0} onChange={(e) => handleUpdateChange(match.id, 'home_score', e.target.value)} />
                        <span className="font-black text-slate-300">-</span>
                        <input type="number" className="w-12 h-10 text-center font-black text-lg border rounded-lg" value={match.away_score ?? 0} onChange={(e) => handleUpdateChange(match.id, 'away_score', e.target.value)} />
                         <select className={`h-10 border rounded-lg text-xs font-bold px-2 ${match.status === 'LIVE' ? 'text-red-600 bg-red-50 border-red-200' : 'bg-white'}`} value={match.status} onChange={(e) => handleUpdateChange(match.id, 'status', e.target.value)}>
                            <option value="SCHEDULED">SCHEDULED</option><option value="LIVE">LIVE</option><option value="HT">HT</option><option value="FT">FT</option>
                        </select>
                    </div>

                    <div className="flex gap-2">
                         <button onClick={() => saveMatch(match)} disabled={savingId === match.id} className={`flex-1 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition ${savingId === match.id ? 'bg-green-600 text-white' : 'bg-slate-900 text-white hover:bg-black'}`}>
                            <Save size={14} /> {savingId === match.id ? 'Saved' : 'Save'}
                         </button>
                         <button onClick={() => deleteMatch(match.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 border border-red-100"><Trash2 size={16} /></button>
                    </div>
                </div>

                {/* 2. MIDDLE: Automation & Revenue */}
                <div className="p-5 lg:w-[30%] border-b lg:border-b-0 lg:border-r border-slate-100">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 mb-3">IDs & Revenue</h4>
                    <div className="space-y-3">
                        {/* API ID */}
                        <div>
                            <label className="text-[9px] font-bold text-slate-500 mb-1 block">Football-Data ID (Auto-Sync)</label>
                            <input type="text" className="w-full pl-2 border rounded-lg py-2 text-xs font-mono bg-slate-50 border-slate-200" value={match.api_id || ''} onChange={(e) => handleUpdateChange(match.id, 'api_id', e.target.value)} />
                        </div>
                        
                        {/* WIDGET ID */}
                        <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100">
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[9px] font-bold text-blue-800">ScoreAxis Widget ID</label>
                                <a href="https://www.scoreaxis.com/widget/live-match-widget" target="_blank" className="text-[9px] text-blue-600 hover:underline font-bold flex items-center gap-1">Find ID <ExternalLink size={8}/></a>
                            </div>
                            <input type="text" placeholder="e.g. 66717b..." className="w-full border border-blue-200 rounded-lg py-1.5 px-2 text-xs font-mono bg-white" value={match.widget_id || ''} onChange={(e) => handleUpdateChange(match.id, 'widget_id', e.target.value)} />
                        </div>

                        {/* BETTING LINKS */}
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[9px] font-bold text-slate-500 block">Booking Code</label>
                                <input type="text" className="w-full border rounded-lg py-1.5 px-2 text-xs font-mono" value={match.booking_code || ''} onChange={(e) => handleUpdateChange(match.id, 'booking_code', e.target.value)} />
                            </div>
                            <div>
                                <label className="text-[9px] font-bold text-slate-500 block">Affiliate Link</label>
                                <input type="text" className="w-full border rounded-lg py-1.5 px-2 text-xs" value={match.affiliate_link || ''} onChange={(e) => handleUpdateChange(match.id, 'affiliate_link', e.target.value)} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. RIGHT: Media & Feature */}
                <div className="p-5 lg:w-[35%] bg-slate-50/30 flex flex-col justify-between">
                     <h4 className="text-[10px] font-black uppercase text-slate-400 mb-3 flex items-center gap-1"><Radio size={12} className="text-red-500" /> Live Media</h4>
                     
                     <div className="space-y-2 mb-3">
                        <div className="relative">
                            <Video size={12} className="absolute left-2.5 top-2.5 text-red-500" />
                            <input type="text" placeholder="🔴 Live Watchalong URL" className="w-full pl-8 border border-red-100 rounded-lg py-2 text-xs bg-red-50/30 focus:bg-white transition" value={match.livestream_url || ''} onChange={(e) => handleUpdateChange(match.id, 'livestream_url', e.target.value)} />
                        </div>
                        <div className="relative">
                            <Mic size={12} className="absolute left-2.5 top-2.5 text-blue-500" />
                            <input type="text" placeholder="🎙️ Audio/Radio URL" className="w-full pl-8 border border-blue-100 rounded-lg py-2 text-xs bg-blue-50/30 focus:bg-white transition" value={match.audio_url || ''} onChange={(e) => handleUpdateChange(match.id, 'audio_url', e.target.value)} />
                        </div>
                        <div className="relative">
                            <Youtube size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
                            <input type="text" placeholder="📺 Post-Match Highlights URL" className="w-full pl-8 border rounded-lg py-2 text-xs text-slate-500" value={match.video_url || ''} onChange={(e) => handleUpdateChange(match.id, 'video_url', e.target.value)} />
                        </div>
                     </div>

                     <div className="space-y-2">
                        {/* FEATURE TOGGLE */}
                        <label className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded border border-slate-100 hover:bg-slate-50">
                            <input type="checkbox" checked={match.is_featured_video || false} onChange={(e) => handleUpdateChange(match.id, 'is_featured_video', e.target.checked)} />
                            <span className="text-xs font-bold text-slate-600 flex items-center gap-1">Feature on Homepage <Star size={10} className="text-yellow-500 fill-yellow-500"/></span>
                        </label>

                        {/* POINTS BUTTON */}
                        <div className="mt-2">
                             {match.points_distributed ? (
                                  <button onClick={() => settlePoints(match.id)} className="w-full py-2 bg-green-100 text-green-700 text-xs font-bold rounded flex items-center justify-center gap-2 cursor-default">
                                     <CheckCircle size={14} /> POINTS DISTRIBUTED
                                  </button>
                             ) : (
                                  <button onClick={() => settlePoints(match.id)} className="w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold rounded shadow-lg hover:shadow-xl transition flex items-center justify-center gap-2">
                                     <Calculator size={14} /> DISTRIBUTE POINTS
                                  </button>
                             )}
                        </div>
                     </div>
                </div>

            </div>
        ))}
      </div>
    </div>
  );
}