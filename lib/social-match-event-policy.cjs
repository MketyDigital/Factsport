'use strict';

const TERMINAL = new Set(['FT', 'FINISHED', 'ABD', 'AET', 'AWARDED', 'PEN']);
const LIVE = new Set(['IN_PLAY', 'LIVE', '1H', 'FIRST_HALF', 'FIRST HALF', '2H', 'SECOND_HALF', 'SECOND HALF']);
const HALF_TIME = new Set(['HT', 'HALFTIME', 'HALF TIME', 'HALF-TIME', 'PAUSED']);
const PRE_MATCH = new Set(['PRE_MATCH', 'SCHEDULED', 'PRE', 'NS', 'UPCOMING', 'TBD']);

function statusOf(value) { return String(value || '').trim().toUpperCase(); }
function isTerminal(value) { return TERMINAL.has(statusOf(value)); }
function isLive(value) { return LIVE.has(statusOf(value)); }
function isHalfTime(value) { return HALF_TIME.has(statusOf(value)); }
function isPreMatch(value) { return PRE_MATCH.has(statusOf(value)); }
function scoreOf(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    return Number.isSafeInteger(n) && n >= 0 ? n : null;
  }
  return null;
}
function scoresOf(match) {
  const home = scoreOf(match?.home_score);
  const away = scoreOf(match?.away_score);
  return home === null || away === null ? null : { home, away, total: home + away };
}
function goalsOf(events) {
  if (!Array.isArray(events)) return [];
  return events.filter(event => {
    if (!event || typeof event !== 'object') return false;
    const text = String(event.text || '').toLowerCase();
    const type = String(event.type || '').toLowerCase();
    if (text.includes('disallowed') || text.includes('cancelled') || text.includes('no goal') ||
        type === 'var_overturn' || type === 'penalty_awarded') return false;
    return type === 'goal' || text === 'goal';
  });
}
function penaltiesOf(events) {
  return Array.isArray(events) ? events.filter(event =>
    event && typeof event === 'object' && String(event.type || '').toLowerCase() === 'penalty_awarded'
  ) : [];
}
function parseMinute(value) {
  const parts = String(value || '').replace(/[^0-9+]/g, '').split('+');
  return (Number.parseInt(parts[0] || '0', 10) || 0) * 100 +
    (Number.parseInt(parts[1] || '0', 10) || 0);
}
function parseElapsedMinute(value) {
  const parts = String(value || '').replace(/[^0-9+]/g, '').split('+');
  return (Number.parseInt(parts[0] || '0', 10) || 0) +
    (Number.parseInt(parts[1] || '0', 10) || 0);
}
function eventKey(event) {
  if (!event) return '';
  return String(event.id || event.uid || event.eventId ||
    [event.time || event.minute || '', event.player || event.playerName || event.name || '', event.text || ''].join('|'));
}
function latestChangedGoal(oldGoals, newGoals) {
  const oldKeys = new Set(oldGoals.map(eventKey));
  const sorted = [...newGoals].sort((a, b) =>
    parseMinute(b.time || b.minute) - parseMinute(a.time || a.minute)
  );
  return sorted.find(goal => !oldKeys.has(eventKey(goal))) || sorted[0] || null;
}
function eventIsFresh(event, matchDate, nowMs, freshnessMs = 20 * 60 * 1000) {
  if (!event || !matchDate) return true;
  const kickoff = Date.parse(matchDate);
  if (!Number.isFinite(kickoff)) return true;
  let elapsed = parseElapsedMinute(event.time || event.minute);
  if (elapsed > 45) elapsed += 15;
  const eventMs = kickoff + elapsed * 60_000;
  const age = nowMs - eventMs;
  const maxAge = Math.max(freshnessMs, 20 * 60 * 1000);
  return age <= maxAge && age >= -maxAge;
}
function validNames(players) {
  return (Array.isArray(players) ? players : [])
    .map(player => player?.name || player?.player?.name || player?.playerName ||
      (typeof player === 'string' ? player : null))
    .filter(Boolean);
}
function fingerprint(event, fallback) {
  if (!event) return fallback;
  const stableId = event.id || event.uid || event.eventId;
  if (stableId) return String(stableId).slice(0, 180);
  return [event.time || event.minute || '', event.player || event.playerName || event.name || '', event.text || '']
    .join('|').slice(0, 180) || fallback;
}

/**
 * Pure Media-domain transition detector. It deliberately refuses to invent 0-0
 * when either score is absent. Persistence and channel fan-out belong to the
 * Media event outbox, not this helper.
 */
function detectMatchSocialEvent(input = {}) {
  const oldMatch = input.oldMatch || {};
  const match = input.newMatch || {};
  const matchId = String(match.id || '').trim();
  if (!matchId) return null;

  const oldStatus = statusOf(oldMatch.status || 'PRE_MATCH');
  const newStatus = statusOf(match.status);
  const oldScore = scoresOf(oldMatch);
  const newScore = scoresOf(match);
  const oldTotal = oldScore?.total ?? null;
  const newTotal = newScore?.total ?? null;
  const oldGoals = goalsOf(oldMatch.match_events);
  const newGoals = goalsOf(match.match_events);
  const oldPenalties = penaltiesOf(oldMatch.match_events);
  const newPenalties = penaltiesOf(match.match_events);
  const oldHome = validNames(oldMatch.lineups?.home);
  const oldAway = validNames(oldMatch.lineups?.away);
  const newHome = validNames(match.lineups?.home);
  const newAway = validNames(match.lineups?.away);
  const oldFullLineups = oldHome.length >= 11 && oldAway.length >= 11;
  const newFullLineups = newHome.length >= 11 && newAway.length >= 11;
  const nowMs = input.nowMs ?? Date.now();

  if (isTerminal(oldStatus) && isTerminal(newStatus)) return null;

  let baseEventKey = null;
  let suffix = '';
  const details = {};

  if (!isTerminal(oldStatus) && isTerminal(newStatus)) {
    baseEventKey = 'fulltime';
    suffix = 'status-' + newStatus;
  } else if (oldTotal !== null && newTotal !== null && newTotal < oldTotal && !isTerminal(newStatus)) {
    const kickoff = Date.parse(match.match_date || '');
    const hoursSinceKickoff = Number.isFinite(kickoff) ? (nowMs - kickoff) / 3_600_000 : Infinity;
    if (hoursSinceKickoff < 5) {
      baseEventKey = 'var_overturn';
      suffix = 'score-' + newTotal;
    }
  } else if (oldTotal !== null && newTotal !== null && newTotal > oldTotal && !isTerminal(newStatus)) {
    baseEventKey = 'goals';
    details.statusText = isLive(newStatus) ? '' : ' (' + (match.status || '') + ')';
    const goal = latestChangedGoal(oldGoals, newGoals);
    if (goal && !eventIsFresh(goal, match.match_date, nowMs)) return null;
    const player = goal?.player || goal?.playerName || goal?.name;
    const time = goal?.time || goal?.minute;
    details.scorer = goal
      ? player ? '\n⚽ GOAL - ' + player + (time ? ' (' + String(time).trim() + ')' : '') + '\n'
        : '\n⚽ GOAL!' + (time ? ' (' + String(time).trim() + ')' : '') + '\n'
      : '\n⚽ GOAL!\n';
    details.time = time ? String(time) : '';
    suffix = 'score-' + newTotal + '-' + fingerprint(goal, 'score-change');
  } else if (oldTotal !== null && newTotal !== null && newTotal === oldTotal &&
      newPenalties.length > oldPenalties.length && !isTerminal(newStatus)) {
    const latestPenalty = [...newPenalties].sort((a, b) =>
      parseMinute(b.time || b.minute) - parseMinute(a.time || a.minute)
    )[0];
    if (latestPenalty && eventIsFresh(latestPenalty, match.match_date, nowMs)) {
      baseEventKey = 'penalty_awarded';
      details.time = latestPenalty.time || latestPenalty.minute || '';
      suffix = 'count-' + newPenalties.length + '-' + fingerprint(latestPenalty, 'penalty');
    }
  } else if (!isHalfTime(oldStatus) && isHalfTime(newStatus)) {
    baseEventKey = 'halftime';
    suffix = 'status-' + newStatus;
  } else if (isHalfTime(oldStatus) && (isLive(newStatus) || isPreMatch(newStatus))) {
    baseEventKey = 'kickoff';
    suffix = 'status-' + newStatus;
  } else if (isPreMatch(oldStatus) && isLive(newStatus)) {
    baseEventKey = 'kickoff';
    suffix = 'status-' + newStatus;
  } else if (!oldFullLineups && newFullLineups) {
    baseEventKey = 'lineups';
    suffix = [...newHome.slice(0, 11), ...newAway.slice(0, 11)].join('|').slice(0, 240);
  }

  if (!baseEventKey) return null;
  const eventKey = ['goals', 'var_overturn', 'penalty_awarded'].includes(baseEventKey)
    ? baseEventKey + '_' + suffix : baseEventKey;
  const dedupeKey = matchId + ':' + eventKey;
  return {
    matchId, eventKey, baseEventKey, dedupeKey, details,
    match: {
      id: matchId, home_team: match.home_team || '', away_team: match.away_team || '',
      home_score: newScore?.home ?? null, away_score: newScore?.away ?? null,
      status: newStatus, match_date: match.match_date || null, league: match.league || '',
      stage: match.stage || '', match_type: match.match_type || '',
      match_group: match.match_group || match.group || '', home_logo: match.home_logo || null,
      away_logo: match.away_logo || null, home_tla: match.home_tla || null,
      away_tla: match.away_tla || null, media_url: match.media_url || null,
      stream_url: match.stream_url || null, media_mode: match.media_mode || null,
      lineups: match.lineups || {}, match_events: Array.isArray(match.match_events) ? match.match_events : [],
    },
    detectedAt: new Date(nowMs).toISOString(),
  };
}

module.exports = { detectMatchSocialEvent, scoreOf, goalsOf, penaltiesOf, isTerminal, isLive };
