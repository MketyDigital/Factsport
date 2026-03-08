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
        
        // Convert to Timestamp
        startTime: new Date(e.date).getTime() 
    }));
  } catch (err) { return []; }
}

// 2. Fetch Deep Details (Clean Facts Only - Zero Copyright)
export async function fetchEspnDetails(gameId: string) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${gameId}`;
  try {
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return null;
    const data = await res.json();

    const homeId = String(data.header.competitions[0].competitors.find((c:any)=>c.homeAway==='home').team.id);

    // 🟢 A. PARSE EVENTS (THE HYBRID GUARANTEE ALGORITHM)
    let events: any[] = [];
    const rawDetails = data.header?.competitions?.[0]?.details || [];

    // METHOD 1: The Structured Truth (Guarantees we never miss an event if ESPN provides Details)
    if (rawDetails.length > 0) {
        rawDetails.forEach((e: any) => {
            const rawText = String(e.shortText || e.text || e.type?.text || '').toLowerCase();
            let type = 'event';
            let actionName = '';
            
            if (e.scoringPlay || rawText.includes('goal') || rawText.includes('penalty')) { type = 'goal'; actionName = 'Goal'; }
            else if (e.redCard || rawText.includes('red card')) { type = 'red-card'; actionName = 'Red Card'; }
            else if (e.yellowCard || rawText.includes('yellow')) { type = 'card'; actionName = 'Yellow Card'; }
            else if (rawText.includes('sub') || rawText.includes('replaced')) { type = 'sub'; actionName = 'Substitution'; }
            else return; // Skip useless events

            let player = e.participants?.[0]?.athlete?.displayName || '';
            let team = e.team?.displayName || '';
            const time = e.clock?.displayValue || "0'";

            // Format Substitutions beautifully
            if (type === 'sub' && e.text && e.text.toLowerCase().includes('replaces')) {
                const parts = e.text.split(/ replaces /i);
                if (parts.length === 2) {
                    player = `${parts[0].trim()} (In) / ${parts[1].replace('.', '').trim()} (Out)`;
                }
            }

            // Hunt for Assists in the Commentary
            if (type === 'goal' && data.commentary) {
                const commMatch = data.commentary.find((c: any) => c.time?.displayValue === time && String(c.text).includes(player.split(' ')[0]));
                if (commMatch) {
                    const assistMatch = commMatch.text.match(/Assisted by ([a-zA-ZÀ-ÿ\-\'\s]{2,30})(?: with|\.|,)/i);
                    if (assistMatch) player = `${player} (Assist: ${assistMatch[1].trim()})`;
                }
            }

            // Professional Placeholder Fallback for Method 1
            if (!player) {
                if (type === 'goal') player = 'Goal (Details Pending)';
                else if (type === 'card') player = 'Booking Confirmed';
                else if (type === 'red-card') player = 'Red Card Issued';
                else if (type === 'sub') player = 'Substitution Made';
            }

            events.push({
                id: Math.random().toString(36).substr(2, 9),
                time: time,
                type: type,
                text: actionName,
                team: team,
                player: player
            });
        });
    } 
    
    // METHOD 2: The Commentary Shredder (With Professional Placeholders)
    if (events.length === 0 && data.commentary) {
        data.commentary.forEach((c: any) => {
            const text = c.text || '';
            const lowerText = text.toLowerCase();
            const time = c.time?.displayValue || "0'";

            if (lowerText.includes('attempt') && !lowerText.includes('goal')) return;
            if (!lowerText.includes('goal') && !lowerText.includes('card') && !lowerText.includes('substitution') && !lowerText.includes('penalty')) return;

            let type = 'event';
            let actionName = 'Event';
            let player = '';
            let team = '';

            try {
                if (lowerText.includes('goal') || lowerText.includes('penalty')) {
                    type = 'goal'; actionName = 'Goal';
                    if (lowerText.includes('own goal')) actionName = 'Own Goal';
                    
                    const sentences = text.split('.');
                    for (const sentence of sentences) {
                        const ptMatch = sentence.match(/([a-zA-ZÀ-ÿ\-\'\s]{2,40})\s*\((.*?)\)/);
                        if (ptMatch) { player = ptMatch[1].trim(); team = ptMatch[2].trim(); break; }
                    }
                    
                    const assistMatch = text.match(/Assisted by ([a-zA-ZÀ-ÿ\-\'\s]{2,30})(?: with|\.|,)/i);
                    if (assistMatch && player) player = `${player} (Assist: ${assistMatch[1].trim()})`;
                }
                else if (lowerText.includes('yellow card') || lowerText.includes('red card')) {
                    type = lowerText.includes('red card') ? 'red-card' : 'card';
                    actionName = type === 'red-card' ? 'Red Card' : 'Yellow Card';
                    const ptMatch = text.match(/([a-zA-ZÀ-ÿ\-\'\s]{2,40})\s*\((.*?)\)/);
                    if (ptMatch) { player = ptMatch[1].trim(); team = ptMatch[2].trim(); }
                }
                else if (lowerText.includes('substitution')) {
                    type = 'sub'; actionName = 'Substitution';
                    const subMatch = text.match(/Substitution,\s*(.*?)\.\s*(.*?)\s*replaces\s*(.*?)(?:[\.\,]|$)/i);
                    if (subMatch) { team = subMatch[1].trim(); player = `${subMatch[2].trim()} (In) / ${subMatch[3].trim()} (Out)`; }
                }
            } catch (err) {} 

            // 🛡️ THE PROFESSIONAL FALLBACK
            if (player && player.length < 55 && !player.toLowerCase().includes('unknown')) {
                events.push({ id: Math.random().toString(36).substr(2, 9), time: time, type: type, text: actionName, team: team, player: player });
            } else {
                // If the regex failed, we use the clean placeholder. NO messy text allowed.
                let fallbackPlayer = 'Event Details Pending';
                if (lowerText.includes('goal') || lowerText.includes('penalty')) { type = 'goal'; actionName = 'Goal'; fallbackPlayer = 'Goal (Details Pending)'; }
                else if (lowerText.includes('red card')) { type = 'red-card'; actionName = 'Red Card'; fallbackPlayer = 'Red Card Issued'; }
                else if (lowerText.includes('yellow card')) { type = 'card'; actionName = 'Yellow Card'; fallbackPlayer = 'Booking Confirmed'; }
                else if (lowerText.includes('substitution')) { type = 'sub'; actionName = 'Substitution'; fallbackPlayer = 'Substitution Made'; }

                events.push({
                    id: Math.random().toString(36).substr(2, 9),
                    time: time,
                    type: type,
                    text: actionName,
                    team: '', 
                    player: fallbackPlayer // Beautiful, professional UI fallback
                });
            }
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