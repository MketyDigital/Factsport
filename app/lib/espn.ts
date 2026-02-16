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

export async function fetchEspnDetails(gameId: string) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${gameId}`;
  try {
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return null;
    const data = await res.json();

    // 🟢 1. GET HOME ID SAFELY (String format)
    const homeComp = data.header.competitions[0].competitors.find((c:any)=>c.homeAway==='home');
    const homeId = String(homeComp.team.id);

    // 🟢 2. PARSE EVENTS (With Fallback)
    let events = (data.header?.competitions?.[0]?.details || []).map((e: any) => ({
       id: Math.random().toString(36).substr(2, 9),
       time: e.clock?.displayValue || "0'",
       type: e.type?.text?.toLowerCase() || 'event', 
       text: e.shortText || e.text || 'Match Event', 
       team: e.team?.displayName || '',
       player: e.participants?.[0]?.athlete?.displayName || '' 
    }));

    // If live but empty, show "Match Started"
    if (events.length === 0 && data.header.competitions[0].status.type.state === 'in') {
        events.push({ id: 'start', time: "0'", type: 'info', text: 'Match Started', team: '', player: '' });
    }

    // 🟢 3. PARSE STATS
    const boxscore = data.boxscore;
    const stats: any = { home: {}, away: {} };
    if (boxscore?.teams) {
       boxscore.teams.forEach((t: any) => {
          // Compare IDs as Strings!
          const side = String(t.team.id) === homeId ? 'home' : 'away';
          t.statistics.forEach((s: any) => {
             if(s.name === 'possessionPct') stats[side].possession = s.displayValue;
             if(s.name === 'shotsSummary') stats[side].shots = s.displayValue;
             if(s.name === 'foulsCommitted') stats[side].fouls = s.displayValue;
             if(s.name === 'wonCorners') stats[side].corners = s.displayValue;
             if(s.name === 'saves') stats[side].saves = s.displayValue;
          });
       });
    }

    // 🟢 4. PARSE LINEUPS (Robust ID Matching)
    const lineups: any = { home: [], away: [] };
    
    // Strategy: Look in 'rosters', then 'players', then 'teams'
    let rosterSource = boxscore?.rosters || boxscore?.players;
    
    if (rosterSource) {
       rosterSource.forEach((r: any) => {
          const side = String(r.team.id) === homeId ? 'home' : 'away';
          
          // Players might be in 'athletes', 'roster', or 'statistics'
          let athletes = r.athletes || r.roster || r.statistics?.[0]?.athletes || [];

          lineups[side] = athletes.map((p: any) => ({
             name: p.athlete.displayName,
             number: p.jersey,
             position: p.position?.abbreviation || 'P',
             is_starter: p.starter
          }));
       });
    } 
    // FALLBACK: Sometimes lineups are inside the 'teams' array directly
    else if (boxscore?.teams) {
        boxscore.teams.forEach((t: any) => {
            const side = String(t.team.id) === homeId ? 'home' : 'away';
            // Sometimes hidden in a 'roster' property inside the team object
            // (This is rare but happens in some leagues)
            if (t.roster) {
                lineups[side] = t.roster.map((p: any) => ({
                    name: p.athlete.displayName,
                    number: p.jersey,
                    is_starter: p.starter
                }));
            }
        });
    }

    return { events, stats, lineups };

  } catch (err) { return null; }
}