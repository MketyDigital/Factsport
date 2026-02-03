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
// Translates API specific words to your app's standard (LIVE, FT, HT)
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
// Converts raw API data into your Database format
const transformMatch = (m: any, leagueName: string) => ({
    api_id: m.id, // Football-Data ID
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
    // Note: Free tier doesn't give events/lineups here, we use Widget for that
    match_events: [] 
});

// --- MAIN FUNCTION 1: SYNC (Used by Cron) ---
export async function getLeagueMatches(leagueId: string, leagueName: string, dateStr: string) {
  const code = LEAGUE_MAP[leagueName];
  if (!code) return [];

  try {
    const res = await fetch(`${BASE_URL}/competitions/${code}/matches?dateFrom=${dateStr}&dateTo=${dateStr}`, {
      headers: { 'X-Auth-Token': API_KEY },
      cache: 'no-store'
    });
    
    if (!res.ok) return [];
    const data = await res.json();
    return (data.matches || []).map((m: any) => transformMatch(m, leagueName));

  } catch (e) {
    console.error(`Sync Error (${leagueName}):`, e);
    return [];
  }
}

// --- MAIN FUNCTION 2: FRONTEND ADAPTER ---
// This ensures your Match Details Page never breaks, regardless of where data comes from.
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
  // If we have a ScoreAxis Widget ID, we tell the frontend to use that.
  // Otherwise, we fallback to the basic data we synced.
  
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
    // We intentionally return empty arrays here because the ScoreAxis Widget 
    // handles Lineups/Stats visually. We don't need to fetch them as JSON.
    goals: dbData.match_events || [], 
    commentary: [], 
    stats: { possession: { h:0, a:0 }, shots: { h:0, a:0 }, corners: { h:0, a:0 }, fouls: { h:0, a:0 } },
    lineups: { home: [], away: [] },
    
    // logic: If widget_id exists, we have "Rich Data" (via the widget)
    hasExternalData: !!dbData.widget_id, 
    widget_id: dbData.widget_id 
  };
}