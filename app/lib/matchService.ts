import { createClient } from '@/app/lib/supabase/client';

// 🟢 CONFIG
const API_KEY = process.env.FOOTBALL_DATA_KEY!;
const BASE_URL = 'https://api.football-data.org/v4';

const LEAGUE_MAP: Record<string, string> = {
  'Premier League': 'PL',
  'La Liga': 'PD',
  'Bundesliga': 'BL1',
  'Serie A': 'SA',
  'Ligue 1': 'FL1',
  'Champions League': 'CL',
  'Euros': 'EC',
  'World Cup': 'WC',
};

// --- HELPER: Normalize Status ---
const normalizeStatus = (status: string) => {
  const map: Record<string, string> = {
    'IN_PLAY': 'LIVE',
    'PAUSED': 'HT',
    'HALFTIME': 'HT',
    'FINISHED': 'FT',
    'AWARDED': 'FT',
    'TIMED': 'SCHEDULED',
    'SCHEDULED': 'SCHEDULED',
    'POSTPONED': 'POSTPONED'
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
    match_events: [] 
});

// --- FUNCTION 1: SYNC SCHEDULE (Called by GitHub Action) ---
export async function getLeagueMatches(leagueId: string, leagueName: string, dateFrom: string, dateTo: string) {
  const code = LEAGUE_MAP[leagueName] || leagueId; 
  if (!code) return { matches: [], error: 'Invalid League Code' };

  const url = `${BASE_URL}/competitions/${code}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;
  
  try {
    const res = await fetch(url, {
      headers: { 'X-Auth-Token': API_KEY },
      cache: 'no-store'
    });
    
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
  lineups: { home: any[]; away: any[]; };
  hasExternalData: boolean;
  widget_id?: string;
}

export async function getExternalData(dbData: any): Promise<UnifiedMatchData> {
  // 🟢 LOGIC: Check if Rich Data exists in the DB columns
  // We check if lineups array is not empty OR if stats object has keys
  const hasLineups = dbData.lineups && (dbData.lineups.home?.length > 0 || dbData.lineups.away?.length > 0);
  const hasStats = dbData.stats && (Object.keys(dbData.stats.home || {}).length > 0);
  const hasEvents = dbData.match_events && dbData.match_events.length > 0;
  
  // "External Data" now means: Has Widget OR Has ANY ESPN Data (Lineups, Stats, or Events)
  const hasRichData = !!dbData.widget_id || hasLineups || hasStats || hasEvents;

  return {
    status: dbData.status === 'SCHEDULED' ? 'PRE' : dbData.status,
    displayClock: dbData.displayClock || (dbData.status === 'LIVE' ? 'Live' : (dbData.status === 'HT' ? 'HT' : '')),
    home: { 
      name: dbData.home_team, 
      logo: dbData.home_logo, 
      score: dbData.home_score ?? 0, 
      id: 'home' 
    },
    away: { 
      name: dbData.away_team, 
      logo: dbData.away_logo, 
      score: dbData.away_score ?? 0, 
      id: 'away' 
    },
    // 🟢 PASS DB EVENTS DIRECTLY TO 'GOALS' PROP
    goals: dbData.match_events || [], 
    commentary: [], // ESPN events can be mapped here later if needed
    stats: dbData.stats || { home: {}, away: {} },
    lineups: dbData.lineups || { home: [], away: [] },
    hasExternalData: hasRichData, 
    widget_id: dbData.widget_id 
  };
}