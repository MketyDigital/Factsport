import { createClient } from '@/app/lib/supabase/client';
import { fetchEspnDetails } from '@/app/lib/espn'; // 🔥 IMPORT THE ESPN FETCHER

// 🟢 CONFIG
const API_KEY = process.env.FOOTBALL_DATA_KEY!;
const BASE_URL = 'https://api.football-data.org/v4';

const LEAGUE_MAP: Record<string, string> = {
  'Premier League': 'PL', 'La Liga': 'PD', 'Bundesliga': 'BL1',
  'Serie A': 'SA', 'Ligue 1': 'FL1', 'Champions League': 'CL',
  'Euros': 'EC', 'World Cup': 'WC', 'Europa League': 'EL', 
};

// --- HELPER: Normalize Status ---
const normalizeStatus = (status: string) => {
  const map: Record<string, string> = {
    'IN_PLAY': 'LIVE', 'PAUSED': 'HT', 'HALFTIME': 'HT',
    'FINISHED': 'FT', 'AWARDED': 'FT', 'TIMED': 'SCHEDULED',
    'SCHEDULED': 'SCHEDULED', 'POSTPONED': 'POSTPONED'
  };
  return map[status] || status;
};

// --- HELPER: Transform API Data to DB Schema ---
const transformMatch = (m: any, leagueName: string) => ({
    api_id: m.id, 
    league: leagueName,
    home_team: m.homeTeam.shortName || m.homeTeam.name,
    away_team: m.awayTeam.shortName || m.awayTeam.name,
    home_score: m.score.fullTime.home ?? 0,
    away_score: m.score.fullTime.away ?? 0,
    match_date: m.utcDate,
    status: normalizeStatus(m.status),
    home_logo: m.homeTeam.crest,
    away_logo: m.awayTeam.crest,
    updated_at: new Date().toISOString(),
    match_events: [],
    
    venue: m.venue || null,
    referees: m.referees || [],
    stage: m.stage || null,
    match_group: m.group || null,
    h2h: m.h2h || null
});

// --- FUNCTION 1: SYNC SCHEDULE (Called by GitHub Action) ---
export async function getLeagueMatches(leagueId: string, leagueName: string, dateFrom: string, dateTo: string) {
  const code = LEAGUE_MAP[leagueName] || leagueId; 
  if (!code) return { matches: [], error: 'Invalid League Code' };

  const url = `${BASE_URL}/competitions/${code}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;
  
  try {
    const res = await fetch(url, { headers: { 'X-Auth-Token': API_KEY }, cache: 'no-store' });
    if (!res.ok) {
        const errorText = await res.text();
        return { matches: [], error: `Status ${res.status}: ${errorText}` };
    }

    const data = await res.json();
    return { 
        matches: (data.matches || []).map((m: any) => transformMatch(m, leagueName)),
        error: null 
    };
  } catch (e: any) {
    return { matches: [], error: e.message };
  }
}

// --- FUNCTION 2: FRONTEND DATA ADAPTER (Crucial for Display) ---
export interface UnifiedMatchData {
  status: string;
  displayClock: string;
  home: { name: string; logo: string; score: number | string; id: string };
  away: { name: string; logo: string; score: number | string; id: string };
  goals: any[];
  commentary: any[];
  stats: any;
  lineups: { home: any[]; away: any[]; formations?: { home: string, away: string } };
  hasExternalData: boolean;
  widget_id?: string;
  
  venue?: string;
  referees?: any[];
  stage?: string;
  group?: string;
  h2h?: any;
  predictor?: { home: number, away: number, draw: number }; 
}

export async function getExternalData(dbData: any): Promise<UnifiedMatchData> {
  // 🔥 FETCH LIVE ESPN DATA IF ESPN_ID EXISTS
  let espnLive = null;
  if (dbData.espn_id) {
      espnLive = await fetchEspnDetails(dbData.espn_id);
  }

  // 🟢 PRIORITIZE LIVE ESPN DATA OVER DATABASE DEFAULTS
  const lineups = espnLive?.lineups || dbData.lineups || { home: [], away: [], formations: { home: null, away: null } };
  const stats = espnLive?.stats || dbData.stats || { home: {}, away: {} };
  const events = espnLive?.events || dbData.match_events || [];
  
  const hasLineups = lineups.home?.length > 0 || lineups.away?.length > 0;
  const hasStats = Object.keys(stats.home || {}).length > 0;
  const hasEvents = events.length > 0;
  const hasH2h = !!dbData.h2h;
  
  // "External Data" means: Has Widget OR Has ANY Rich Data
  const hasRichData = !!dbData.widget_id || hasLineups || hasStats || hasEvents || hasH2h;

  return {
    status: dbData.status === 'SCHEDULED' ? 'PRE' : dbData.status,
    displayClock: dbData.displayClock || (dbData.status === 'LIVE' ? 'Live' : (dbData.status === 'HT' ? 'HT' : '')),
    home: { name: dbData.home_team, logo: dbData.home_logo, score: dbData.home_score ?? 0, id: 'home' },
    away: { name: dbData.away_team, logo: dbData.away_logo, score: dbData.away_score ?? 0, id: 'away' },
    
    goals: events, // Overwritten by ESPN live events if available
    commentary: [], 
    stats: stats,  // Overwritten by ESPN live stats if available
    lineups: lineups, // Overwritten by ESPN live lineups if available
    
    hasExternalData: hasRichData, 
    widget_id: dbData.widget_id,
    
    // 🟢 SAFE MERGE: Use ESPN if available, otherwise fallback to DB
    venue: espnLive?.venue || dbData.venue || null,
    referees: espnLive?.referees || dbData.referees || [],
    predictor: espnLive?.predictor || null,
    
    stage: dbData.stage || null,
    group: dbData.match_group || null,
    h2h: dbData.h2h || null
  };
}