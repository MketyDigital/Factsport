// app/lib/espn.ts

export const ESPN_LEAGUES: Record<string, string> = {
  'Premier League': 'eng.1',
  'La Liga': 'esp.1',
  'Bundesliga': 'ger.1',
  'Serie A': 'ita.1',
  'Ligue 1': 'fra.1',
  'Champions League': 'uefa.champions',
  'Euros': 'uefa.euro',
  'World Cup': 'fifa.world',
  // Cups
  'FA Cup': 'eng.fa_cup',
  'Carabao Cup': 'eng.league_cup',
  'Copa del Rey': 'esp.copa_del_rey'
};

export const normalizeName = (name: string) => {
  return name.toLowerCase()
    .replace(/ fc| cf| united| city| real| inter| ac| milan| athletic| hotspur/g, '') 
    .replace(/[^a-z0-9]/g, '') 
    .trim();
};

// 1. Fetch Scoreboard (Fast, Basic Info)
export async function fetchEspnLive(leagueCode: string) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueCode}/scoreboard`;
  try {
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return [];
    
    const data = await res.json();
    return (data.events || []).map((e: any) => {
      const comp = e.competitions[0];
      const home = comp.competitors.find((c: any) => c.homeAway === 'home');
      const away = comp.competitors.find((c: any) => c.homeAway === 'away');
      
      return {
        espn_id: e.id,
        status: e.status.type.state, // 'pre', 'in', 'post'
        clock: e.status.type.description === 'Halftime' ? 'HT' : e.status.displayClock,
        home_team: home.team.displayName,
        away_team: away.team.displayName,
        home_score: parseInt(home.score),
        away_score: parseInt(away.score),
        startTime: new Date(e.date).getTime()
      };
    });
  } catch (err) {
    console.error(`ESPN Fetch Error (${leagueCode}):`, err);
    return [];
  }
}

// 2. Fetch Deep Details (Lineups, Stats, Events)
export async function fetchEspnDetails(gameId: string) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${gameId}`;
  try {
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return null;
    const data = await res.json();

    const homeId = data.header.competitions[0].competitors.find((c:any)=>c.homeAway==='home').team.id;

    // A. Parse Events (Goals, Cards, Subs)
    const rawEvents = data.header?.competitions?.[0]?.details || [];
    const events = rawEvents.map((e: any) => ({
       id: Math.random().toString(36).substr(2, 9),
       time: e.clock?.displayValue || "0'",
       type: e.type?.text?.toLowerCase() || 'event', // goal, yellow card, substitution
       // This text usually contains "Goal - Scorer (Assist)"
       text: e.shortText || e.text || 'Match Event', 
       team: e.team?.displayName || '',
       // Primary actor (Scorer or Carded player)
       player: e.participants?.[0]?.athlete?.displayName || '' 
    }));

    // B. Parse Stats (Possession, Shots)
    const boxscore = data.boxscore;
    const stats: any = { home: {}, away: {} };
    
    if (boxscore?.teams) {
       boxscore.teams.forEach((t: any) => {
          const side = t.team.id === homeId ? 'home' : 'away';
          t.statistics.forEach((s: any) => {
             // We map specific keys to ensure the frontend finds them
             if(s.name === 'possessionPct') stats[side].possession = s.displayValue;
             if(s.name === 'shotsSummary') stats[side].shots = s.displayValue;
             if(s.name === 'foulsCommitted') stats[side].fouls = s.displayValue;
             if(s.name === 'wonCorners') stats[side].corners = s.displayValue;
             if(s.name === 'saves') stats[side].saves = s.displayValue;
          });
       });
    }

    // C. Parse Lineups (Robust Method)
    const lineups: any = { home: [], away: [] };
    
    // ESPN structure varies. We check 'rosters' first, then 'players'
    let rosters = boxscore?.rosters;
    if (!rosters && boxscore?.players) {
        rosters = boxscore.players;
    }

    if (rosters) {
       rosters.forEach((r: any) => {
          const side = r.team.id === homeId ? 'home' : 'away';
          
          // Sometimes players are in 'athletes', sometimes inside 'statistics'
          const athletes = r.athletes || r.statistics?.[0]?.athletes || [];

          lineups[side] = athletes.map((p: any) => ({
             name: p.athlete.displayName,
             number: p.jersey,
             position: p.position?.abbreviation || 'P',
             is_starter: p.starter
          }));
       });
    }

    return { events, stats, lineups };

  } catch (err) { 
    console.error("ESPN Detail Fetch Error:", err);
    return null; 
  }
}