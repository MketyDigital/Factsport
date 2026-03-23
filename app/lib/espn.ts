import { createClient } from '@/app/lib/supabase/client';

export const ESPN_LEAGUES: Record<string, string> = {
  // Main Leagues
  'Premier League': 'eng.1', 'La Liga': 'esp.1', 'Bundesliga': 'ger.1',
  'Serie A': 'ita.1', 'Ligue 1': 'fra.1', 'Champions League': 'uefa.champions',
  'Euros': 'uefa.euro', 'World Cup': 'fifa.world',
  // Major Cups
  'Europa League': 'uefa.europa', 'Europa Conference League': 'uefa.conference',
  'FA Cup': 'eng.fa', 'Carabao Cup': 'eng.league_cup', 'Copa del Rey': 'esp.copa_del_rey',
  'Coppa Italia': 'ita.copa_italia', 'Coupe de France': 'fra.coupe_de_france', 'DFB-Pokal': 'ger.dfb_pokal',
  
  // 🌍 INTERNATIONAL BREAK ADDITIONS
  'International Friendlies': 'fifa.friendly',
  'UEFA Nations League': 'uefa.nations',
  'CONCACAF Nations League': 'concacaf.nations',
  'World Cup Qualifiers (CONMEBOL)': 'fifa.worldq.conmebol',
  'World Cup Qualifiers (UEFA)': 'fifa.worldq.uefa',
  'World Cup Qualifiers (AFC)': 'fifa.worldq.afc',
  'World Cup Qualifiers (CONCACAF)': 'fifa.worldq.concacaf',
  'AFCON Qualifiers': 'caf.nations_qual'
};

export const normalizeName = (name: string) => {
  return name.toLowerCase()
    .replace(/ fc| cf| united| city| real| inter| ac| milan| athletic| hotspur/g, '') 
    .replace(/[^a-z0-9]/g, '') 
    .trim();
};

// 1. Fetch Scoreboard (Fast)
export async function fetchEspnLive(leagueCode: string) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueCode}/scoreboard`;
  try {
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return [];
    
    const data = await res.json();
    return (data.events || []).map((e: any) => ({
        espn_id: e.id,
        status: e.status.type.state, 
        clock: e.status.type.description === 'Halftime' ? 'HT' : e.status.displayClock,
        home_team: e.competitions[0].competitors.find((c:any)=>c.homeAway==='home').team.displayName,
        away_team: e.competitions[0].competitors.find((c:any)=>c.homeAway==='away').team.displayName,
        home_score: parseInt(e.competitions[0].competitors.find((c:any)=>c.homeAway==='home').score),
        away_score: parseInt(e.competitions[0].competitors.find((c:any)=>c.homeAway==='away').score),
        startTime: new Date(e.date).getTime() 
    }));
  } catch (err) { return []; }
}

// 2. Fetch Deep Details (Clean Facts Only - Triple Layer Engine + Rich Data)
export async function fetchEspnDetails(gameId: string) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${gameId}`;
  try {
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return null;
    const data = await res.json();

    const homeCompetitor = data.header.competitions[0].competitors.find((c:any)=>c.homeAway==='home');
    const awayCompetitor = data.header.competitions[0].competitors.find((c:any)=>c.homeAway==='away');
    const homeId = String(homeCompetitor.team.id);
    const homeTeamName = homeCompetitor.team.displayName;
    const awayTeamName = awayCompetitor.team.displayName;

    // 🟢 1. EXTRACT VENUE & REFEREES & PREDICTOR
    const venue = data.gameInfo?.venue?.fullName || null;
    const referees = data.gameInfo?.officials?.map((o: any) => o.displayName || o.fullName) || [];
    
    let predictor = null;
    if (data.predictor) {
        predictor = {
            home: data.predictor.homeTeam?.gameProjection || 0,
            away: data.predictor.awayTeam?.gameProjection || 0,
            draw: data.predictor.draw?.gameProjection || 0
        };
    }

    // 🟢 2. PARSE STATS
    const boxscore = data.boxscore;
    const stats: any = { home: {}, away: {} };
    if (boxscore?.teams) {
       boxscore.teams.forEach((t: any) => {
          const side = String(t.team.id) === homeId ? 'home' : 'away';
          t.statistics.forEach((s: any) => {
             if(s.name === 'possessionPct') stats[side].possession = s.displayValue;
             if(s.name === 'foulsCommitted') stats[side].fouls = s.displayValue;
             if(s.name === 'wonCorners') stats[side].corners = s.displayValue;
             if(s.name === 'saves') stats[side].saves = s.displayValue;
             
             // The Shot Catcher
             if(s.name === 'shotsSummary' || s.name === 'totalShots') stats[side].shots = s.displayValue;
             if(s.name === 'shotsOnTarget') stats[side].shotsOnTarget = s.displayValue;
             if(s.name === 'shotsOffTarget') stats[side].shotsOffTarget = s.displayValue;
          });
       });
    }

    // 🟢 3. PARSE LINEUPS & FORMATIONS
    const lineups: any = { home: [], away: [], formations: { home: null, away: null } };
    let rosters = boxscore?.rosters;
    if (!rosters && boxscore?.players) rosters = boxscore.players;
    if (!rosters && data.rosters) rosters = data.rosters;

    if (rosters) {
       rosters.forEach((r: any) => {
          const side = String(r.team.id) === homeId ? 'home' : 'away';
          if (r.formation) lineups.formations[side] = r.formation; 

          let athletes = r.athletes || r.roster || r.statistics?.[0]?.athletes || [];
          lineups[side] = athletes.map((p: any) => ({
             name: p.athlete.displayName,
             number: p.jersey,
             position: p.position?.abbreviation || 'P',
             is_starter: p.starter
          }));
       });
    } else if (boxscore?.teams) {
        boxscore.teams.forEach((t: any) => {
            const side = String(t.team.id) === homeId ? 'home' : 'away';
            if (t.roster) {
                lineups[side] = t.roster.map((p: any) => ({
                    name: p.athlete.displayName,
                    number: p.jersey,
                    is_starter: p.starter
                }));
            }
        });
    }

    // 🔥 C. BUILD THE ROSTER DICTIONARY
    const rosterDict: { name: string, side: string, teamName: string }[] = [];
    ['home', 'away'].forEach(side => {
        const teamName = side === 'home' ? homeTeamName : awayTeamName;
        lineups[side].forEach((p: any) => {
            if (p.name) rosterDict.push({ name: p.name, side, teamName });
        });
    });
    rosterDict.sort((a, b) => b.name.length - a.name.length);

    // 🟢 D. PARSE EVENTS (THE TRIPLE-LAYER SHREDDER)
    let events: any[] = [];
    if (data.commentary && data.commentary.length > 0) {
        const rawEvents = data.commentary;
        events = rawEvents
            .filter((c: any) => {
                const t = (c.text || '').toLowerCase();
                const metaType = c.play?.type?.text?.toLowerCase() || '';
                return t.includes('goal') || t.includes('penalty') || t.includes('card') || t.includes('substitution') || t.includes('var ') || t.includes('overturned') || t.includes('attempt') || metaType.includes('goal') || metaType.includes('card');
            })
            .map((c: any) => {
                const text = c.text || '';
                const lowerText = text.toLowerCase();
                const time = c.time?.displayValue || "0'";
                const metaType = c.play?.type?.text?.toLowerCase() || '';

                let type = 'event';
                let actionName = 'Event';
                let player = '';
                let matchedPlayerName = '';
                let matchedTeamName = '';
                let matchedSide = ''; // 🟢 ADDED TO TRACK HOME VS AWAY GOALS

                // --- 1. THE TRIPLE-LOCK CLASSIFIER ---
                if (lowerText.includes('var decision') || lowerText.includes('overturned') || lowerText.includes('disallowed') || lowerText.includes('no goal') || metaType.includes('var')) {
                    type = 'var_overturn'; actionName = 'VAR Decision';
                } 
                else if (lowerText.includes('penalty conceded')) {
                    type = 'penalty_awarded'; actionName = 'Penalty Conceded'; 
                } else if (lowerText.includes('penalty awarded')) {
                    type = 'penalty_awarded'; actionName = 'Penalty Awarded';
                } else if (lowerText.includes('penalty') && (lowerText.includes('check') || lowerText.includes('var'))) {
                    type = 'var_overturn'; actionName = 'VAR Penalty Check'; 
                } else if ((lowerText.includes('penalty') && (lowerText.includes('saved') || lowerText.includes('missed'))) || metaType === 'penalty missed' || metaType === 'penalty saved') {
                    type = 'penalty_missed'; actionName = 'Penalty Missed';
                } 
                else if (lowerText.includes('attempt') || lowerText.includes('saved') || lowerText.includes('missed') || lowerText.includes('blocked') || lowerText.includes('post') || lowerText.includes('crossbar') || metaType.includes('shot') || metaType.includes('miss')) {
                    type = 'attempt'; actionName = lowerText.includes('saved') ? 'Shot Saved' : 'Shot Missed';
                } 
                else if (metaType === 'goal' || lowerText.includes('goal!') || lowerText.includes('own goal by') || (lowerText.includes('goal') && /\d+/.test(lowerText))) {
                    type = 'goal'; actionName = lowerText.includes('own goal') ? 'Own Goal' : 'Goal';
                } else if (lowerText.includes('penalty') && lowerText.includes('scored')) {
                    type = 'goal'; actionName = 'Penalty Goal';
                } 
                else if (lowerText.includes('card') || metaType.includes('card')) {
                    type = lowerText.includes('red') ? 'red-card' : 'card';
                    actionName = lowerText.includes('red') ? 'Red Card' : 'Yellow Card';
                } else if (lowerText.includes('substitution') || metaType.includes('substitution')) {
                    type = 'sub'; actionName = 'Substitution';
                } else {
                    type = 'attempt'; actionName = 'Match Update';
                }

                // --- LAYER 1: THE HIDDEN METADATA ---
                if (c.play?.participants?.length > 0) {
                    matchedPlayerName = c.play.participants[0]?.athlete?.displayName || '';
                    const teamMatch = rosterDict.find(r => r.name === matchedPlayerName);
                    if (teamMatch) {
                        matchedTeamName = teamMatch.teamName;
                        matchedSide = teamMatch.side; // 🟢 EXTRACT SIDE
                    }

                    if (type === 'sub' && c.play.participants.length > 1) {
                        const p1 = c.play.participants[0]?.athlete?.displayName;
                        const p2 = c.play.participants[1]?.athlete?.displayName;
                        if (p1 && p2) {
                            player = teamMatch ? `${p1} (In) / ${p2} (Out) (${teamMatch.teamName})` : `${p1} (In) / ${p2} (Out)`;
                        }
                    }
                }

                // --- LAYER 2: THE ROSTER DICTIONARY & TEAM NAME INJECTOR ---
                if (!player) {
                    if (type === 'sub') {
                        const matched = rosterDict
                            .filter(r => text.includes(r.name))
                            .sort((a, b) => text.indexOf(a.name) - text.indexOf(b.name));
                        
                        if (matched.length >= 2) {
                            player = `${matched[0].name} (In) / ${matched[1].name} (Out) (${matched[0].teamName})`;
                            matchedSide = matched[0].side; // 🟢 EXTRACT SIDE
                        } else if (matched.length === 1) {
                            player = `${matched[0].name} (${matched[0].teamName})`;
                            matchedSide = matched[0].side; // 🟢 EXTRACT SIDE
                        }
                    } else {
                        if (!matchedPlayerName) {
                            const match = rosterDict.find(r => text.includes(r.name));
                            if (match) {
                                matchedPlayerName = match.name;
                                matchedTeamName = match.teamName;
                                matchedSide = match.side; // 🟢 EXTRACT SIDE
                            }
                        }

                        if (matchedPlayerName) {
                            player = matchedTeamName ? `${matchedPlayerName} (${matchedTeamName})` : matchedPlayerName;
                        }
                    }
                }

                // --- ASSISTS FOR GOALS ---
                if (type === 'goal' && lowerText.includes('assisted by')) {
                    const assistIndex = lowerText.indexOf('assisted by');
                    const assistText = text.substring(assistIndex);
                    
                    const assistMatch = rosterDict.find(r => assistText.includes(r.name) && r.name !== matchedPlayerName);
                    
                    if (assistMatch) {
                        player = `${player || 'Goal'} (Assist: ${assistMatch.name})`;
                    } else {
                        const regMatch = text.match(/Assisted by (.*?)(?: with|\.)/i);
                        if (regMatch) player = `${player || 'Goal'} (Assist: ${regMatch[1].trim()})`;
                    }
                }

                // --- LAYER 3: THE CLEAN SHIELD (Final Fallback) ---
                if (!player || player.trim() === '' || player.length > 85 || player.toLowerCase().includes('unknown')) {
                    if (type === 'goal') player = 'Goal Confirmed';
                    else if (type === 'var_overturn') player = 'Goal Disallowed';
                    else if (type === 'penalty_awarded') player = 'Penalty Check';
                    else if (type === 'penalty_missed') player = 'Penalty Missed';
                    else if (type === 'attempt') player = 'Shot on Target';
                    else if (type === 'card' || type === 'red-card') player = 'Booking';
                    else if (type === 'sub') player = 'Tactical Change';
                    else player = 'Match Update';
                }

                return {
                    id: Math.random().toString(36).substr(2, 9),
                    time: time,
                    type: type,
                    text: actionName,
                    team: matchedSide, // 🟢 NOW PASSING 'home' OR 'away'
                    player: player
                };
            });
    }
    
    events.reverse();

    return { 
        events, 
        stats, 
        lineups, 
        venue,        
        referees,     
        predictor     
    };

  } catch (err) { return null; }
}

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