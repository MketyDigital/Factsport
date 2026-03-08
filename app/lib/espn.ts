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
  
  // Major Cups
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
        startTime: new Date(e.date).getTime() 
    }));
  } catch (err) { return []; }
}

// 2. Fetch Deep Details (Clean Facts Only)
export async function fetchEspnDetails(gameId: string) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${gameId}`;
  try {
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return null;
    const data = await res.json();

    const homeId = String(data.header.competitions[0].competitors.find((c:any)=>c.homeAway==='home').team.id);

    // 🟢 A. PARSE EVENTS (THE CLEAN ROOM SHREDDER)
    let events: any[] = [];

    if (data.commentary && data.commentary.length > 0) {
        events = data.commentary
            .filter((c: any) => {
                const t = (c.text || '').toLowerCase();
                if (t.includes('attempt') && !t.includes('goal')) return false; 
                return t.includes('goal') || t.includes('penalty') || t.includes('card') || t.includes('substitution') || t.includes('var ') || t.includes('overturned');
            })
            .map((c: any) => {
                const text = c.text || '';
                const lowerText = text.toLowerCase();
                const time = c.time?.displayValue || "0'";

                let type = 'event';
                let actionName = 'Event';
                let player = '';

                try {
                    // ❌ 1. TRAP VAR / DISALLOWED FIRST (Ignores the scoreline entirely)
                    if (lowerText.includes('var decision') || lowerText.includes('overturned') || lowerText.includes('disallowed') || lowerText.includes('no goal')) {
                        type = 'var_overturn'; 
                        actionName = 'VAR Decision';
                        player = 'Goal Disallowed';
                    }
                    
                    // ⚠️ 2. PENALTY AWARDED
                    else if (lowerText.includes('penalty conceded') || lowerText.includes('penalty awarded')) {
                        type = 'penalty_awarded'; 
                        actionName = 'Penalty Awarded';
                        player = 'Referee Check';
                    }
                    
                    // ⚽ 3. GOALS
                    else if (lowerText.includes('goal') || (lowerText.includes('penalty') && lowerText.includes('scored'))) {
                        type = 'goal'; actionName = 'Goal';
                        
                        if (lowerText.includes('own goal')) {
                            actionName = 'Own Goal';
                            player = text.split(',')[0].replace(/Own Goal by /ig, '').trim();
                        } else {
                            // Splits by sentence to avoid the "Team A 1, Team B 0" text.
                            // Looks specifically for the sentence with the parentheses: "Martín Payero (Lecce)"
                            const parts = text.split(/[\.!]\s+/);
                            const playerPart = parts.find(p => p.includes('(') && p.includes(')'));
                            
                            if (playerPart) {
                                player = playerPart.split('(')[0].trim();
                            }
                            
                            if (lowerText.includes('assisted by')) {
                                const assistMatch = text.match(/Assisted by (.*?)(?: with|\.)/i);
                                if (assistMatch) player = `${player || 'Goal'} (Assist: ${assistMatch[1].trim()})`;
                            }
                        }
                    }
                    
                    // 🟨🟥 4. CARDS (Red & Yellow)
                    else if (lowerText.includes('card')) {
                        type = lowerText.includes('red') ? 'red-card' : 'card';
                        actionName = lowerText.includes('red') ? 'Red Card' : 'Yellow Card';
                        
                        const parts = text.split(/[\.!]\s+/);
                        const playerPart = parts.find(p => p.includes('(') && p.includes(')'));
                        if (playerPart) player = playerPart.split('(')[0].trim();
                    }
                    
                    // 🔄 5. SUBSTITUTIONS
                    else if (lowerText.includes('substitution')) {
                        type = 'sub'; actionName = 'Substitution';
                        const subMatch = text.match(/([^\.]+?)\s+replaces\s+([^\.]+?)(?:\s+because|\.|$)/i);
                        if (subMatch) {
                            player = `${subMatch[1].trim()} (In) / ${subMatch[2].trim()} (Out)`;
                        }
                    }
                } catch (err) {}

                // 🛡️ THE IRONCLAD FALLBACK (If Regex misses, default to beautiful clean text)
                if (!player || player.trim() === '' || player.length > 55 || player.toLowerCase().includes('unknown')) {
                    if (type === 'goal') player = 'Goal Confirmed';
                    else if (type === 'var_overturn') player = 'Goal Disallowed';
                    else if (type === 'penalty_awarded') player = 'Penalty Check';
                    else if (type === 'card' || type === 'red-card') player = 'Booking';
                    else if (type === 'sub') player = 'Tactical Change';
                    else player = 'Match Update';
                }

                return {
                    id: Math.random().toString(36).substr(2, 9),
                    time: time,
                    type: type,
                    text: actionName,
                    team: '', // 🟢 Safely left blank to avoid the "Two Team Name" bug!
                    player: player
                };
            });
    }
    
    events.reverse();

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