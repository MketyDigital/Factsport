// app/lib/espn.ts

export const ESPN_LEAGUES: Record<string, string> = {
  // Main Leagues
  'Premier League': 'eng.1',
  'La Liga': 'esp.1',
  'Bundesliga': 'ger.1',
  'Serie A': 'ita.1',
  'Ligue 1': 'fra.1',
  'Champions League': 'uefa.champions',
  'Euros': 'uefa.euro',
  'World Cup': 'fifa.world',
  
  // The New Major Cups
  'Europa League': 'uefa.europa',
  'Europa Conference League': 'uefa.conference',
  'FA Cup': 'eng.fa',
  'Carabao Cup': 'eng.league_cup',
  'Copa del Rey': 'esp.copa_del_rey',
  'Coppa Italia': 'ita.copa_italia',
  'Coupe de France': 'fra.coupe_de_france',
  'DFB-Pokal': 'ger.dfb_pokal'
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
        
        // 🟢 THIS IS THE KEY FIX FOR TIME MATCHING
        // ESPN returns UTC ISO string (e.g. "2024-05-12T14:00Z")
        // We convert it to a Timestamp Number immediately.
        startTime: new Date(e.date).getTime() 
    }));
  } catch (err) { return []; }
}

// 2. Fetch Deep Details (Uses Commentary)
export async function fetchEspnDetails(gameId: string) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${gameId}`;
  try {
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return null;
    const data = await res.json();

    const homeId = String(data.header.competitions[0].competitors.find((c:any)=>c.homeAway==='home').team.id);

    // 🟢 A. PARSE EVENTS FROM COMMENTARY
    let events: any[] = [];
    
    if (data.commentary) {
        events = data.commentary.filter((c: any) => {
            const text = (c.text || '').toLowerCase();
            return text.includes('goal') || 
                   text.includes('card') || 
                   text.includes('substitution') || 
                   text.includes('penalty') ||
                   text.includes('var');
        }).map((c: any) => {
            const text = c.text || '';
            const lowerText = text.toLowerCase();
            let type = 'event';

            if (lowerText.includes('goal')) type = 'goal';
            else if (lowerText.includes('red card')) type = 'red-card';
            else if (lowerText.includes('yellow card')) type = 'card';
            else if (lowerText.includes('substitution')) type = 'sub';
            
            return {
                id: Math.random().toString(36).substr(2, 9),
                time: c.time?.displayValue || "0'",
                type: type,
                text: text, 
                team: '', 
                player: '' 
            };
        });
        
        // 🟢 NEWEST FIRST
        events.reverse();
    }

    // Fallback if commentary is empty
    if (events.length === 0) {
        const rawEvents = data.header?.competitions?.[0]?.details || [];
        events = rawEvents.map((e: any) => ({
           id: Math.random().toString(36).substr(2, 9),
           time: e.clock?.displayValue || "0'",
           type: (e.type?.text || 'event').toLowerCase(),
           text: e.shortText || e.text || 'Match Event',
           team: e.team?.displayName || '',
           player: e.participants?.[0]?.athlete?.displayName || '' 
        }));
        // Reverse fallback too
        events.reverse();
    }

    // 🟢 B. PARSE STATS
    const boxscore = data.boxscore;
    const stats: any = { home: {}, away: {} };
    if (boxscore?.teams) {
       boxscore.teams.forEach((t: any) => {
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

    // 🟢 C. PARSE LINEUPS
    const lineups: any = { home: [], away: [] };
    let rosters = boxscore?.rosters;
    if (!rosters && boxscore?.players) rosters = boxscore.players;
    if (!rosters && data.rosters) rosters = data.rosters;

    if (rosters) {
       rosters.forEach((r: any) => {
          const side = String(r.team.id) === homeId ? 'home' : 'away';
          let athletes = r.athletes || r.roster || r.statistics?.[0]?.athletes || [];

          lineups[side] = athletes.map((p: any) => ({
             name: p.athlete.displayName,
             number: p.jersey,
             position: p.position?.abbreviation || 'P',
             is_starter: p.starter
          }));
       });
    } 
    else if (boxscore?.teams) {
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

    return { events, stats, lineups };

  } catch (err) { return null; }
}