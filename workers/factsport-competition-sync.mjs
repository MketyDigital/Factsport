/**
 * Factsport V2 competition snapshots. Staging worker only.
 * Reads official football-data.org standings/scorers and writes snapshots through
 * a separate least-privilege competition LOGIN role. Never writes match scores.
 */
import postgres from 'postgres';
import {
  FACTSPORT_COMPETITIONS,
  normalizeFootballDataStandings,
  normalizeFootballDataScorers,
} from '../lib/ingestion/factsport-competition.mjs';

const COMPETITIONS = Object.keys(FACTSPORT_COMPETITIONS);
const STANDINGS_COMPETITIONS = new Set(['PL', 'PD', 'BL1', 'SA', 'FL1']);
const CRON = '0 4,16 * * *';
const PROVIDER_REQUEST_SPACING_MS = 8000;
let lastProviderRequestAt = 0;

async function tokenMatches(expected, provided) {
  if (!expected || !provided || expected.length > 4096 || provided.length > 4096) return false;
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
  ]);
  const left = new Uint8Array(a), right = new Uint8Array(b);
  let mismatch = 0;
  for (let i = 0; i < left.length; i++) mismatch |= left[i] ^ right[i];
  return mismatch === 0;
}

function database(env) {
  const connectionString = env.FACTSPORT_HYPERDRIVE?.connectionString;
  if (!connectionString) throw new Error('Missing Hyperdrive');
  return postgres(connectionString, {
    max: 1, fetch_types: false, prepare: true, connect_timeout: 10, idle_timeout: 5,
  });
}

async function verifyWriter(sql) {
  const [identity] = await sql`
    SELECT current_database() = 'factsport_v2' AS correct_database,
      current_user = 'factsport_v2_competition_app' AS correct_role,
      pg_has_role(current_user, 'factsport_v2_competition_writer', 'USAGE') AS has_writer_capability,
      to_regclass('public.competition_standings_current_snapshot_idx') IS NOT NULL
        AS standings_snapshot_index_ready,
      to_regclass('public.competition_player_stats_current_snapshot_idx') IS NOT NULL
        AS scorer_snapshot_index_ready,
      to_regclass('public.competition_one_current_season_idx') IS NULL
        AS standings_multirow_index_ready,
      to_regclass('public.competition_player_stats_one_current_season_idx') IS NULL
        AS scorer_multirow_index_ready,
      has_table_privilege(current_user, 'public.competition_standings', 'INSERT,UPDATE') AS can_write_standings,
      has_table_privilege(current_user, 'public.competition_player_stats', 'INSERT,UPDATE') AS can_write_scorers,
      has_table_privilege(current_user, 'public.matches', 'UPDATE') AS can_update_matches,
      has_table_privilege(current_user, 'public.matches', 'DELETE') AS can_delete_matches,
      (SELECT rolinherit FROM pg_roles WHERE rolname = current_user) AS inherits_roles,
      (SELECT rolconnlimit FROM pg_roles WHERE rolname = current_user) AS connection_limit
  `;
  return identity?.correct_database === true &&
    identity.correct_role === true && identity.has_writer_capability === true &&
    identity.standings_snapshot_index_ready === true && identity.scorer_snapshot_index_ready === true &&
    identity.standings_multirow_index_ready === true && identity.scorer_multirow_index_ready === true &&
    identity.can_write_standings === true && identity.can_write_scorers === true &&
    identity.can_update_matches === false && identity.can_delete_matches === false &&
    identity.inherits_roles === true && Number(identity.connection_limit) === 3;
}

async function providerJson(url, key) {
  const waitMs = Math.max(0, lastProviderRequestAt + PROVIDER_REQUEST_SPACING_MS - Date.now());
  if (waitMs) await new Promise(resolve => setTimeout(resolve, waitMs));
  lastProviderRequestAt = Date.now();
  const response = await fetch(url, {
    headers: { 'X-Auth-Token': key, Accept: 'application/json' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) return { ok: false, status: response.status };
  const payload = await response.json();
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, status: 502 };
  }
  return { ok: true, payload };
}

async function saveStandings(tx, snapshot) {
    await tx`
      UPDATE public.competition_standings
      SET is_current = false, updated_at = now()
      WHERE league_code = ${snapshot.leagueCode} AND is_current = true
    `;
    for (const row of snapshot.rows) {
      await tx`
        INSERT INTO public.competition_standings (
          league_code, league_name, season, match_group, team_id, team_name,
          team_short_name, team_crest, position, played_games, won, draw, lost,
          goals_for, goals_against, goal_difference, points, form, is_current,
          source, source_updated_at, updated_at
        ) VALUES (
          ${row.league_code}, ${row.league_name}, ${row.season}, ${row.match_group},
          ${row.team_id}, ${row.team_name}, ${row.team_short_name}, NULL,
          ${row.position}, ${row.played_games}, ${row.won}, ${row.draw}, ${row.lost},
          ${row.goals_for}, ${row.goals_against}, ${row.goal_difference}, ${row.points},
          ${row.form}, true, 'football-data', now(), now()
        )
        ON CONFLICT (league_code, season, match_group, team_id) DO UPDATE SET
          league_name = excluded.league_name, team_name = excluded.team_name,
          team_short_name = excluded.team_short_name, team_crest = NULL,
          position = excluded.position, played_games = excluded.played_games,
          won = excluded.won, draw = excluded.draw, lost = excluded.lost,
          goals_for = excluded.goals_for, goals_against = excluded.goals_against,
          goal_difference = excluded.goal_difference, points = excluded.points,
          form = excluded.form, is_current = true, source = 'football-data',
          source_updated_at = now(), updated_at = now()
      `;
    }
  return snapshot.rows.length;
}

async function saveScorers(tx, snapshot) {
  if (!snapshot?.rows.length) return 0;
    await tx`
      UPDATE public.competition_player_stats
      SET is_current = false, updated_at = now()
      WHERE league_code = ${snapshot.leagueCode} AND is_current = true
    `;
    for (const row of snapshot.rows) {
      await tx`
        INSERT INTO public.competition_player_stats (
          league_code, league_name, season, player_id, player_name, team_id,
          team_name, team_short_name, team_crest, goals, assists, appearances,
          minutes_played, is_current, source, source_updated_at, updated_at
        ) VALUES (
          ${row.league_code}, ${row.league_name}, ${row.season}, ${row.player_id},
          ${row.player_name}, ${row.team_id}, ${row.team_name}, ${row.team_short_name},
          NULL, ${row.goals}, ${row.assists}, NULL, NULL, true, 'football-data', now(), now()
        )
        ON CONFLICT (league_code, season, player_id) DO UPDATE SET
          league_name = excluded.league_name, player_name = excluded.player_name,
          team_id = excluded.team_id, team_name = excluded.team_name,
          team_short_name = excluded.team_short_name, team_crest = NULL,
          goals = excluded.goals, assists = excluded.assists,
          appearances = NULL, minutes_played = NULL, is_current = true,
          source = 'football-data', source_updated_at = now(), updated_at = now()
      `;
    }
  return snapshot.rows.length;
}

async function loadCompetition(env, code) {
  const key = env.FACTSPORT_FOOTBALL_DATA_KEY;
  if (!key) throw new Error('Provider key missing');
  const root = `https://api.football-data.org/v4/competitions/${code}`;
  let standings = null;
  if (STANDINGS_COMPETITIONS.has(code)) {
    const standingsResult = await providerJson(root + '/standings', key);
    if (!standingsResult.ok) {
      return { snapshot: null, result: { competition: code,
        standings: 'provider_error_' + standingsResult.status, error: true } };
    }
    standings = normalizeFootballDataStandings(standingsResult.payload, code);
    if (!standings) return { snapshot: null, result: {
      competition: code, standings: 'invalid_or_incomplete', error: true,
    } };
  }

  // Scorer access varies by competition. Rate limits and server failures abort
  // the batch before writes; plan-level 403/404 leaves the last good snapshot.
  const scorerResult = await providerJson(root + '/scorers', key);
  if (!scorerResult.ok && ![403, 404].includes(scorerResult.status)) {
    return { snapshot: null, result: { competition: code,
      standings: standings ? 'ready' : 'not_supported',
      scorers: 'provider_error_' + scorerResult.status, error: true } };
  }
  const scorers = scorerResult.ok
    ? normalizeFootballDataScorers(scorerResult.payload, code)
    : null;
  if (scorerResult.ok && !scorers) {
    return { snapshot: null, result: { competition: code,
      standings: standings ? 'ready' : 'not_supported',
      scorers: 'invalid_or_incomplete', error: true } };
  }
  return {
    snapshot: { code, standings, scorers },
    result: {
      competition: code,
      standings: standings ? 'ready' : 'not_supported',
      standingsRows: standings?.rows.length || 0,
      scorers: scorers?.rows.length ? 'ready' : 'unavailable_or_empty',
      scorerRows: scorers?.rows.length || 0,
    },
  };
}

async function saveSnapshots(sql, snapshots) {
  return sql.begin(async tx => {
    const results = [];
    for (const { code, standings, scorers } of snapshots) {
      const standingRows = standings ? await saveStandings(tx, standings) : 0;
      const scorerRows = scorers?.rows.length ? await saveScorers(tx, scorers) : 0;
      results.push({
        competition: code,
        standings: standings ? 'updated' : 'not_supported',
        standingsRows: standingRows,
        scorers: scorerRows ? 'updated' : 'unchanged_unavailable_or_empty',
        scorerRows,
      });
    }
    return results;
  });
}

export default {
  async scheduled(controller, env) {
    if (controller.cron !== CRON) throw new Error('Unexpected competition sync schedule');
    const sql = database(env);
    try {
      if (!(await verifyWriter(sql))) throw new Error('Competition writer identity failed');
      const loaded = [];
      for (const code of COMPETITIONS) loaded.push(await loadCompetition(env, code));
      if (loaded.some(item => item.result.error)) throw new Error('Competition provider batch rejected before writes');
      const saved = await saveSnapshots(sql, loaded.map(item => item.snapshot));
      for (const result of saved) console.log('Factsport competition snapshot', JSON.stringify(result));
    } finally {
      await sql.end();
    }
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/__internal/competition-sync' ||
        !['GET', 'POST'].includes(request.method) ||
        !(await tokenMatches(env.FACTSPORT_COMPETITION_SYNC_TOKEN || '',
          (request.headers.get('Authorization') || '').replace(/^Bearer /, '')))) {
      return new Response('Not found', { status: 404 });
    }
    const sql = database(env);
    try {
      if (!(await verifyWriter(sql))) {
        return Response.json({ ok: false, error: 'writer_identity_check_failed' },
          { status: 503, headers: { 'Cache-Control': 'no-store' } });
      }
      if (request.method === 'GET') {
        const [counts] = await sql`
          SELECT
            (SELECT count(*)::integer FROM public.public_competition_standings) AS standings_rows,
            (SELECT count(*)::integer FROM public.public_competition_player_stats) AS scorer_rows,
            (SELECT max(source_updated_at) FROM public.public_competition_standings) AS standings_updated_at,
            (SELECT max(source_updated_at) FROM public.public_competition_player_stats) AS scorers_updated_at
        `;
        return Response.json({
          ok: true, database: 'factsport_v2', writerRoleVerified: true,
          standingsRows: Number(counts.standings_rows),
          scorerRows: Number(counts.scorer_rows),
          standingsUpdatedAt: counts.standings_updated_at,
          scorersUpdatedAt: counts.scorers_updated_at,
        }, { headers: { 'Cache-Control': 'no-store' } });
      }
      let body = {};
      try { body = await request.json(); } catch {
        return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
      }
      const competition = body.competition || 'all';
      const dryRun = body.dryRun === true;
      const selected = competition === 'all' ? COMPETITIONS :
        Object.hasOwn(FACTSPORT_COMPETITIONS, competition) ? [competition] : null;
      if (!selected || typeof body.dryRun !== 'boolean') {
        return Response.json({ ok: false, error: 'invalid_sync_request' }, { status: 400 });
      }
      const loaded = [];
      for (const code of selected) loaded.push(await loadCompetition(env, code));
      const valid = loaded.every(item => item.snapshot !== null && !item.result.error);
      if (!valid) {
        return Response.json({ ok: false, dryRun, competitions: loaded.map(item => item.result) },
          { status: 503, headers: { 'Cache-Control': 'no-store' } });
      }
      const results = dryRun
        ? loaded.map(item => item.result)
        : await saveSnapshots(sql, loaded.map(item => item.snapshot));
      return Response.json({ ok: true, dryRun, competitions: results },
        { status: 200, headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      return Response.json({
        ok: false, error: 'competition_sync_failed',
        sqlState: /^[A-Z0-9]{5}$/.test(code) ? code : 'none',
      }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    } finally {
      await sql.end();
    }
  },
};
