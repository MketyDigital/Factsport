'use client';
export const runtime = 'edge';

import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { 
  Search, Plus, Save, Trash2, Calculator, 
  Calendar, Star, Eye, Terminal, CheckCircle, ChevronLeft, ChevronRight, Image as ImageIcon, Link as LinkIcon
} from 'lucide-react';

const ITEMS_PER_PAGE = 10;

export default function AdminMatchesPage() {
  const supabase = createClient();
    
  // States
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  
  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // 🟢 UPGRADED: Full Match Template
  const [newMatch, setNewMatch] = useState({
    home_team: '', away_team: '', league: 'Premier League', match_date: '', 
    home_logo: '', away_logo: '', venue: '', stage: '', match_group: '', api_id: ''
  });

  // Reset to page 1 when searching
  useEffect(() => { 
      setCurrentPage(1);
      const timer = setTimeout(() => fetchMatches(1), 500);
      return () => clearTimeout(timer);
  }, [search]);

  // Fetch when page changes
  useEffect(() => {
      fetchMatches(currentPage);
  }, [currentPage]);

  const fetchMatches = async (page: number) => {
    setLoading(true);
    
    const from = (page - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    let query = supabase.from('matches').select('*', { count: 'exact' });

    // 🧠 SMARTER SEARCH: Handles "Chelsea vs Arsenal" or "Premier League"
    if (search) {
        const cleanSearch = search.replace(/ vs | v | - /gi, ' ').trim();
        const terms = cleanSearch.split(' ').filter(Boolean);
        
        // Search across Home Team, Away Team, and League
        let orString = `home_team.ilike.%${search}%,away_team.ilike.%${search}%,league.ilike.%${search}%`;
        
        // If they typed multiple words (like "Chelsea Arsenal"), try to match them individually
        if (terms.length > 1) {
            orString += `,home_team.ilike.%${terms[0]}%,away_team.ilike.%${terms[1]}%`;
        }
        
        query = query.or(orString);
    }

    query = query.order('match_date', { ascending: false }).range(from, to);
    
    const { data, count } = await query;
    if (data) setMatches(data);
    if (count !== null) setTotalPages(Math.ceil(count / ITEMS_PER_PAGE) || 1);
    
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newMatch.home_team || !newMatch.away_team || !newMatch.match_date) return alert("Required fields missing");
    setLoading(true);

    const isoDate = new Date(newMatch.match_date).toISOString();

    const { error } = await supabase.from('matches').insert([{ 
        ...newMatch, 
        match_date: isoDate, 
        status: 'SCHEDULED', 
        is_featured: false,
        points_distributed: false,
        api_id: newMatch.api_id ? parseInt(newMatch.api_id) : null
    }]);

    if (error) alert("Error: " + error.message);
    else { 
        setIsCreating(false); 
        setNewMatch({ home_team: '', away_team: '', league: 'Premier League', match_date: '', home_logo: '', away_logo: '', venue: '', stage: '', match_group: '', api_id: '' }); 
        fetchMatches(currentPage); 
    }
    setLoading(false);
  };

  const handleUpdateChange = (id: string, field: string, value: any) => {
    setMatches(matches.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const saveMatch = async (match: any) => {
    const sanitize = (url: string) => url?.trim().toLowerCase().startsWith('javascript:') ? '' : url;

    setSavingId(match.id);
    const { error } = await supabase.from('matches').update({
        home_score: match.home_score,
        away_score: match.away_score,
        status: match.status,
        api_id: match.api_id, 
        widget_id: match.widget_id,
        booking_code: match.booking_code,
        affiliate_link: sanitize(match.affiliate_link),
        video_url: sanitize(match.video_url),        
        livestream_url: sanitize(match.livestream_url), 
        audio_url: sanitize(match.audio_url),        
        is_featured: match.is_featured,
        is_featured_video: match.is_featured_video,
        points_distributed: match.points_distributed,
        displayClock: match.displayClock,
        venue: match.venue,
        stage: match.stage,
        match_group: match.match_group 
    }).eq('id', match.id);

    if (error) alert("Save failed: " + error.message);
    setTimeout(() => setSavingId(null), 1000);
  };

  const settlePoints = async (match: any) => {
    if (match.points_distributed) {
        if (!confirm("⚠️ POINTS ALREADY DISTRIBUTED!\n\nRun again?")) return;
    } else {
        if (!confirm(`Confirm Settlement:\n${match.home_team} ${match.home_score}-${match.away_score} ${match.away_team}`)) return;
    }

    const { error } = await supabase.rpc('settle_match_points', { target_match_id: match.id });
    if (error) alert("Error: " + error.message);
    else {
        alert("✅ Points distributed.");
        handleUpdateChange(match.id, 'points_distributed', true);
        await supabase.from('matches').update({ points_distributed: true }).eq('id', match.id);
    }
  };

  const deleteMatch = async (id: string) => {
    if (!confirm("Delete match?")) return;
    await supabase.from('matches').delete().eq('id', id);
    fetchMatches(currentPage);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900 pb-24">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                <Terminal size={24} className="text-blue-600"/> Match Manager
            </h1>
            <p className="text-sm text-slate-500">Manage Schedule, Live Scores, Rich Data, and Settlement.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-72">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                    type="text" 
                    placeholder="Search teams, leagues, or 'A vs B'..." 
                    className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:border-blue-500 outline-none shadow-sm"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>
            <button onClick={() => setIsCreating(!isCreating)} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex justify-center items-center gap-2 shadow-lg transition whitespace-nowrap">
                <Plus size={18} /> {isCreating ? 'Cancel' : 'Add New Match'}
            </button>
        </div>
      </div>

      {/* FULL CREATE FORM */}
      {isCreating && (
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-blue-100 mb-8 animate-in fade-in slide-in-from-top-4">
            <h2 className="text-sm font-black uppercase text-blue-600 mb-4 flex items-center gap-2"><Calendar size={16}/> New Match Details</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <input type="text" placeholder="Home Team" className="border p-3 rounded-xl font-bold bg-slate-50" value={newMatch.home_team} onChange={e => setNewMatch({...newMatch, home_team: e.target.value})} />
                <input type="text" placeholder="Away Team" className="border p-3 rounded-xl font-bold bg-slate-50" value={newMatch.away_team} onChange={e => setNewMatch({...newMatch, away_team: e.target.value})} />
                
                <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 mb-1">Date & Time (Local)</label>
                    <input type="datetime-local" className="border p-3 rounded-xl bg-slate-50" value={newMatch.match_date} onChange={e => setNewMatch({...newMatch, match_date: e.target.value})} />
                </div>
                
                <div className="relative flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 mb-1">League</label>
                    <input list="leagues" type="text" placeholder="Select League" className="border p-3 rounded-xl w-full bg-slate-50" value={newMatch.league} onChange={e => setNewMatch({...newMatch, league: e.target.value})} />
                    <datalist id="leagues">
                        <option value="Premier League"/><option value="La Liga"/><option value="Champions League"/><option value="Serie A"/>
                        <option value="Bundesliga"/><option value="Ligue 1"/><option value="Europa League"/><option value="FA Cup"/>
                    </datalist>
                </div>

                <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1"><ImageIcon size={10}/> Home Logo URL</label>
                    <input type="text" placeholder="https://..." className="border p-3 rounded-xl text-sm bg-slate-50" value={newMatch.home_logo} onChange={e => setNewMatch({...newMatch, home_logo: e.target.value})} />
                </div>

                <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1"><ImageIcon size={10}/> Away Logo URL</label>
                    <input type="text" placeholder="https://..." className="border p-3 rounded-xl text-sm bg-slate-50" value={newMatch.away_logo} onChange={e => setNewMatch({...newMatch, away_logo: e.target.value})} />
                </div>

                <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 mb-1">Venue / Stadium</label>
                    <input type="text" placeholder="e.g. Anfield" className="border p-3 rounded-xl text-sm bg-slate-50" value={newMatch.venue} onChange={e => setNewMatch({...newMatch, venue: e.target.value})} />
                </div>

                <div className="flex gap-2">
                     <div className="flex flex-col w-1/2">
                        <label className="text-[10px] font-bold text-slate-400 mb-1">Stage</label>
                        <input type="text" placeholder="e.g. Final" className="border p-3 rounded-xl text-sm bg-slate-50" value={newMatch.stage} onChange={e => setNewMatch({...newMatch, stage: e.target.value})} />
                    </div>
                    <div className="flex flex-col w-1/2">
                        <label className="text-[10px] font-bold text-slate-400 mb-1">Group</label>
                        <input type="text" placeholder="e.g. Group A" className="border p-3 rounded-xl text-sm bg-slate-50" value={newMatch.match_group} onChange={e => setNewMatch({...newMatch, match_group: e.target.value})} />
                    </div>
                </div>

                <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1"><LinkIcon size={10}/> API ID (Optional Sync)</label>
                    <input type="text" placeholder="e.g. 4328" className="border p-3 rounded-xl text-sm bg-slate-50" value={newMatch.api_id} onChange={e => setNewMatch({...newMatch, api_id: e.target.value})} />
                </div>

            </div>
            <div className="flex justify-end mt-4 pt-4 border-t border-slate-100">
                <button onClick={handleCreate} disabled={loading} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:scale-105 transition">
                    {loading ? 'Creating...' : 'Create Complete Match'}
                </button>
            </div>
        </div>
      )}

      {/* MATCH LIST */}
      <div className="space-y-4">
        {matches.map((match) => (
            <div key={match.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col lg:flex-row ${match.is_featured ? 'border-blue-400 ring-1 ring-blue-100' : 'border-slate-200'}`}>
                
                {/* 1. LEFT: Match Info & Rich Data */}
                <div className="p-5 lg:w-1/3 border-b lg:border-b-0 lg:border-r border-slate-100 bg-slate-50/50">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold uppercase text-slate-400 bg-white px-2 py-1 rounded border border-slate-200">{match.league}</span>
                        <span className="text-[10px] font-mono text-slate-400">{new Date(match.match_date).toLocaleDateString()} {new Date(match.match_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    
                    <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                        {match.home_team} <span className="text-slate-400 font-normal">vs</span> {match.away_team}
                    </h3>

                    {/* Scoreboard Control */}
                    <div className="flex items-center gap-2 mb-4">
                        <input type="number" className="w-12 h-10 text-center font-black text-lg border rounded-lg" value={match.home_score ?? 0} onChange={(e) => handleUpdateChange(match.id, 'home_score', e.target.value)} />
                        <span className="font-black text-slate-300">-</span>
                        <input type="number" className="w-12 h-10 text-center font-black text-lg border rounded-lg" value={match.away_score ?? 0} onChange={(e) => handleUpdateChange(match.id, 'away_score', e.target.value)} />
                        
                        <div className="flex flex-col gap-1">
                             <select className={`h-10 border rounded-lg text-xs font-bold px-2 ${match.status === 'LIVE' ? 'text-red-600 bg-red-50 border-red-200' : 'bg-white'}`} value={match.status} onChange={(e) => handleUpdateChange(match.id, 'status', e.target.value)}>
                                <option value="SCHEDULED">SCHEDULED</option><option value="LIVE">LIVE</option><option value="HT">HALF TIME</option><option value="FT">FINISHED</option>
                             </select>
                             <input type="text" placeholder="Time (90')" className="h-6 w-full border rounded text-[10px] text-center" value={match.displayClock || ''} onChange={(e) => handleUpdateChange(match.id, 'displayClock', e.target.value)} />
                        </div>
                    </div>

                    {/* Editable Rich Data Fields */}
                    <div className="space-y-2 mb-4 border-t pt-3">
                         <div className="flex items-center gap-2">
                             <label className="text-[10px] font-bold text-slate-400 w-12">Venue</label>
                             <input type="text" className="flex-1 border rounded py-1 px-2 text-[10px]" placeholder="Stadium" value={match.venue || ''} onChange={(e) => handleUpdateChange(match.id, 'venue', e.target.value)} />
                         </div>
                         <div className="flex items-center gap-2">
                             <label className="text-[10px] font-bold text-slate-400 w-12">Stage</label>
                             <input type="text" className="flex-1 border rounded py-1 px-2 text-[10px]" placeholder="e.g. Final" value={match.stage || ''} onChange={(e) => handleUpdateChange(match.id, 'stage', e.target.value)} />
                             <label className="text-[10px] font-bold text-slate-400">Grp</label>
                             <input type="text" className="w-16 border rounded py-1 px-2 text-[10px]" placeholder="e.g. A" value={match.match_group || ''} onChange={(e) => handleUpdateChange(match.id, 'match_group', e.target.value)} />
                         </div>
                    </div>

                    <div className="flex gap-2">
                         <button onClick={() => saveMatch(match)} disabled={savingId === match.id} className={`flex-1 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition ${savingId === match.id ? 'bg-green-600 text-white' : 'bg-slate-900 text-white hover:bg-black'}`}>
                            <Save size={14} /> {savingId === match.id ? 'Saved' : 'Save'}
                         </button>
                         <button onClick={() => deleteMatch(match.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 border border-red-100"><Trash2 size={16} /></button>
                    </div>
                </div>

                {/* 2. MIDDLE: AUTOMATION & VISIBILITY */}
                <div className="p-5 lg:w-1/3 border-b lg:border-b-0 lg:border-r border-slate-100">
                    
                    <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 mb-4">
                        <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                                <Star size={14} className={match.is_featured ? "text-orange-500 fill-orange-500" : "text-slate-400"} />
                                Feature on Home?
                            </span>
                            <div className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={match.is_featured || false} onChange={(e) => handleUpdateChange(match.id, 'is_featured', e.target.checked)} />
                                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                            </div>
                        </label>
                    </div>

                    <div className="space-y-3">
                        <div className="relative">
                            <label className="text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1 justify-between">
                                <span>Fallback Widget Code</span>
                                {match.widget_id && <span className="text-[9px] bg-amber-100 text-amber-700 px-1 rounded">Active Override</span>}
                            </label>
                            <textarea 
                                placeholder="Paste <iframe> code to OVERRIDE ESPN visualizer..." 
                                className={`w-full h-20 border rounded-lg p-2 text-[10px] font-mono focus:bg-white resize-none ${match.widget_id ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}
                                value={match.widget_id || ''} 
                                onChange={(e) => handleUpdateChange(match.id, 'widget_id', e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 mb-1 block">Booking Code</label>
                                <input type="text" className="w-full border rounded-lg py-2 px-3 text-xs font-mono" value={match.booking_code || ''} onChange={(e) => handleUpdateChange(match.id, 'booking_code', e.target.value)} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 mb-1 block">Affiliate Link</label>
                                <input type="text" className="w-full border rounded-lg py-2 px-3 text-xs" value={match.affiliate_link || ''} onChange={(e) => handleUpdateChange(match.id, 'affiliate_link', e.target.value)} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. RIGHT: Live Media & Settlement */}
                <div className="p-5 lg:w-1/3 bg-slate-50/30 flex flex-col justify-between">
                    <div>
                         <h4 className="text-[10px] font-black uppercase text-slate-400 mb-3 flex items-center gap-1"><Eye size={12} className="text-red-500" /> Media Links</h4>
                         <div className="space-y-2 mb-3">
                            <input type="text" placeholder="🔴 Pre/Live Stream URL" className="w-full border border-red-100 rounded-lg py-2 px-3 text-[10px]" value={match.livestream_url || ''} onChange={(e) => handleUpdateChange(match.id, 'livestream_url', e.target.value)}/>
                            <input type="text" placeholder="📼 Post-Match Highlights URL" className="w-full border border-slate-200 rounded-lg py-2 px-3 text-[10px]" value={match.video_url || ''} onChange={(e) => handleUpdateChange(match.id, 'video_url', e.target.value)}/>
                            <input type="text" placeholder="🎙️ Audio Commentary URL" className="w-full border border-blue-100 rounded-lg py-2 px-3 text-[10px]" value={match.audio_url || ''} onChange={(e) => handleUpdateChange(match.id, 'audio_url', e.target.value)}/>
                         </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-200">
                         {match.points_distributed ? (
                            <div className="w-full py-3 rounded-xl bg-green-100 text-green-700 font-bold text-xs flex flex-col items-center justify-center gap-1 border border-green-200">
                                <span className="flex items-center gap-1"><CheckCircle size={14} /> SETTLED</span>
                                <span className="text-[9px] opacity-70">Payouts Complete</span>
                            </div>
                         ) : (
                             <button onClick={() => settlePoints(match)} className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center justify-center gap-2 hover:bg-black transition shadow-lg shadow-slate-200">
                                <Calculator size={16} /> DISTRIBUTE POINTS
                             </button>
                         )}
                         <p className="text-[9px] text-center text-slate-400 mt-2">Action is irreversible.</p>
                    </div>
                </div>

            </div>
        ))}
        {matches.length === 0 && !loading && (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
                <p className="text-slate-500 font-bold">No matches found matching your search.</p>
            </div>
        )}
      </div>

      {/* 🟢 PAGINATION CONTROLS */}
      {totalPages > 1 && (
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mt-8">
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