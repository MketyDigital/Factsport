// @ts-nocheck
import { createClient } from '@/app/lib/supabase/client';

export const ESPN_LEAGUES: Record<string, string> = {
  'Premier League': 'eng.1', 'La Liga': 'esp.1', 'Bundesliga': 'ger.1',
  'Serie A': 'ita.1', 'Ligue 1': 'fra.1', 'Champions League': 'uefa.champions',
  'Euros': 'uefa.euro', 'World Cup': 'fifa.world', 
  'Copa America': 'conmebol.america', 'AFCON': 'caf.nations', 
  
  'Europa League': 'uefa.europa', 'Europa Conference League': 'uefa.conference',
  'FA Cup': 'eng.fa', 'Carabao Cup': 'eng.league_cup', 'Copa del Rey': 'esp.copa_del_rey',
  'Coppa Italia': 'ita.copa_italia', 'Coupe de France': 'fra.coupe_de_france', 'DFB-Pokal': 'ger.dfb_pokal',

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

export async function fetchEspnLive(leagueCode: string) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueCode}/scoreboard?_=${Date.now()}`;
  try {
    const res = await fetch(url, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) return [];
    
    const data = await res.json();
    if (!data || !data.events) return [];

    return data.events.map((e: any) => {
        const comp = e.competitions?.[0];
        const homeComp = comp?.competitors?.find((c:any)=>c.homeAway==='home');
        const awayComp = comp?.competitors?.find((c:any)=>c.homeAway==='away');
        return {
            espn_id: String(e.id),
            status: e.status?.type?.state || 'pre', 
            clock: e.status?.type?.description === 'Halftime' ? 'HT' : (e.status?.displayClock || "0'"),
            home_team: homeComp?.team?.displayName || 'Home Team',
            away_team: awayComp?.team?.displayName || 'Away Team',
            home_score: parseInt(homeComp?.score || '0'),
            away_score: parseInt(awayComp?.score || '0'),
            startTime: e.date ? new Date(e.date).getTime() : 0 
        };
    });
  } catch (err) { return []; }
}

export async function fetchEspnDetails(gameId: string) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${gameId}&_=${Date.now()}`;
  try {
    const res = await fetch(url, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) return null;
    const data = await res.json();

    if (!data || !data.header) return null;

    const comps = data.header.competitions?.[0];
    const homeCompetitor = comps?.competitors?.find((c:any)=>c.homeAway==='home');
    const awayCompetitor = comps?.competitors?.find((c:any)=>c.homeAway==='away');
    const homeId = String(homeCompetitor?.team?.id || '');
    const homeTeamName = homeCompetitor?.team?.displayName || '';
    const awayTeamName = awayCompetitor?.team?.displayName || '';

    // EXTRACT LIVE STATUS BACKUPS IF SCOREBOARD MISSES MATCH
    const statusState = comps?.status?.type?.state || 'pre';
    const clock = comps?.status?.type?.description === 'Halftime' ? 'HT' : (comps?.status?.displayClock || "0'");
    const live_home_score = parseInt(homeCompetitor?.score || '0');
    const live_away_score = parseInt(awayCompetitor?.score || '0');

    let stageName = comps?.type?.abbreviation || comps?.type?.text || data.header.season?.type?.text || null;
    let groupName = null;
    
    if (comps?.notes && Array.isArray(comps.notes)) {
        const groupNote = comps.notes.find((n: any) => n.headline?.includes('Group'));
        if (groupNote) {
            groupName = groupNote.headline;
            stageName = 'Group Stage';
        }
    }

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

    const homePens = homeCompetitor?.shootoutScore;
    const awayPens = awayCompetitor?.shootoutScore;
    const aggSummary = comps?.series?.summary || data.header?.series?.summary || null;
    const homeHT = homeCompetitor?.linescores?.[0]?.value;
    const awayHT = awayCompetitor?.linescores?.[0]?.value;

    const boxscore = data.boxscore;
    
    const stats: any = { 
        home: {}, 
        away: {},
        home_penalties: homePens !== undefined ? parseInt(homePens) : null,
        away_penalties: awayPens !== undefined ? parseInt(awayPens) : null,
        home_ht: homeHT !== undefined ? parseInt(homeHT) : null,
        away_ht: awayHT !== undefined ? parseInt(awayHT) : null,
        aggregate: aggSummary
    };
    
    if (boxscore?.teams && Array.isArray(boxscore.teams)) {
       boxscore.teams.forEach((t: any) => {
          const side = String(t.team?.id) === homeId ? 'home' : 'away';
          if (t.statistics && Array.isArray(t.statistics)) {
              t.statistics.forEach((s: any) => {
                 if(s.name === 'possessionPct') stats[side].possession = s.displayValue;
                 if(s.name === 'foulsCommitted') stats[side].fouls = s.displayValue;
                 if(s.name === 'wonCorners') stats[side].corners = s.displayValue;
                 if(s.name === 'saves') stats[side].saves = s.displayValue;
                 if(s.name === 'shotsSummary' || s.name === 'totalShots') stats[side].shots = s.displayValue;
                 if(s.name === 'shotsOnTarget') stats[side].shotsOnTarget = s.displayValue;
                 if(s.name === 'shotsOffTarget') stats[side].shotsOffTarget = s.displayValue;
              });
          }
       });
    }

    const lineups: any = { home: [], away: [], formations: { home: null, away: null } };
    let rosters = boxscore?.rosters || boxscore?.players || data.rosters;

    if (rosters && Array.isArray(rosters)) {
       rosters.forEach((r: any) => {
          const side = String(r.team?.id) === homeId ? 'home' : 'away';
          if (r.formation) lineups.formations[side] = r.formation; 

          let athletes = r.athletes || r.roster || r.statistics?.[0]?.athletes || [];
          if (Array.isArray(athletes)) {
              lineups[side] = athletes.map((p: any) => ({
                 name: p.athlete?.displayName || p.athlete?.fullName || 'Unknown Player',
                 number: p.jersey || '',
                 position: p.position?.abbreviation || 'P',
                 is_starter: p.starter || false
              }));
          }
       });
    } else if (boxscore?.teams && Array.isArray(boxscore.teams)) {
        boxscore.teams.forEach((t: any) => {
            const side = String(t.team?.id) === homeId ? 'home' : 'away';
            if (t.roster && Array.isArray(t.roster)) {
                lineups[side] = t.roster.map((p: any) => ({
                    name: p.athlete?.displayName || p.athlete?.fullName || 'Unknown Player',
                    number: p.jersey || '',
                    is_starter: p.starter || false
                }));
            }
        });
    }

    const rosterDict: { name: string, side: string, teamName: string }[] = [];
    ['home', 'away'].forEach(side => {
        const teamName = side === 'home' ? homeTeamName : awayTeamName;
        if (Array.isArray(lineups[side])) {
            lineups[side].forEach((p: any) => {
                if (p.name) rosterDict.push({ name: p.name, side, teamName });
            });
        }
    });
    rosterDict.sort((a, b) => b.name.length - a.name.length);

    let events: any[] = [];
    if (data.commentary && Array.isArray(data.commentary) && data.commentary.length > 0) {
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

                let type = 'event'; let actionName = 'Event'; let player = ''; let matchedPlayerName = ''; let matchedTeamName = ''; let matchedSide = '';

                if (lowerText.includes('var decision') || lowerText.includes('overturned') || lowerText.includes('disallowed') || lowerText.includes('no goal') || metaType.includes('var')) {
                    type = 'var_overturn'; actionName = 'VAR Decision';
                } 
                else if (lowerText.includes('penalty conceded')) { type = 'penalty_awarded'; actionName = 'Penalty Conceded'; } 
                else if (lowerText.includes('penalty awarded')) { type = 'penalty_awarded'; actionName = 'Penalty Awarded'; } 
                else if (lowerText.includes('penalty') && (lowerText.includes('check') || lowerText.includes('var'))) { type = 'var_overturn'; actionName = 'VAR Penalty Check'; } 
                else if ((lowerText.includes('penalty') && (lowerText.includes('saved') || lowerText.includes('missed'))) || metaType === 'penalty missed' || metaType === 'penalty saved') { type = 'penalty_missed'; actionName = 'Penalty Missed'; } 
                else if (lowerText.includes('attempt') || lowerText.includes('saved') || lowerText.includes('missed') || lowerText.includes('blocked') || lowerText.includes('post') || lowerText.includes('crossbar') || metaType.includes('shot') || metaType.includes('miss')) { type = 'attempt'; actionName = lowerText.includes('saved') ? 'Shot Saved' : 'Shot Missed'; } 
                else if (metaType === 'goal' || lowerText.includes('goal!') || lowerText.includes('own goal by') || (lowerText.includes('goal') && /\d+/.test(lowerText))) { type = 'goal'; actionName = lowerText.includes('own goal') ? 'Own Goal' : 'Goal'; } 
                else if (lowerText.includes('penalty') && lowerText.includes('scored')) { type = 'goal'; actionName = 'Penalty Goal'; } 
                else if (lowerText.includes('card') || metaType.includes('card')) { type = lowerText.includes('red') ? 'red-card' : 'card'; actionName = lowerText.includes('red') ? 'Red Card' : 'Yellow Card'; } 
                else if (lowerText.includes('substitution') || metaType.includes('substitution')) { type = 'sub'; actionName = 'Substitution'; } 
                else { type = 'attempt'; actionName = 'Match Update'; }

                if (c.play?.participants?.length > 0) {
                    matchedPlayerName = c.play.participants[0]?.athlete?.displayName || '';
                    const teamMatch = rosterDict.find(r => r.name === matchedPlayerName);
                    if (teamMatch) { matchedTeamName = teamMatch.teamName; matchedSide = teamMatch.side; }
                    if (type === 'sub' && c.play.participants.length > 1) {
                        const p1 = c.play.participants[0]?.athlete?.displayName;
                        const p2 = c.play.participants[1]?.athlete?.displayName;
                        if (p1 && p2) player = teamMatch ? `${p1} (In) / ${p2} (Out) (${teamMatch.teamName})` : `${p1} (In) / ${p2} (Out)`;
                    }
                }

                if (!player) {
                    if (type === 'sub') {
                        const matched = rosterDict.filter(r => text.includes(r.name)).sort((a, b) => text.indexOf(a.name) - text.indexOf(b.name));
                        if (matched.length >= 2) { player = `${matched[0].name} (In) / ${matched[1].name} (Out) (${matched[0].teamName})`; matchedSide = matched[0].side; } 
                        else if (matched.length === 1) { player = `${matched[0].name} (${matched[0].teamName})`; matchedSide = matched[0].side; }
                    } else {
                        if (!matchedPlayerName) {
                            const match = rosterDict.find(r => text.includes(r.name));
                            if (match) { matchedPlayerName = match.name; matchedTeamName = match.teamName; matchedSide = match.side; }
                        }
                        if (matchedPlayerName) player = matchedTeamName ? `${matchedPlayerName} (${matchedTeamName})` : matchedPlayerName;
                    }
                }

                if (type === 'goal' && lowerText.includes('assisted by')) {
                    const assistIndex = lowerText.indexOf('assisted by');
                    const assistText = text.substring(assistIndex);
                    const assistMatch = rosterDict.find(r => assistText.includes(r.name) && r.name !== matchedPlayerName);
                    if (assistMatch) { player = `${player || 'Goal'} (Assist: ${assistMatch.name})`; } 
                    else {
                        const regMatch = text.match(/Assisted by (.*?)(?: with|\.)/i);
                        if (regMatch) player = `${player || 'Goal'} (Assist: ${regMatch[1].trim()})`;
                    }
                }

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
                    team: matchedSide, 
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
        predictor,
        stage: stageName,     
        match_group: groupName,
        live_status: statusState,
        clock,
        live_home_score,
        live_away_score
    };

  } catch (err) { 
      console.error("ESPN Fetch Details Error:", err);
      return null; 
  }
}