'use client';
export const runtime = 'edge';

import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { Search, Plus, Save, Trash2, Calculator, Calendar, Terminal, ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';

const ITEMS_PER_PAGE = 10;

export default function AdminMatchesPage() {
  const supabase = createClient();
    
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const initialMatchState = {
    home_team: '', away_team: '', league: 'Premier League', match_date: '', slug: '',
    home_score: 0, away_score: 0, status: 'SCHEDULED', displayClock: '',
    home_logo: '', away_logo: '', venue: '', stage: '', match_group: '', 
    api_id: '', espn_id: '', widget_id: '', booking_code: '', affiliate_link: '', 
    livestream_url: '', video_url: '', audio_url: '', 
    is_featured: false, is_featured_video: false, points_distributed: false,
    pro_analysis: { odds: '', safe: '', primary: '', safeOdds: '', rationale: '' } 
  };

  const [newMatch, setNewMatch] = useState(initialMatchState);

  useEffect(() => { 
      setCurrentPage(1);
      const timer = setTimeout(() => fetchMatches(1), 500);
      return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { fetchMatches(currentPage); }, [currentPage]);

  const fetchMatches = async (page: number) => {
    setLoading(true);
    const from = (page - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    let query = supabase.from('matches').select('id, home_team, away_team, league, match_date, slug, home_score, away_score, status, displayClock, home_logo, away_logo, venue, stage, match_group, api_id, espn_id, widget_id, booking_code, affiliate_link, livestream_url, video_url, audio_url, is_featured, is_featured_video, points_distributed, pro_analysis', { count: 'exact' });

    if (search) {
        const cleanSearch = search.replace(/ vs | v | - /gi, ' ').trim();
        const terms = cleanSearch.split(' ').filter(Boolean);
        let orString = `home_team.ilike.%${search}%,away_team.ilike.%${search}%,league.ilike.%${search}%,venue.ilike.%${search}%,status.ilike.%${search}%`;
        if (terms.length > 1) orString += `,home_team.ilike.%${terms[0]}%,away_team.ilike.%${terms[1]}%`;
        query = query.or(orString);
    }

    query = query.order('match_date', { ascending: false }).range(from, to);
    
    const { data, count } = await query;
    if (data) setMatches(data);
    if (count !== null) setTotalPages(Math.ceil(count / ITEMS_PER_PAGE) || 1);
    
    setLoading(false);
  };

  const handleUpdateChange = (id: string, field: string, value: any) => {
    setMatches(matches.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const handleAnalysisChange = (id: string, field: string, value: string | number) => {
    setMatches(matches.map(m => {
        if (m.id === id) {
            const currentAnalysis = typeof m.pro_analysis === 'object' && m.pro_analysis !== null ? m.pro_analysis : {};
            return { ...m, pro_analysis: { ...currentAnalysis, [field]: value } };
        }
        return m;
    }));
  };

  const saveMatch = async (match: any) => {
    setSavingId(match.id);
    const sanitize = (url: string) => url?.trim().toLowerCase().startsWith('javascript:') ? '' : url;

    try {
        const payload = {
            home_team: match.home_team, away_team: match.away_team, league: match.league, 
            match_date: new Date(match.match_date).toISOString(), slug: match.slug,
            home_score: Number(match.home_score) || 0, away_score: Number(match.away_score) || 0, 
            status: match.status, displayClock: match.displayClock,
            home_logo: match.home_logo, away_logo: match.away_logo, venue: match.venue, 
            stage: match.stage, match_group: match.match_group, 
            api_id: match.api_id ? String(match.api_id) : null, espn_id: match.espn_id ? String(match.espn_id) : null, 
            widget_id: match.widget_id, booking_code: match.booking_code, affiliate_link: sanitize(match.affiliate_link), 
            livestream_url: sanitize(match.livestream_url), video_url: sanitize(match.video_url), audio_url: sanitize(match.audio_url), 
            is_featured: match.is_featured, is_featured_video: match.is_featured_video, points_distributed: match.points_distributed,
            pro_analysis: match.pro_analysis, 
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase.from('matches').update(payload).eq('id', match.id);
        if (error) throw error;
        
        handleUpdateChange(match.id, 'updated_at', payload.updated_at);
        setTimeout(() => setSavingId(null), 1000);

    } catch (err: any) {
        alert("Save failed: " + err.message);
        setSavingId(null);
    }
  };

  const deleteMatch = async (id: string) => {
    if (!confirm("Delete match?")) return;
    await supabase.from('matches').delete().eq('id', id);
    fetchMatches(currentPage);
  };

  const settlePoints = async (match: any) => {
    const { error } = await supabase.rpc('settle_match_points', { target_match_id: match.id });
    if (error) alert("Error: " + error.message);
    else {
        handleUpdateChange(match.id, 'points_distributed', true);
        await supabase.from('matches').update({ points_distributed: true, updated_at: new Date().toISOString() }).eq('id', match.id);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2"><Terminal size={24} className="text-blue-600"/> Match Manager</h1>
            <p className="text-sm text-slate-500">Manage Schedule, Live Scores, and Pro Analysis.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-72">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Search matches..." className="w-full border rounded-xl pl-10 pr-4 py-3 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
        </div>
      </div>

      <div className="space-y-4">
        {matches.map((match) => (
            <div key={match.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col ${match.is_featured ? 'border-blue-400 ring-1 ring-blue-100' : 'border-slate-200'}`}>
                
                <div className="flex flex-col lg:flex-row border-b border-slate-100 p-4 bg-slate-50/50">
                    <div className="flex-1">
                        <div className="flex justify-between items-start mb-2">
                            <input type="text" className="w-32 text-[10px] font-bold uppercase text-slate-500 bg-white px-2 py-1 border rounded" value={match.league || ''} onChange={(e) => handleUpdateChange(match.id, 'league', e.target.value)} />
                            <input type="datetime-local" className="text-[10px] text-slate-500 bg-white px-2 py-1 border rounded" value={match.match_date ? new Date(match.match_date).toISOString().slice(0, 16) : ''} onChange={(e) => handleUpdateChange(match.id, 'match_date', e.target.value)} />
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                            <input type="text" className="flex-1 text-sm font-black text-slate-800 border-b border-dashed border-slate-300 bg-transparent" value={match.home_team || ''} onChange={(e) => handleUpdateChange(match.id, 'home_team', e.target.value)} />
                            <input type="number" className="w-12 h-8 text-center font-black text-sm border rounded" value={match.home_score ?? 0} onChange={(e) => handleUpdateChange(match.id, 'home_score', e.target.value)} />
                            <span className="text-slate-400 font-normal text-xs">-</span>
                            <input type="number" className="w-12 h-8 text-center font-black text-sm border rounded" value={match.away_score ?? 0} onChange={(e) => handleUpdateChange(match.id, 'away_score', e.target.value)} />
                            <input type="text" className="flex-1 text-sm font-black text-slate-800 border-b border-dashed border-slate-300 bg-transparent text-right" value={match.away_team || ''} onChange={(e) => handleUpdateChange(match.id, 'away_team', e.target.value)} />
                        </div>
                        <div className="flex items-center gap-2">
                            <select className="h-8 border rounded text-[10px] font-bold px-2 flex-1" value={match.status} onChange={(e) => handleUpdateChange(match.id, 'status', e.target.value)}>
                                <option value="SCHEDULED">SCHEDULED</option><option value="LIVE">LIVE</option><option value="HT">HALF TIME</option><option value="FT">FINISHED</option>
                            </select>
                            <input type="text" placeholder="Clock(90')" className="w-16 h-8 border rounded text-[10px] text-center" value={match.displayClock || ''} onChange={(e) => handleUpdateChange(match.id, 'displayClock', e.target.value)} />
                            <label className="flex items-center gap-1 text-[10px] font-bold bg-blue-50 p-1 px-2 rounded border border-blue-100"><input type="checkbox" checked={match.is_featured || false} onChange={(e) => handleUpdateChange(match.id, 'is_featured', e.target.checked)}/> Featured</label>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-b border-slate-100 bg-emerald-50/30">
                     <details className="group">
                         <summary className="text-xs font-black uppercase text-emerald-700 cursor-pointer flex items-center gap-2 hover:text-emerald-800 transition">
                             <TrendingUp size={14} /> Edit Pro Analysis Data
                         </summary>
                         <div className="mt-4 p-4 border border-emerald-100 rounded-xl bg-white shadow-sm">
                             <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                                 <div>
                                     <label className="text-[10px] font-bold text-slate-500 block mb-1">Primary Bet</label>
                                     <input type="text" placeholder="e.g. Over 3.5 Goals" className="w-full border rounded p-2 text-xs" 
                                         value={match.pro_analysis?.primary || ''} 
                                         onChange={(e) => handleAnalysisChange(match.id, 'primary', e.target.value)} />
                                 </div>
                                 <div>
                                     <label className="text-[10px] font-bold text-slate-500 block mb-1">Primary Odds</label>
                                     <input type="text" placeholder="e.g. 2.1" className="w-full border rounded p-2 text-xs" 
                                         value={match.pro_analysis?.odds || ''} 
                                         onChange={(e) => handleAnalysisChange(match.id, 'odds', e.target.value)} />
                                 </div>
                                 <div>
                                     <label className="text-[10px] font-bold text-slate-500 block mb-1">Safe Bet</label>
                                     <input type="text" placeholder="e.g. Over 2.5 Goals" className="w-full border rounded p-2 text-xs" 
                                         value={match.pro_analysis?.safe || ''} 
                                         onChange={(e) => handleAnalysisChange(match.id, 'safe', e.target.value)} />
                                 </div>
                                 <div>
                                     <label className="text-[10px] font-bold text-slate-500 block mb-1">Safe Odds</label>
                                     <input type="text" placeholder="e.g. 1.35" className="w-full border rounded p-2 text-xs" 
                                         value={match.pro_analysis?.safeOdds || ''} 
                                         onChange={(e) => handleAnalysisChange(match.id, 'safeOdds', e.target.value)} />
                                 </div>
                             </div>
                             <div>
                                 <label className="text-[10px] font-bold text-slate-500 block mb-1">Rationale / Analysis</label>
                                 <textarea placeholder="Historical H2H indicates..." className="w-full border rounded p-2 text-xs h-20 resize-y" 
                                     value={match.pro_analysis?.rationale || ''} 
                                     onChange={(e) => handleAnalysisChange(match.id, 'rationale', e.target.value)} />
                             </div>
                         </div>
                     </details>
                </div>

                <div className="p-4 bg-white flex items-center justify-between">
                     <button onClick={() => deleteMatch(match.id)} className="p-2 text-red-400 hover:text-red-600 rounded transition flex items-center gap-1 text-[10px] font-bold"><Trash2 size={12} /> Delete</button>
                     
                     <div className="flex gap-2">
                         <button onClick={() => saveMatch(match)} disabled={savingId === match.id} className={`px-6 py-2 rounded font-bold text-xs flex items-center gap-2 transition shadow-sm ${savingId === match.id ? 'bg-green-600 text-white' : 'bg-slate-900 text-white hover:bg-black'}`}>
                            <Save size={14} /> {savingId === match.id ? 'Saved' : 'Save Changes'}
                         </button>
                     </div>
                </div>

            </div>
        ))}
      </div>
      
      {totalPages > 1 && (
          <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border mt-8">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 bg-slate-100 rounded text-xs font-bold">Prev</button>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Page {currentPage} of {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-4 py-2 bg-slate-100 rounded text-xs font-bold">Next</button>
          </div>
      )}
    </div>
  );
}