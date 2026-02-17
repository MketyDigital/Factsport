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

// 🟢 NEW: Hardcoded Dictionary for specific ESPN Event IDs
const KNOWN_EVENT_IDS: Record<string, { type: string, text: string }> = {
    // GOALS
    '66': { type: 'goal', text: 'Goal' },
    '67': { type: 'goal', text: 'Goal' },
    '68': { type: 'goal', text: 'Goal' },
    '69': { type: 'goal', text: 'Goal' },
    '70': { type: 'goal', text: 'Goal' },
    '81': { type: 'goal', text: 'Goal' },
    // CARDS
    '8':  { type: 'card', text: 'Yellow Card' },
    '11': { type: 'card', text: 'Red Card' },
    '17': { type: 'card', text: 'Red Card' },
    '18': { type: 'card', text: 'Yellow Card' },
    '33': { type: 'card', text: 'Red Card' },
    // SUBS
    '23': { type: 'sub',  text: 'Substitution' }
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

// 2. Fetch Deep Details (Lineups, Stats, Events)
export async function fetchEspnDetails(gameId: string) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${gameId}`;
  try {
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return null;
    const data = await res.json();

    const homeId = String(data.header.competitions[0].competitors.find((c:any)=>c.homeAway==='home').team.id);

    // 🟢 A. PARSE EVENTS (DEEP ID CHECK)
    const rawEvents = data.header?.competitions?.[0]?.details || [];
    const events = rawEvents.map((e: any) => {
        
        let cleanType = 'event';
        let finalText = e.shortText || e.text || 'Match Event';
        
        // 1. CHECK ID FIRST (Most Reliable)
        const typeId = String(e.type?.id);
        if (KNOWN_EVENT_IDS[typeId]) {
            cleanType = KNOWN_EVENT_IDS[typeId].type;
            // Only overwrite text if the API text is generic
            if (finalText === 'Event' || finalText === 'Match Event') {
                finalText = KNOWN_EVENT_IDS[typeId].text;
            }
        } 
        // 2. FALLBACK: String Matching
        else {
            const rawType = (e.type?.text || 'event').toLowerCase();
            const rawDesc = finalText.toLowerCase();

            if (rawType.includes('goal') || rawDesc.includes('goal')) cleanType = 'goal';
            else if (rawType.includes('card') || rawDesc.includes('card') || rawDesc.includes('yellow') || rawDesc.includes('red')) cleanType = 'card';
            else if (rawType.includes('substitution') || rawDesc.includes('sub')) cleanType = 'sub';
            
            // Fix generic text if we identified the type
            if ((finalText === 'Event' || finalText === 'Match Event')) {
                if (cleanType === 'goal') finalText = 'Goal';
                if (cleanType === 'card') finalText = 'Card';
                if (cleanType === 'sub') finalText = 'Substitution';
            }
        }

        return {
            id: Math.random().toString(36).substr(2, 9),
            time: e.clock?.displayValue || "0'",
            type: cleanType,
            text: finalText, 
            team: e.team?.displayName || '',
            player: e.participants?.[0]?.athlete?.displayName || '' 
        };
    });

    // 🟢 B. PARSE STATS (Untouched)
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

    // 🟢 C. PARSE LINEUPS (Untouched)
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