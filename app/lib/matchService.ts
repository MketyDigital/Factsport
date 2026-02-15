import { createClient } from '@/app/lib/supabase/client';

// 🟢 CONFIG: Football-Data.org API
const API_KEY = process.env.FOOTBALL_DATA_KEY!;
const BASE_URL = 'https://api.football-data.org/v4';

// Map your frontend league names to API codes
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
export async function getLeagueMatches(leagueId: string, leagueName: string, dateFrom: string, dateTo: string) {
  const code = LEAGUE_MAP[leagueName] || leagueId; 
  if (!code) return [];

  const url = `${BASE_URL}/competitions/${code}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;
  
  // 🔍 DEBUG: Print to server logs
  console.log(`[Sync Request] ${leagueName}: ${url}`);

  try {
    const res = await fetch(url, {
      headers: { 'X-Auth-Token': API_KEY },
      cache: 'no-store'
    });
    
    // 🔍 DEBUG: Log detailed API errors if any
    if (!res.ok) {
        const errorText = await res.text();
        // We throw an error so the Route can catch it and show it to you
        throw new Error(`API Failed (${leagueName}): Status ${res.status} - ${errorText}`);
    }

    const data = await res.json();
    const count = data.matches?.length || 0;
    
    console.log(`✅ API Success (${leagueName}): Found ${count} matches`);
    
    return (data.matches || []).map((m: any) => transformMatch(m, leagueName));

  } catch (e: any) {
    console.error(`🔥 Sync Exception (${leagueName}):`, e.message);
    throw e; // Re-throw to be caught by the route
  }
}

// --- MAIN FUNCTION 2: FRONTEND ADAPTER ---
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