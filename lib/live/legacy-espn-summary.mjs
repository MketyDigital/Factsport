/**
 * Original Factsport fast ESPN Worker summary transformation, extracted from
 * owner-uploaded workerfse (M70). D1/MOTM and Worker fetch/cache handlers
 * are deliberately excluded. Field mapping is retained for parity; only
 * missing-score handling and unstable event identifiers are corrected.
 */
function safeScore(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const score = Number(value);
  return Number.isInteger(score) && score >= 0 && score <= 99 ? score : null;
}

function stableEventId(espnId, commentary) {
  const upstreamId = commentary.id ?? commentary.play?.id;
  if (upstreamId !== null && upstreamId !== undefined && upstreamId !== '') {
    return 'espn-' + espnId + '-' + String(upstreamId);
  }
  // A stable, non-security hash of the original event content, not a random
  // UUID. Repeated polls of identical commentary retain the same event ID.
  const key = [
    espnId, commentary.time?.displayValue || '', commentary.text || '',
    commentary.play?.type?.text || '',
    (commentary.play?.participants || []).map(p => p.athlete?.id || p.athlete?.displayName || '').join('|'),
  ].join('|');
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  }
  return 'espn-' + espnId + '-' + (hash >>> 0).toString(16).padStart(8, '0');
}

export function normalizeLegacyEspnSummary(data, espnId) {
  if (!data || typeof data !== 'object') throw new Error('Invalid ESPN summary');
  if (!/^[a-zA-Z0-9_-]{1,32}$/.test(String(espnId || ''))) throw new Error('Invalid ESPN identity');
      const header = data.header?.competitions?.[0];
      if (!header) throw new Error("Match data unavailable");

      const homeComp = header.competitors?.find(c => c.homeAway === 'home');
      const awayComp = header.competitors?.find(c => c.homeAway === 'away');
      const currentStatus = header.status?.type?.state || 'pre';
      let currentClock = header.status?.type?.description === 'Halftime' ? 'HT' : (header.status?.displayClock || "0'");

      // Prevent clock rollback and fix late + stoppage time syncing
      if (data.commentary && data.commentary.length > 0 && currentClock !== 'HT' && currentStatus === 'in') {
          const latestTimeStr = data.commentary[0].time?.displayValue; 
          if (latestTimeStr && latestTimeStr.includes("'")) {
              const cleanClock = currentClock.replace(/:.*/, ''); 
              const clockNum = parseInt(cleanClock.replace(/\D/g, '')) || 0;
              const eventNum = parseInt(latestTimeStr.replace(/\D/g, '')) || 0;

              if (eventNum > clockNum) {
                  currentClock = latestTimeStr; 
              } else if (eventNum === clockNum && latestTimeStr.includes('+') && !currentClock.includes('+')) {
                  currentClock = latestTimeStr; 
              }
          }
      }

      let mappedStatus = 'SCHEDULED';
      if (currentStatus === 'in') mappedStatus = 'LIVE';
      if (currentStatus === 'post') mappedStatus = 'FT';
      if (currentClock === 'HT') mappedStatus = 'HT';

      const homePens = homeComp?.shootoutScore;
      const awayPens = awayComp?.shootoutScore;
      const aggSummary = header.series?.summary || data.header?.series?.summary || null;
      const homeHT = homeComp?.linescores?.[0]?.value;
      const awayHT = awayComp?.linescores?.[0]?.value;

      const payload = {
        status: mappedStatus,
        home_score: safeScore(homeComp?.score),
        away_score: safeScore(awayComp?.score),
        displayClock: currentClock,
        stats: { 
            home: {}, 
            away: {},
            home_penalties: homePens !== undefined ? parseInt(homePens) : null,
            away_penalties: awayPens !== undefined ? parseInt(awayPens) : null,
            home_ht: homeHT !== undefined ? parseInt(homeHT) : null,
            away_ht: awayHT !== undefined ? parseInt(awayHT) : null,
            aggregate: aggSummary 
        },
        lineups: { home: [], away: [], formations: {} },
        match_events: [],
        events: [], 
        venue: data.gameInfo?.venue?.fullName || null,
        referees: data.gameInfo?.officials?.map(o => o.displayName || o.fullName) || []
      };

      if (data.predictor) {
          payload.predictor = {
              home: data.predictor.homeTeam?.gameProjection || 0,
              away: data.predictor.awayTeam?.gameProjection || 0,
              draw: data.predictor.draw?.gameProjection || 0
          };
      }

      const homeId = String(homeComp?.team?.id || '');

      if (data.boxscore && data.boxscore.teams) {
          data.boxscore.teams.forEach(t => {
              const side = String(t.team?.id) === homeId ? 'home' : 'away';
              if (t.statistics) {
                  t.statistics.forEach(s => {
                     if(s.name === 'possessionPct') payload.stats[side].possession = s.displayValue;
                     if(s.name === 'foulsCommitted') payload.stats[side].fouls = s.displayValue;
                     if(s.name === 'wonCorners') payload.stats[side].corners = s.displayValue;
                     if(s.name === 'saves') payload.stats[side].saves = s.displayValue;
                     if(s.name === 'shotsSummary' || s.name === 'totalShots') payload.stats[side].shots = s.displayValue;
                     if(s.name === 'shotsOnTarget') payload.stats[side].shotsOnTarget = s.displayValue;
                     if(s.name === 'shotsOffTarget') payload.stats[side].shotsOffTarget = s.displayValue;
                  });
              }
          });
      }

      const rosterDict = [];
      let rosters = data.boxscore?.rosters || data.boxscore?.players || data.rosters;
      
      if (rosters) {
          rosters.forEach(r => {
             const side = String(r.team?.id) === homeId ? 'home' : 'away';
             const teamName = side === 'home' ? (homeComp?.team?.displayName || '') : (awayComp?.team?.displayName || '');
             if (r.formation) payload.lineups.formations[side] = r.formation; 

             let athletes = r.athletes || r.roster || r.statistics?.[0]?.athletes || [];
             payload.lineups[side] = athletes.map(p => {
                 if (p.athlete?.displayName) rosterDict.push({ name: p.athlete.displayName, side, teamName });
                 return { name: p.athlete?.displayName || '', number: p.jersey || '', position: p.position?.abbreviation || 'P', is_starter: p.starter || false };
             });
          });
      } else if (data.boxscore?.teams) {
          data.boxscore.teams.forEach(t => {
              const side = String(t.team?.id) === homeId ? 'home' : 'away';
              const teamName = side === 'home' ? (homeComp?.team?.displayName || '') : (awayComp?.team?.displayName || '');
              if (t.roster) {
                  payload.lineups[side] = t.roster.map(p => {
                      if (p.athlete?.displayName) rosterDict.push({ name: p.athlete.displayName, side, teamName });
                      return { name: p.athlete?.displayName || '', number: p.jersey || '', is_starter: p.starter || false };
                  });
              }
          });
      }
      rosterDict.sort((a, b) => b.name.length - a.name.length);

      if (data.commentary && data.commentary.length > 0) {
          let parsedEvents = data.commentary
              .filter(c => {
                  const t = (c.text || '').toLowerCase();
                  const metaType = c.play?.type?.text?.toLowerCase() || '';
                  return t.includes('goal') || t.includes('penalty') || t.includes('card') || t.includes('substitution') || t.includes('var ') || t.includes('overturned') || t.includes('attempt') || metaType.includes('goal') || metaType.includes('card');
              })
              .map(c => {
                  const text = c.text || '';
                  const lowerText = text.toLowerCase();
                  const time = c.time?.displayValue || "0'";
                  const metaType = c.play?.type?.text?.toLowerCase() || '';

                  let type = 'event'; let actionName = 'Event'; let player = ''; let matchedPlayerName = ''; let matchedTeamName = '';
                  let matchedSide = '';

                  if (lowerText.includes('var decision') || lowerText.includes('overturned') || lowerText.includes('disallowed') || lowerText.includes('no goal') || metaType.includes('var')) {
                      type = 'var_overturn'; actionName = 'VAR Decision';
                  } else if (lowerText.includes('penalty conceded')) {
                      type = 'penalty_awarded'; actionName = 'Penalty Conceded'; 
                  } else if (lowerText.includes('penalty awarded')) {
                      type = 'penalty_awarded'; actionName = 'Penalty Awarded';
                  } else if (lowerText.includes('penalty') && (lowerText.includes('check') || lowerText.includes('var'))) {
                      type = 'var_overturn'; actionName = 'VAR Penalty Check'; 
                  } else if ((lowerText.includes('penalty') && (lowerText.includes('saved') || lowerText.includes('missed'))) || metaType === 'penalty missed' || metaType === 'penalty saved') {
                      type = 'penalty_missed'; actionName = 'Penalty Missed';
                  } else if (lowerText.includes('attempt') || lowerText.includes('saved') || lowerText.includes('missed') || lowerText.includes('blocked') || lowerText.includes('post') || lowerText.includes('crossbar') || metaType.includes('shot') || metaType.includes('miss')) {
                      type = 'attempt'; actionName = lowerText.includes('saved') ? 'Shot Saved' : 'Shot Missed';
                  } else if (metaType === 'goal' || lowerText.includes('goal!') || lowerText.includes('own goal by') || (lowerText.includes('goal') && /\d+/.test(lowerText))) {
                      type = 'goal'; actionName = lowerText.includes('own goal') ? 'Own Goal' : 'Goal';
                  } else if (lowerText.includes('penalty') && lowerText.includes('scored')) {
                      type = 'goal'; actionName = 'Penalty Goal';
                  } else if (lowerText.includes('card') || metaType.includes('card')) {
                      type = lowerText.includes('red') ? 'red-card' : 'card'; actionName = lowerText.includes('red') ? 'Red Card' : 'Yellow Card';
                  } else if (lowerText.includes('substitution') || metaType.includes('substitution')) {
                      type = 'sub'; actionName = 'Substitution';
                  } else {
                      type = 'attempt'; actionName = 'Match Update';
                  }

                  if (c.play?.participants?.length > 0) {
                      matchedPlayerName = c.play.participants[0]?.athlete?.displayName || '';
                      const exactMatch = rosterDict.find(r => r.name === matchedPlayerName);
                      if (exactMatch) {
                          matchedTeamName = exactMatch.teamName;
                          matchedSide = exactMatch.side;
                      }

                      if (type === 'sub' && c.play.participants.length > 1) {
                          const p1 = c.play.participants[0]?.athlete?.displayName;
                          const p2 = c.play.participants[1]?.athlete?.displayName;
                          const teamMatch = rosterDict.find(r => r.name === p1);
                          if (p1 && p2) {
                              player = teamMatch ? `${p1} (In) / ${p2} (Out) (${teamMatch.teamName})` : `${p1} (In) / ${p2} (Out)`;
                              if (teamMatch) matchedSide = teamMatch.side;
                          }
                      }
                  }

                  if (!player) {
                      if (type === 'sub') {
                          const matched = rosterDict.filter(r => text.includes(r.name)).sort((a, b) => text.indexOf(a.name) - text.indexOf(b.name));
                          if (matched.length >= 2) {
                              player = `${matched[0].name} (In) / ${matched[1].name} (Out) (${matched[0].teamName})`;
                              matchedSide = matched[0].side;
                          }
                          else if (matched.length === 1) {
                              player = `${matched[0].name} (${matched[0].teamName})`;
                              matchedSide = matched[0].side;
                          }
                      } else {
                          if (!matchedPlayerName) {
                              const match = rosterDict.find(r => text.includes(r.name));
                              if (match) { matchedPlayerName = match.name; matchedTeamName = match.teamName; matchedSide = match.side; }
                          } else {
                              const match = rosterDict.find(r => r.name === matchedPlayerName);
                              if (match) { matchedTeamName = match.teamName; matchedSide = match.side; }
                          }
                          if (matchedPlayerName) player = matchedTeamName ? `${matchedPlayerName} (${matchedTeamName})` : matchedPlayerName;
                      }
                  }

                  if (type === 'goal' && lowerText.includes('assisted by')) {
                      const assistIndex = lowerText.indexOf('assisted by');
                      const assistText = text.substring(assistIndex);
                      const assistMatch = rosterDict.find(r => assistText.includes(r.name) && r.name !== matchedPlayerName);
                      if (assistMatch) player = `${player || 'Goal'} (Assist: ${assistMatch.name})`;
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
                      id: stableEventId(espnId, c), 
                      time: time, 
                      type: type, 
                      text: actionName, 
                      player: player, 
                      team: matchedSide 
                  };
              });
          
          parsedEvents.reverse();
          payload.match_events = parsedEvents;
          payload.events = parsedEvents;
      }
      
      return payload;
}
