/**
 * Conservative ESPN-to-fixture reconciliation primitives.
 *
 * This module only creates candidate links. It never writes espn_id, scores,
 * statuses, or settlement fields. Ambiguous or weak matches must be reviewed.
 */
const MAX_KICKOFF_DELTA_MS = 3 * 60 * 60 * 1000;

function cleanTeamName(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  return value.normalize('NFKC').toLocaleLowerCase('en')
    .replace(/\b(fc|cf)\b/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim().replace(/\s+/g, ' ');
}

function safeScore(value) {
  if (value === null || value === undefined || value === '') return null;
  const score = Number(value);
  return Number.isSafeInteger(score) && score >= 0 && score <= 99 ? score : null;
}

export function normalizeEspnScoreboardEvent(event, league) {
  if (!event || typeof event !== 'object' || typeof league !== 'string' || !league.trim()) return null;
  const competition = event.competitions?.[0];
  const competitors = competition?.competitors;
  if (!Array.isArray(competitors)) return null;
  const home = competitors.find(item => item?.homeAway === 'home');
  const away = competitors.find(item => item?.homeAway === 'away');
  const homeName = home?.team?.displayName;
  const awayName = away?.team?.displayName;
  const kickoff = Date.parse(event.date || '');
  const espnId = typeof event.id === 'string' || typeof event.id === 'number'
    ? String(event.id) : '';
  const homeKey = cleanTeamName(homeName);
  const awayKey = cleanTeamName(awayName);
  if (!/^\d{1,24}$/.test(espnId) || !homeKey || !awayKey || homeKey === awayKey ||
      !Number.isFinite(kickoff)) return null;
  const eventStatus = event.status || competition?.status;
  const state = eventStatus?.type?.state;
  const status = state === 'in' ? 'LIVE' : state === 'post' ? 'FT' :
    state === 'pre' ? 'PRE_MATCH' : 'UNKNOWN';
  return {
    espn_id: espnId, league, home_team: String(homeName).trim(),
    away_team: String(awayName).trim(), home_key: homeKey, away_key: awayKey,
    kickoff_ms: kickoff, status,
    home_score: safeScore(home?.score), away_score: safeScore(away?.score),
    displayClock: eventStatus?.displayClock || '',
  };
}

/**
 * Exact normalized team names + same league + kickoff within three hours.
 * A candidate is emitted only when precisely one fixture qualifies.
 */
export function findUniqueEspnFixtureCandidate(event, fixtures) {
  if (!event || !Array.isArray(fixtures)) return { outcome: 'invalid_input', candidate: null, candidateCount: 0 };
  const candidates = fixtures.filter(fixture => {
    if (!fixture || fixture.league !== event.league || fixture.espn_id ||
        fixture.source !== 'football-data' || fixture.points_distributed === true) return false;
    const allowedStatuses = new Set(['SCHEDULED', 'TBD', 'POSTPONED', 'SUSPENDED', 'PRE', 'PRE_MATCH', 'TIMED']);
    if (fixture.status && !allowedStatuses.has(fixture.status)) return false;
    const homeKey = cleanTeamName(fixture.home_team);
    const awayKey = cleanTeamName(fixture.away_team);
    const kickoff = Date.parse(fixture.match_date || '');
    return homeKey === event.home_key && awayKey === event.away_key &&
      Number.isFinite(kickoff) && Math.abs(kickoff - event.kickoff_ms) <= MAX_KICKOFF_DELTA_MS;
  });
  if (candidates.length === 1) return { outcome: 'unique_candidate', candidate: candidates[0], candidateCount: 1 };
  return { outcome: candidates.length ? 'ambiguous' : 'no_match', candidate: null, candidateCount: candidates.length };
}
