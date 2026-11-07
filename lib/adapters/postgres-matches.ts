/**
 * Server-only PostgreSQL reader for the Factsport v2 public matches API.
 * Every operation uses a request-scoped client; fixture sync and live ESPN
 * arbitration are not switched by this adapter.
 */
import 'server-only';
import { withFactsportPostgres } from '@/lib/adapters/postgres-client';
import { getTeamSearchVariations } from '@/app/lib/teamAliases';

const MATCH_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MATCH_PUBLIC_COLUMNS = 'id, api_id, espn_id, league, home_team, away_team, home_score, away_score, match_date, status, home_logo, away_logo, venue, stage, match_group, match_events, stats, lineups, h2h, referees, predictor, source, source_updated_at, version, created_at, updated_at';

function teamPatterns(teamName: string) {
  if (!teamName || teamName.length > 100) throw new Error('Invalid team filter');
  return Array.from(new Set(getTeamSearchVariations(teamName)
    .map(value => value.replace(/[%_\\\\]/g, '').trim().toLowerCase())
    .filter(Boolean).map(value => `%${value}%`)));
}

export async function listPostgresMatchesWindow(input: {
  from: string; to: string; teamFilter?: string | null;
}) {
  const from = new Date(input.from), to = new Date(input.to);
  if (!Number.isFinite(from.valueOf()) || !Number.isFinite(to.valueOf()) || from >= to) {
    throw new Error('Invalid match window');
  }
  const patterns = input.teamFilter ? teamPatterns(input.teamFilter) : null;
  return withFactsportPostgres(async sql => {
    if (patterns) {
      return sql`
        SELECT id, api_id, espn_id, league, home_team, away_team, home_score, away_score,
               match_date, status, home_logo, away_logo, venue, stage, match_group,
               match_events, stats, lineups, h2h, referees, predictor, source,
               source_updated_at, version, created_at, updated_at
        FROM public.matches
        WHERE match_date >= ${from.toISOString()} AND match_date <= ${to.toISOString()}
          AND (home_team ILIKE ANY(${sql.array(patterns)})
            OR away_team ILIKE ANY(${sql.array(patterns)}))
        ORDER BY match_date ASC, id ASC LIMIT 100
      `;
    }
    return sql`
      SELECT id, api_id, espn_id, league, home_team, away_team, home_score, away_score,
             match_date, status, home_logo, away_logo, venue, stage, match_group,
             match_events, stats, lineups, h2h, referees, predictor, source,
             source_updated_at, version, created_at, updated_at
      FROM public.matches
      WHERE match_date >= ${from.toISOString()} AND match_date <= ${to.toISOString()}
      ORDER BY match_date ASC, id ASC LIMIT 1500
    `;
  });
}

export async function getPostgresTeamForm(teamName: string) {
  const patterns = teamPatterns(teamName);
  const variations = getTeamSearchVariations(teamName).map(value => value.toLowerCase());
  return withFactsportPostgres(async sql => {
    const rows = await sql`
      SELECT home_team, away_team, home_score, away_score
      FROM public.matches
      WHERE status IN ('FT','FINISHED','AET','PEN','AWARDED','ABD') AND match_date < now()
        AND (home_team ILIKE ANY(${sql.array(patterns)})
          OR away_team ILIKE ANY(${sql.array(patterns)}))
      ORDER BY match_date DESC LIMIT 30
    `;
    const form: string[] = [];
    for (const match of rows) {
      const home = String(match.home_team || '').toLowerCase();
      const away = String(match.away_team || '').toLowerCase();
      const isHome = variations.some(value => home.includes(value) || value.includes(home));
      const isAway = variations.some(value => away.includes(value) || value.includes(away));
      if (!isHome && !isAway) continue;
      if (match.home_score === null || match.away_score === null) continue;
      if (match.home_score === match.away_score) form.push('D');
      else if (isHome) form.push(match.home_score > match.away_score ? 'W' : 'L');
      else form.push(match.away_score > match.home_score ? 'W' : 'L');
      if (form.length === 5) break;
    }
    return form.reverse();
  });
}

export async function listPostgresMatches(input: {
  league: string;
  cursor: string;
  cursorId?: string | null;
  type: 'results' | 'fixtures';
}) {
  if (!input.league || input.league.length > 100) throw new Error('Invalid league');
  if (input.type !== 'results' && input.type !== 'fixtures') throw new Error('Invalid match type');
  const date = new Date(input.cursor);
  if (!Number.isFinite(date.valueOf())) throw new Error('Invalid cursor');
  if (input.cursorId && !MATCH_UUID_PATTERN.test(input.cursorId)) throw new Error('Invalid cursor id');
  const cursor = date.toISOString();

  return withFactsportPostgres(async sql => {
    if (input.type === 'results') {
      if (input.cursorId) return sql`
        SELECT id, api_id, espn_id, league, home_team, away_team, home_score, away_score,
               match_date, status, home_logo, away_logo, venue, stage, match_group,
               match_events, stats, lineups, h2h, referees, predictor, source,
               source_updated_at, version, created_at, updated_at
        FROM public.matches WHERE league = ${input.league}
          AND status IN ('FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD')
          AND (match_date, id) < (${cursor}::timestamptz, ${input.cursorId}::uuid)
        ORDER BY match_date DESC, id DESC LIMIT 15
      `;
      return sql`
        SELECT id, api_id, espn_id, league, home_team, away_team, home_score, away_score,
               match_date, status, home_logo, away_logo, venue, stage, match_group,
               match_events, stats, lineups, h2h, referees, predictor, source,
               source_updated_at, version, created_at, updated_at
        FROM public.matches
        WHERE league = ${input.league}
          AND status IN ('FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD')
          AND match_date < ${cursor}::timestamptz
        ORDER BY match_date DESC, id DESC LIMIT 15
      `;
    }
    if (input.cursorId) return sql`
      SELECT id, api_id, espn_id, league, home_team, away_team, home_score, away_score,
             match_date, status, home_logo, away_logo, venue, stage, match_group,
             match_events, stats, lineups, h2h, referees, predictor, source,
             source_updated_at, version, created_at, updated_at
      FROM public.matches WHERE league = ${input.league}
        AND status NOT IN ('FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD')
        AND (match_date, id) > (${cursor}::timestamptz, ${input.cursorId}::uuid)
      ORDER BY match_date ASC, id ASC LIMIT 15
    `;
    return sql`
      SELECT id, api_id, espn_id, league, home_team, away_team, home_score, away_score,
             match_date, status, home_logo, away_logo, venue, stage, match_group,
             match_events, stats, lineups, h2h, referees, predictor, source,
             source_updated_at, version, created_at, updated_at
      FROM public.matches
      WHERE league = ${input.league}
        AND status NOT IN ('FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD')
        AND match_date > ${cursor}::timestamptz
      ORDER BY match_date ASC, id ASC LIMIT 15
    `;
  });
}

export async function listPostgresLeagueResults(league: string, season: string, limit = 1500) {
  if (!league || league.length > 100) throw new Error('Invalid league');
  if (!season || season.length > 32) throw new Error('Invalid season');
  if (!Number.isInteger(limit) || limit < 1 || limit > 2000) throw new Error('Invalid result limit');
  return withFactsportPostgres(sql => sql`
    SELECT home_team, away_team, home_score, away_score, status, match_date
    FROM public.matches
    WHERE league = ${league}
      AND season = ${season}
      AND status IN ('FT', 'FINISHED', 'AET', 'PEN', 'AWARDED')
      AND home_score IS NOT NULL AND away_score IS NOT NULL
    ORDER BY match_date DESC, id DESC
    LIMIT ${limit}
  `);
}

export async function listPostgresLeagueMatches(league: string, limit = 500) {
  if (!league || league.length > 100) throw new Error('Invalid league');
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error('Invalid league match limit');
  return withFactsportPostgres(sql => sql`
    SELECT id, api_id, home_team, away_team, home_score, away_score,
           match_date, status, home_logo, away_logo, stage, match_group, venue
    FROM public.matches
    WHERE league = ${league}
    ORDER BY match_date ASC, id ASC
    LIMIT ${limit}
  `);
}
