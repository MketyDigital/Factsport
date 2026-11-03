/**
 * Isolated football-data.org v4 schedule normalizer.
 * Intentionally NEVER imports a live/in-play or finished score. ESPN owns live
 * arbitration, and score/point columns remain immutable to the writer role.
 */
export const FACTSPORT_COMPETITIONS = Object.freeze({
  PL: 'Premier League', PD: 'La Liga', BL1: 'Bundesliga',
  SA: 'Serie A', FL1: 'Ligue 1', CL: 'Champions League',
});

const SCHEDULE_STATES = new Set([
  'SCHEDULED', 'TIMED', 'POSTPONED', 'SUSPENDED', 'CANCELLED',
]);
const MAX_DATE_DAYS = 35;

export function normalizeFactsportSchedule(raw, league, now = new Date()) {
  if (!raw || typeof raw !== 'object') return null;
  if (!Object.values(FACTSPORT_COMPETITIONS).includes(league)) return null;
  if (!Number.isSafeInteger(raw.id) || raw.id <= 0) return null;
  if (!SCHEDULE_STATES.has(raw.status)) return null;
  if (typeof raw.utcDate !== 'string') return null;
  const date = new Date(raw.utcDate);
  if (!Number.isFinite(date.getTime())) return null;
  if (date.getTime() < now.getTime() - 86400000 ||
      date.getTime() > now.getTime() + MAX_DATE_DAYS * 86400000) return null;

  const home = raw.homeTeam?.shortName || raw.homeTeam?.name;
  const away = raw.awayTeam?.shortName || raw.awayTeam?.name;
  if (typeof home !== 'string' || typeof away !== 'string' ||
      !home.trim() || !away.trim() || home.length > 150 || away.length > 150 ||
      home === away) return null;
  const status = raw.status === 'TIMED' ? 'SCHEDULED' : raw.status;
  const logo = value => typeof value === 'string' &&
    value.startsWith('https://') && value.length <= 1000 ? value : null;
  const optional = value => typeof value === 'string' && value.length <= 300 ? value : null;
  return {
    api_id: String(raw.id), league, home_team: home.trim(),
    away_team: away.trim(), match_date: date.toISOString(),
    status, home_logo: logo(raw.homeTeam?.crest), away_logo: logo(raw.awayTeam?.crest),
    venue: optional(raw.venue), stage: optional(raw.stage),
    match_group: optional(raw.group),
  };
}

export function factsportDateWindow(now = new Date(), days = 21) {
  if (!Number.isInteger(days) || days < 1 || days > MAX_DATE_DAYS) throw new Error('Bad window');
  const start = new Date(now.getTime() - 86400000);
  const end = new Date(now.getTime() + days * 86400000);
  return {
    dateFrom: start.toISOString().slice(0, 10),
    dateTo: end.toISOString().slice(0, 10),
  };
}
