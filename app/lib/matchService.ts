import { createClient } from '@/app/lib/supabase/client';
import { fetchEspnDetails } from '@/app/lib/espn';

// 🟢 CONFIG
const API_KEY = process.env.FOOTBALL_DATA_KEY!;
const BASE_URL = 'https://api.football-data.org/v4';

const LEAGUE_MAP: Record<string, string> = {
  'Premier League': 'PL', 'La Liga': 'PD', 'Bundesliga': 'BL1',
  'Serie A': 'SA', 'Ligue 1': 'FL1', 'Champions League': 'CL',
  'Euros': 'EC', 'World Cup': 'WC', 'Europa League': 'EL', 
};

// 🟢 POLISH: Forces uppercase to guarantee frontend arrays always match
const normalizeStatus = (rawStatus: string) => {
  if (!rawStatus) return '';
  const status = rawStatus.toUpperCase();
  
  const map: Record<string, string> = {
    'IN_PLAY': 'LIVE', 'PAUSED': 'HT', 'HALFTIME': 'HT',
    'FINISHED': 'FT', 'AWARDED': 'FT', 'TIMED': 'SCHEDULED',
    'SCHEDULED': 'SCHEDULED', 'POSTPONED': 'POSTPONED',
    'POST': 'FT' // Translates ESPN's POST to FT just to be safe
  };
  return map[status] || status;
};

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
  
  venue?: string | null;
  referees?: any[];
  stage?: string | null;
  group?: string | null;
  h2h?: any;
  predictor?: { home: number, away: number, draw: number } | null; 

  // 🔥 RESTORED DB FLAT KEYS FOR HEADER UI
  id?: string;
  home_team?: string;
  away_team?: string;
  home_logo?: string;
  away_logo?: string;
  home_score?: number;
  away_score?: number;
  match_date?: string;
  league?: string;
}

export async function getExternalData(dbData: any): Promise<UnifiedMatchData> {
  let espnLive = null;
  if (dbData.espn_id) {
      espnLive = await fetchEspnDetails(dbData.espn_id);
  }

  const lineups = espnLive?.lineups || dbData.lineups || { home: [], away: [], formations: { home: null, away: null } };
  const stats = espnLive?.stats || dbData.stats || { home: {}, away: {} };
  const events = espnLive?.events || dbData.match_events || [];
  
  const hasLineups = lineups.home?.length > 0 || lineups.away?.length > 0;
  const hasStats = Object.keys(stats.home || {}).length > 0;
  const hasEvents = events.length > 0;
  const hasH2h = !!dbData.h2h;
  const hasRichData = !!dbData.widget_id || hasLineups || hasStats || hasEvents || hasH2h;

  let finalPredictor = null;
  const rawPredictor = espnLive?.predictor || dbData.predictor;
  if (rawPredictor) {
      finalPredictor = {
          home: Number(rawPredictor.home) || 0,
          away: Number(rawPredictor.away) || 0,
          draw: Number(rawPredictor.draw) || 0
      };
  }
  
  // 🟢 POLISH: Guarantee standard status output to the frontend
  const rawStatus = (dbData.status || '').toUpperCase();
  const safeStatus = rawStatus === 'SCHEDULED' ? 'PRE' : rawStatus;

  return {
    ...dbData, // 🔥 MAGIC FIX: Spreads all DB keys so the Header Logos and Time never break!
    
    status: safeStatus,
    displayClock: dbData.displayClock || (safeStatus === 'LIVE' ? 'Live' : (safeStatus === 'HT' ? 'HT' : '')),
    home: { name: dbData.home_team, logo: dbData.home_logo, score: dbData.home_score ?? 0, id: 'home' },
    away: { name: dbData.away_team, logo: dbData.away_logo, score: dbData.away_score ?? 0, id: 'away' },
    
    goals: events, 
    commentary: [], 
    stats: stats,  
    lineups: lineups, 
    
    hasExternalData: hasRichData, 
    widget_id: dbData.widget_id,
    
    venue: espnLive?.venue || dbData.venue || null,
    referees: espnLive?.referees || dbData.referees || [],
    predictor: finalPredictor, 
    
    stage: dbData.stage || null,
    group: dbData.match_group || null,
    h2h: dbData.h2h || null
  };
}