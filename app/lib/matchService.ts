import { createClient } from '@/app/lib/supabase/client';

const API_KEY = process.env.FOOTBALL_DATA_KEY!;
const BASE_URL = 'https://api.football-data.org/v4';

// 🟢 CONFIG: Map your frontend league names to API codes
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

// --- HELPER 1: Normalize Status Codes ---
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

// --- HELPER 2: Standardize Match Data ---
// (Kept exactly as you had it to preserve DB structure)
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

// --- MAIN FUNCTION 1: SYNC ---
// 🟢 UPDATED: Accepts Date Range to fix API Rate Limiting
export async function getLeagueMatches(leagueId: string, leagueName: string, dateFrom: string, dateTo: string) {
  const code = LEAGUE_MAP[leagueName] || leagueId; // Fallback to ID if name not found
  if (!code) return [];

  try {
    // We use the dateFrom & dateTo parameters to fetch multiple days in 1 call
    const res = await fetch(`${BASE_URL}/competitions/${code}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`, {
      headers: { 'X-Auth-Token': API_KEY },
      cache: 'no-store'
    });
    
    if (!res.ok) {
        console.error(`API Error (${leagueName}): ${res.status}`);
        return [];
    }

    const data = await res.json();
    return (data.matches || []).map((m: any) => transformMatch(m, leagueName));

  } catch (e) {
    console.error(`Sync Error (${leagueName}):`, e);
    return [];
  }
}

// --- MAIN FUNCTION 2: FRONTEND ADAPTER ---
// 🔒 UNTOUCHED: This ensures your frontend never breaks
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
  return {
    status: dbData.status === 'SCHEDULED' ? 'PRE' : dbData.status,
    displayClock: dbData.status === 'LIVE' ? 'Live' : (dbData.status === 'HT' ? 'HT' : ''),
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
    goals: dbData.match_events || [], 
    commentary: [], 
    stats: { possession: { h:0, a:0 }, shots: { h:0, a:0 }, corners: { h:0, a:0 }, fouls: { h:0, a:0 } },
    lineups: { home: [], away: [] },
    hasExternalData: !!dbData.widget_id, 
    widget_id: dbData.widget_id 
  };
}