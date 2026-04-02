'use client';
export const runtime = 'edge';

import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { Search, Plus, Save, Trash2, Calculator, Calendar, Terminal, ChevronLeft, ChevronRight, TrendingUp, Settings, Video } from 'lucide-react';

const ITEMS_PER_PAGE = 10;

export default function AdminMatchesPage() {
  const supabase = createClient();
    
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // 🟢 NEW: State for active campaigns
  const [activeCampaigns, setActiveCampaigns] = useState<any[]>([]);

  useEffect(() => {
      const getCamps = async () => {
          const { data } = await supabase.from('campaigns').select('id, title').eq('is_active', true);
          if (data) setActiveCampaigns(data);
      };
      getCamps();
  }, []);

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

    let query = supabase.from('matches').select('*', { count: 'exact' });

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
            home_team: match.home_team, 
            away_team: match.away_team, 
            league: match.league, 
            match_date: new Date(match.match_date).toISOString(), 
            slug: match.slug,
            home_score: Number(match.home_score) || 0, 
            away_score: Number(match.away_score) || 0, 
            status: match.status, 
            displayClock: match.displayClock,
            home_logo: match.home_logo, 
            away_logo: match.away_logo, 
            venue: match.venue, 
            stage: match.stage, 
            match_group: match.match_group, 
            api_id: match.api_id ? String(match.api_id) : null, 
            espn_id: match.espn_id ? String(match.espn_id) : null, 
            widget_id: match.widget_id, 
            booking_code: match.booking_code, 
            affiliate_link: sanitize(match.affiliate_link), 
            livestream_url: sanitize(match.livestream_url), 
            video_url: sanitize(match.video_url), 
            audio_url: sanitize(match.audio_url), 
            is_featured: match.is_featured, 
            is_featured_video: match.is_featured_video, 
            is_bet_of_the_day: match.is_bet_of_the_day, // 🟢 Included in payload
            points_distributed: match.points_distributed,
            pro_analysis: match.pro_analysis, 
            campaign_id: match.campaign_id || null, // 🟢 Campaign Link
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
    if (!confirm("Distribute points to users who predicted this correctly?")) return;
    const { error } = await supabase.rpc('settle_match_points', { target_match_id: match.id });
    if (error) alert("Error: " + error.message);
    else {
        handleUpdateChange(match.id, 'points_distributed', true);
        await supabase.from('matches').update({ points_distributed: true, updated_at: new Date().toISOString() }).eq('id', match.id);
        alert("Points settled successfully!");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900 pb-24 overflow-x-hidden">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                <Terminal size={24} className="text-blue-600"/> Match Manager
            </h1>
            <p className="text-sm text-slate-500">Manage Schedule, Live Scores, and Pro Analysis.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-72">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                    type="text" 
                    placeholder="Search matches..." 
                    className="w-full border rounded-xl pl-10 pr-4 py-3 text-sm" 
                    value={search} 
                    onChange={(e) => setSearch(e.target.value)} 
                />
            </div>
        </div>
      </div>

      <div className="space-y-6">
        {matches.map((match) => (
            <div key={match.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col ${match.is_featured ? 'border-blue-400 ring-1 ring-blue-100' : 'border-slate-200'}`}>
                
                {/* TOP SECTION: League & Date */}
                <div className="flex flex-wrap justify-between items-center bg-slate-100/50 p-3 md:p-4 border-b border-slate-100 gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                        <input 
                            type="text" 
                            className="w-1/2 max-w-[150px] text-xs font-bold uppercase text-slate-600 bg-white px-2 py-1.5 border border-slate-200 rounded focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none" 
                            value={match.league || ''} 
                            onChange={(e) => handleUpdateChange(match.id, 'league', e.target.value)} 
                            placeholder="League" 
                        />
                        <input 
                            type="datetime-local" 
                            className="w-1/2 max-w-[200px] text-xs text-slate-600 bg-white px-2 py-1.5 border border-slate-200 rounded focus:border-blue-400 outline-none" 
                            value={match.match_date ? new Date(match.match_date).toISOString().slice(0, 16) : ''} 
                            onChange={(e) => handleUpdateChange(match.id, 'match_date', e.target.value)} 
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        {/* 🟢 MODIFIED: Added Bet of the Day Checkbox alongside Featured */}
                        <label className="flex items-center gap-1.5 text-[10px] md:text-xs font-bold bg-green-50 text-green-700 p-1.5 px-3 rounded-lg border border-green-100 cursor-pointer hover:bg-green-100 transition">
                            <input 
                                type="checkbox" 
                                checked={match.is_bet_of_the_day || false} 
                                onChange={(e) => handleUpdateChange(match.id, 'is_bet_of_the_day', e.target.checked)} 
                                className="w-3 h-3 md:w-4 md:h-4 rounded text-green-600"
                            /> 
                            Bet of the Day
                        </label>
                        <label className="flex items-center gap-1.5 text-[10px] md:text-xs font-bold bg-blue-50 text-blue-700 p-1.5 px-3 rounded-lg border border-blue-100 cursor-pointer hover:bg-blue-100 transition">
                            <input 
                                type="checkbox" 
                                checked={match.is_featured || false} 
                                onChange={(e) => handleUpdateChange(match.id, 'is_featured', e.target.checked)} 
                                className="w-3 h-3 md:w-4 md:h-4 rounded text-blue-600"
                            /> 
                            Featured
                        </label>
                    </div>
                </div>

                {/* MIDDLE SECTION: Teams & Scores */}
                <div className="p-4 md:p-6 flex flex-col md:flex-row items-center gap-4 border-b border-slate-100">
                    <div className="flex flex-col w-full md:w-2/5 gap-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Home Team</label>
                        <input 
                            type="text" 
                            className="w-full text-base md:text-lg font-black text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:bg-white focus:border-blue-400 outline-none" 
                            value={match.home_team || ''} 
                            onChange={(e) => handleUpdateChange(match.id, 'home_team', e.target.value)} 
                        />
                    </div>

                    <div className="flex flex-col items-center justify-center w-full md:w-1/5 gap-2">
                        <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-xl border border-slate-200">
                            <input 
                                type="number" 
                                className="w-12 h-10 md:w-14 md:h-12 text-center font-black text-lg md:text-xl border border-slate-300 rounded-lg focus:border-blue-500 outline-none" 
                                value={match.home_score ?? 0} 
                                onChange={(e) => handleUpdateChange(match.id, 'home_score', e.target.value)} 
                            />
                            <span className="text-slate-400 font-black text-lg">-</span>
                            <input 
                                type="number" 
                                className="w-12 h-10 md:w-14 md:h-12 text-center font-black text-lg md:text-xl border border-slate-300 rounded-lg focus:border-blue-500 outline-none" 
                                value={match.away_score ?? 0} 
                                onChange={(e) => handleUpdateChange(match.id, 'away_score', e.target.value)} 
                            />
                        </div>
                        <div className="flex items-center gap-2 w-full">
                            <select 
                                className="flex-1 h-8 border border-slate-200 bg-white rounded text-[10px] md:text-xs font-bold px-2 outline-none" 
                                value={match.status} 
                                onChange={(e) => handleUpdateChange(match.id, 'status', e.target.value)}
                            >
                                <option value="SCHEDULED">SCHEDULED</option>
                                <option value="LIVE">LIVE / IN_PLAY</option>
                                <option value="HT">HALF TIME</option>
                                <option value="FT">FINISHED (FT)</option>
                                <option value="AET">AET</option>
                                <option value="PEN">PENALTIES</option>
                                <option value="ABD">ABANDONED</option>
                                <option value="POST">POSTPONED</option>
                            </select>
                            <input 
                                type="text" 
                                placeholder="Clock(90')" 
                                className="w-16 h-8 border border-slate-200 bg-white rounded text-[10px] md:text-xs text-center font-bold outline-none" 
                                value={match.displayClock || ''} 
                                onChange={(e) => handleUpdateChange(match.id, 'displayClock', e.target.value)} 
                            />
                        </div>
                    </div>

                    <div className="flex flex-col w-full md:w-2/5 gap-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left md:text-right">Away Team</label>
                        <input 
                            type="text" 
                            className="w-full text-base md:text-lg font-black text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-left md:text-right focus:bg-white focus:border-blue-400 outline-none" 
                            value={match.away_team || ''} 
                            onChange={(e) => handleUpdateChange(match.id, 'away_team', e.target.value)} 
                        />
                    </div>
                </div>

                {/* ACCORDION 1: Match Settings & Media (RESTORED) */}
                <div className="p-3 md:p-4 border-b border-slate-100 bg-slate-50/50">
                     <details className="group">
                         <summary className="text-xs font-black uppercase text-slate-600 cursor-pointer flex items-center gap-2 hover:text-blue-600 transition outline-none p-2 bg-white border border-slate-200 rounded-lg shadow-sm">
                             <Settings size={14} className="text-blue-500" /> Match Settings, Logos & Media Links
                         </summary>
                         <div className="mt-3 p-4 border border-slate-200 rounded-xl bg-white shadow-inner">
                             
                             {/* 🟢 NEW CAMPAIGN DROPDOWN */}
                             <div className="mb-4 pb-4 border-b border-slate-100 bg-orange-50/30 p-3 rounded-lg border border-orange-100">
                                 <label className="text-[10px] font-bold text-orange-600 block mb-1">Target Campaign (Optional override)</label>
                                 <select 
                                     className="w-full border border-orange-200 bg-white rounded p-2 text-xs font-bold text-slate-700 outline-none focus:border-orange-400" 
                                     value={match.campaign_id || ''} 
                                     onChange={(e) => handleUpdateChange(match.id, 'campaign_id', e.target.value)}
                                 >
                                     <option value="">-- Auto-detect via League (Standard) --</option>
                                     {activeCampaigns.map(camp => (
                                         <option key={camp.id} value={camp.id}>{camp.title}</option>
                                     ))}
                                 </select>
                                 <p className="text-[9px] text-orange-400 mt-1 italic">Use this only if you want to manually force this match into a custom weekend giveaway.</p>
                             </div>

                             {/* Logos & IDs */}
                             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 pb-4 border-b border-slate-100">
                                 <div>
                                     <label className="text-[10px] font-bold text-slate-500 block mb-1">Home Logo URL</label>
                                     <input type="text" className="w-full border rounded p-2 text-xs" value={match.home_logo || ''} onChange={(e) => handleUpdateChange(match.id, 'home_logo', e.target.value)} />
                                 </div>
                                 <div>
                                     <label className="text-[10px] font-bold text-slate-500 block mb-1">Away Logo URL</label>
                                     <input type="text" className="w-full border rounded p-2 text-xs" value={match.away_logo || ''} onChange={(e) => handleUpdateChange(match.id, 'away_logo', e.target.value)} />
                                 </div>
                                 <div>
                                     <label className="text-[10px] font-bold text-slate-500 block mb-1">API ID (Live-score)</label>
                                     <input type="text" className="w-full border rounded p-2 text-xs" value={match.api_id || ''} onChange={(e) => handleUpdateChange(match.id, 'api_id', e.target.value)} />
                                 </div>
                                 <div>
                                     <label className="text-[10px] font-bold text-slate-500 block mb-1">ESPN ID (Match Center)</label>
                                     <input type="text" className="w-full border rounded p-2 text-xs" value={match.espn_id || ''} onChange={(e) => handleUpdateChange(match.id, 'espn_id', e.target.value)} />
                                 </div>
                             </div>

                             {/* Media Links */}
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                 <div>
                                     <label className="text-[10px] font-bold text-slate-500 block mb-1 flex items-center gap-1"><Video size={10} className="text-red-500"/> YouTube Stream URL</label>
                                     <input type="url" className="w-full border rounded p-2 text-xs focus:border-red-400" value={match.livestream_url || ''} onChange={(e) => handleUpdateChange(match.id, 'livestream_url', e.target.value)} />
                                 </div>
                                 <div>
                                     <label className="text-[10px] font-bold text-slate-500 block mb-1">Highlight Video URL</label>
                                     <input type="url" className="w-full border rounded p-2 text-xs" value={match.video_url || ''} onChange={(e) => handleUpdateChange(match.id, 'video_url', e.target.value)} />
                                 </div>
                                 <div>
                                     <label className="text-[10px] font-bold text-slate-500 block mb-1">Affiliate Bookmaker Link</label>
                                     <input type="url" className="w-full border rounded p-2 text-xs focus:border-green-400" value={match.affiliate_link || ''} onChange={(e) => handleUpdateChange(match.id, 'affiliate_link', e.target.value)} />
                                 </div>
                             </div>
                         </div>
                     </details>
                </div>
                
                {/* ACTION BAR */}
                <div className="bg-slate-100 p-3 md:p-4 flex flex-wrap justify-end gap-2 items-center">
                    {!match.points_distributed && FINISHED_STATUSES.includes((match.status || '').toUpperCase()) && (
                        <button onClick={() => settlePoints(match)} className="text-xs font-bold text-green-700 bg-green-100 border border-green-300 px-4 py-2 rounded-lg hover:bg-green-200 transition shadow-sm mr-auto">
                            Distribute Points
                        </button>
                    )}
                    {match.points_distributed && (
                        <span className="text-xs font-bold text-slate-400 bg-slate-200 px-3 py-1.5 rounded-lg border border-slate-300 mr-auto">
                            Points Settled
                        </span>
                    )}
                    <button onClick={() => deleteMatch(match.id)} className="text-xs font-bold text-red-600 bg-red-50 px-4 py-2 rounded-lg hover:bg-red-100 border border-red-200 transition shadow-sm">
                        <Trash2 size={14} className="inline mr-1" /> Delete
                    </button>
                    <button disabled={savingId === match.id} onClick={() => saveMatch(match)} className="text-xs font-bold text-white bg-blue-600 px-6 py-2 rounded-lg hover:bg-blue-700 transition shadow-md disabled:bg-slate-400 flex items-center gap-1">
                        <Save size={14} /> {savingId === match.id ? 'Saving...' : 'Save Match'}
                    </button>
                </div>
            </div>
        ))}
      </div>
      
      {/* PAGINATION */}
      <div className="flex justify-between items-center mt-8 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-2 border rounded hover:bg-slate-50 disabled:opacity-50">
            <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-bold text-slate-600">Page {currentPage} of {totalPages}</span>
        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-2 border rounded hover:bg-slate-50 disabled:opacity-50">
            <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}