/**
 * Server-only PostgreSQL reader for the Factsport v2 public matches API.
 * This is deliberately read-only; fixture sync and live ESPN arbitration
 * are not switched by this adapter.
 */
import 'server-only';
import postgres from 'postgres';
import { env } from 'cloudflare:workers';
import { getTeamSearchVariations } from '@/app/lib/teamAliases';

let client: ReturnType<typeof postgres> | undefined;

// Explicit public DTO projection: never expose internal settlement flags or future columns by default.
const MATCH_SELECT = 'id, api_id, espn_id, league, home_team, away_team, home_score, away_score, match_date, status, home_logo, away_logo, venue, stage, match_group, match_events, stats, lineups, h2h, referees, predictor, source, source_updated_at, version, created_at, updated_at';

function db() {
  if (!client) {
    // vinext/Workers resolves credentials from the secure, server-only Hyperdrive
    // binding. Do not copy or expose its connection string.
    const cloudflareUrl = env?.FACTSPORT_HYPERDRIVE?.connectionString;
    const directUrl = process.env.DATABASE_URL;
    if (cloudflareUrl) {
      client = postgres(cloudflareUrl, {
        max: 3, fetch_types: false, prepare: true,
        idle_timeout: 10, connect_timeout: 10,
      });
    } else if (directUrl) {
      // Azure direct TLS fallback for approved non-Worker verification only.
      client = postgres(directUrl, {
        ssl: 'require', max: 3, idle_timeout: 20, connect_timeout: 10,
      });
    } else {
      throw new Error('Factsport PostgreSQL connection is not configured');
    }
  }
  return client;
}


const MATCH_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function teamPatterns(teamName: string) {
  if (!teamName || teamName.length > 100) throw new Error('Invalid team filter');
  return [...new Set(getTeamSearchVariations(teamName)
    .map(value => value.replace(/[%_\\\\]/g, '').trim().toLowerCase())
    .filter(Boolean).map(value => `%${value}%`))];
}

export async function listPostgresMatchesWindow(input: {
  from: string; to: string; teamFilter?: string | null;
}) {
  const from = new Date(input.from), to = new Date(input.to);
  if (!Number.isFinite(from.valueOf()) || !Number.isFinite(to.valueOf()) || from >= to) {
    throw new Error('Invalid match window');
  }
  const sql = db();
  if (input.teamFilter) {
    const patterns = teamPatterns(input.teamFilter);
    return sql`
      SELECT ${sql.unsafe(MATCH_SELECT)} FROM public.matches
      WHERE match_date >= ${from.toISOString()} AND match_date <= ${to.toISOString()}
        AND (home_team ILIKE ANY(${sql.array(patterns, 'text')})
          OR away_team ILIKE ANY(${sql.array(patterns, 'text')}))
      ORDER BY match_date ASC, id ASC LIMIT 100
    `;
  }
  return sql`
    SELECT ${sql.unsafe(MATCH_SELECT)} FROM public.matches
    WHERE match_date >= ${from.toISOString()} AND match_date <= ${to.toISOString()}
    ORDER BY match_date ASC, id ASC LIMIT 1500
  `;
}

export async function getPostgresTeamForm(teamName: string) {
  const patterns = teamPatterns(teamName);
  const variations = getTeamSearchVariations(teamName).map(value => value.toLowerCase());
  const sql = db();
  const rows = await sql`
    SELECT home_team, away_team, home_score, away_score
    FROM public.matches
    WHERE status IN ('FT','FINISHED','AET','PEN','AWARDED','ABD') AND match_date < now()
      AND (home_team ILIKE ANY(${sql.array(patterns, 'text')})
        OR away_team ILIKE ANY(${sql.array(patterns, 'text')}))
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
}

export async function listPostgresMatches(input: {
  league: string;
  cursor: string;
  cursorId?: string | null;
  type: 'results' | 'fixtures';
}) {
  if (input.league.length > 100) throw new Error('Invalid league');
  const date = new Date(input.cursor);
  if (!Number.isFinite(date.valueOf())) throw new Error('Invalid cursor');
  if (input.cursorId && !MATCH_UUID_PATTERN.test(input.cursorId)) throw new Error('Invalid cursor id');
  const sql = db();
  const cursor = date.toISOString();

  if (input.type === 'results') {
    if (input.cursorId) return sql`SELECT ${sql.unsafe(MATCH_SELECT)} FROM public.matches WHERE league = ${input.league}
      AND status IN ('FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD')
      AND (match_date, id) < (${cursor}, ${input.cursorId}::uuid)
      ORDER BY match_date DESC, id DESC LIMIT 15`;
    return sql`
      SELECT ${sql.unsafe(MATCH_SELECT)} FROM public.matches
      WHERE league = ${input.league}
        AND status IN ('FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD')
        AND match_date < ${cursor}
      ORDER BY match_date DESC, id DESC LIMIT 15
    `;
  }
  if (input.cursorId) return sql`SELECT ${sql.unsafe(MATCH_SELECT)} FROM public.matches WHERE league = ${input.league}
    AND status NOT IN ('FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD')
    AND (match_date, id) > (${cursor}, ${input.cursorId}::uuid)
    ORDER BY match_date ASC, id ASC LIMIT 15`;
  return sql`
    SELECT ${sql.unsafe(MATCH_SELECT)} FROM public.matches
    WHERE league = ${input.league}
      AND status NOT IN ('FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD')
      AND match_date > ${cursor}
    ORDER BY match_date ASC, id ASC LIMIT 15
  `;
}
