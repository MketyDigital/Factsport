const COMPETITIONS = Object.freeze({
  PL: 'Premier League',
  PD: 'La Liga',
  BL1: 'Bundesliga',
  SA: 'Serie A',
  FL1: 'Ligue 1',
  CL: 'Champions League',
});

const MIN_STANDINGS_ROWS = Object.freeze({
  PL: 18, PD: 18, BL1: 16, SA: 18, FL1: 16, CL: 32,
});

const isCount = value => Number.isSafeInteger(value) && value >= 0 && value <= 1000000;
const boundedText = (value, max) =>
  typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max
    ? value.trim()
    : null;
const parseSeason = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return value.slice(0, 4);
};
const normalizeForm = value => {
  if (value == null || value === '') return '';
  if (typeof value !== 'string' || value.length > 20) return null;
  const results = value.split(',').map(item => item.trim().toUpperCase());
  return results.length <= 5 && results.every(item => ['W', 'D', 'L'].includes(item))
    ? results.join(',')
    : null;
};

export const FACTSPORT_COMPETITIONS = COMPETITIONS;

/**
 * Converts only official TOTAL standings into the V2 public read model.
 * Remote crests are omitted until the Media rights review approves their use.
 */
export function normalizeFootballDataStandings(payload, code) {
  if (!Object.hasOwn(COMPETITIONS, code || '')) return null;
  if (!payload || payload.competition?.code !== code) return null;
  const season = parseSeason(payload.season?.startDate);
  const name = boundedText(payload.competition?.name, 100);
  if (!season || name !== COMPETITIONS[code] || !Array.isArray(payload.standings) ||
      payload.standings.length > 20) return null;

  const totals = payload.standings.filter(item => item && item.type === 'TOTAL');
  if (totals.length === 0 || totals.length > 12) return null;
  const rows = [];
  const keys = new Set();
  for (const standing of totals) {
    const group = standing.group == null ? '' : boundedText(standing.group, 80);
    if (group === null || !Array.isArray(standing.table) ||
        standing.table.length < 2 || standing.table.length > 100) return null;
    for (const item of standing.table) {
      const teamId = item?.team?.id;
      const teamName = boundedText(item?.team?.name, 150);
      const shortName = item?.team?.shortName == null ? null : boundedText(item.team.shortName, 100);
      const position = item?.position;
      const played = item?.playedGames;
      const won = item?.won;
      const draw = item?.draw;
      const lost = item?.lost;
      const goalsFor = item?.goalsFor;
      const goalsAgainst = item?.goalsAgainst;
      const goalDifference = item?.goalDifference;
      const points = item?.points;
      const form = normalizeForm(item?.form);
      if (!Number.isSafeInteger(teamId) || teamId <= 0 || !teamName ||
          (item?.team?.shortName != null && !shortName) ||
          !Number.isSafeInteger(position) || position <= 0 ||
          !isCount(played) || !isCount(won) || !isCount(draw) || !isCount(lost) ||
          !isCount(goalsFor) || !isCount(goalsAgainst) ||
          !Number.isSafeInteger(goalDifference) || Math.abs(goalDifference) > 1000000 ||
          !isCount(points) || form === null || won + draw + lost > played ||
          goalsFor - goalsAgainst !== goalDifference) return null;
      const key = group + '\u0000' + teamId;
      if (keys.has(key)) return null;
      keys.add(key);
      rows.push({
        league_code: code,
        league_name: name,
        season,
        match_group: group,
        team_id: String(teamId),
        team_name: teamName,
        team_short_name: shortName,
        team_crest: null,
        position,
        played_games: played,
        won,
        draw,
        lost,
        goals_for: goalsFor,
        goals_against: goalsAgainst,
        goal_difference: goalDifference,
        points,
        form,
        source: 'football-data',
      });
    }
  }
  return rows.length >= MIN_STANDINGS_ROWS[code]
    ? { leagueCode: code, leagueName: name, season, rows }
    : null;
}

/**
 * Converts football-data.org scorer rows into the V2 current-season read model.
 * Unprovided appearances/minutes remain null; no remote crest is persisted.
 */
export function normalizeFootballDataScorers(payload, code) {
  if (!Object.hasOwn(COMPETITIONS, code || '')) return null;
  if (!payload || payload.competition?.code !== code) return null;
  const season = parseSeason(payload.season?.startDate);
  const name = boundedText(payload.competition?.name, 100);
  if (!season || name !== COMPETITIONS[code] || !Array.isArray(payload.scorers) ||
      payload.scorers.length > 100) return null;

  const rows = [];
  const players = new Set();
  for (const item of payload.scorers) {
    const playerId = item?.player?.id;
    const playerName = boundedText(item?.player?.name, 150);
    const teamId = item?.team?.id;
    const teamName = boundedText(item?.team?.name, 150);
    const teamShortName = item?.team?.shortName == null ? null : boundedText(item.team.shortName, 100);
    if (!Number.isSafeInteger(playerId) || playerId <= 0 || !playerName ||
        !Number.isSafeInteger(teamId) || teamId <= 0 || !teamName ||
        (item?.team?.shortName != null && !teamShortName) ||
        !isCount(item?.goals) ||
        (item?.assists != null && !isCount(item.assists))) return null;
    const id = String(playerId);
    if (players.has(id)) return null;
    players.add(id);
    rows.push({
      league_code: code,
      league_name: name,
      season,
      player_id: id,
      player_name: playerName,
      team_id: String(teamId),
      team_name: teamName,
      team_short_name: teamShortName,
      team_crest: null,
      goals: item.goals,
      assists: item.assists == null ? null : item.assists,
      appearances: null,
      minutes_played: null,
      source: 'football-data',
    });
  }
  return { leagueCode: code, leagueName: name, season, rows };
}
