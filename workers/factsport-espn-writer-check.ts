import postgres from 'postgres';

interface Env {
  FACTSPORT_HYPERDRIVE: { connectionString: string };
  FACTSPORT_CHECK_TOKEN?: string;
}

async function tokenValid(expected: string, actual: string) {
  if (!expected || !actual || expected.length > 4096 || actual.length > 4096) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(expected)),
    crypto.subtle.digest('SHA-256', enc.encode(actual)),
  ]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.pathname !== '/__internal/espn-writer-check') {
      return new Response('Not found', { status: 404 });
    }
    const auth = request.headers.get('Authorization') || '';
    if (!(await tokenValid(env.FACTSPORT_CHECK_TOKEN || '',
      auth.startsWith('Bearer ') ? auth.slice(7) : ''))) {
      return new Response('Not found', { status: 404 });
    }
    const sql = postgres(env.FACTSPORT_HYPERDRIVE.connectionString, {
      max: 1, fetch_types: false, prepare: true, connect_timeout: 10, idle_timeout: 5,
    });
    try {
      const [p] = await sql`SELECT current_database() AS database, current_user AS role,
        has_table_privilege(current_user, 'public.matches', 'SELECT') AS can_read_matches,
        has_column_privilege(current_user, 'public.matches', 'espn_id', 'UPDATE') AS can_link_espn,
        has_column_privilege(current_user, 'public.matches', 'home_score', 'UPDATE') AS can_update_home_score,
        has_column_privilege(current_user, 'public.matches', 'away_score', 'UPDATE') AS can_update_away_score,
        has_column_privilege(current_user, 'public.matches', 'status', 'UPDATE') AS can_update_status,
        has_column_privilege(current_user, 'public.matches', 'match_events', 'UPDATE') AS can_update_events,
        has_column_privilege(current_user, 'public.matches', 'stats', 'UPDATE') AS can_update_stats,
        has_column_privilege(current_user, 'public.matches', 'points_distributed', 'UPDATE') AS can_update_points,
        has_column_privilege(current_user, 'public.matches', 'home_team', 'UPDATE') AS can_update_teams,
        has_column_privilege(current_user, 'public.matches', 'match_date', 'UPDATE') AS can_update_kickoff,
        has_table_privilege(current_user, 'public.matches', 'INSERT') AS can_insert,
        has_table_privilege(current_user, 'public.matches', 'DELETE') AS can_delete,
        has_table_privilege(current_user, 'public.app_users', 'SELECT') AS can_read_users,
        has_table_privilege(current_user, 'public.external_identities', 'SELECT') AS can_read_identities,
        has_table_privilege(current_user, 'public.job_runs', 'SELECT') AS can_read_jobs,
        (SELECT rolinherit FROM pg_roles WHERE rolname = current_user) AS inherits_roles,
        (SELECT rolconnlimit FROM pg_roles WHERE rolname = current_user) AS connection_limit`;
      const ok = p.database === 'factsport_v2' && p.role === 'factsport_v2_espn_writer' &&
        p.can_read_matches && p.can_link_espn && p.can_update_home_score &&
        p.can_update_away_score && p.can_update_status && p.can_update_events &&
        p.can_update_stats && !p.can_update_points && !p.can_update_teams &&
        !p.can_update_kickoff && !p.can_insert && !p.can_delete &&
        !p.can_read_users && !p.can_read_identities && !p.can_read_jobs &&
        !p.inherits_roles && Number(p.connection_limit) === 5;
      return Response.json({
        ok, database: p.database === 'factsport_v2' ? p.database : 'unexpected',
        role: p.role === 'factsport_v2_espn_writer' ? p.role : 'unexpected',
        canUpdateEspnLiveFields: !!(p.can_link_espn && p.can_update_home_score &&
          p.can_update_away_score && p.can_update_status && p.can_update_events && p.can_update_stats),
        cannotUpdateSettlementOrSchedule: !p.can_update_points && !p.can_update_teams && !p.can_update_kickoff,
        cannotInsertOrDelete: !p.can_insert && !p.can_delete,
        cannotReadPrivateTables: !p.can_read_users && !p.can_read_identities && !p.can_read_jobs,
        noRoleInheritance: !p.inherits_roles,
        connectionLimit: Number(p.connection_limit),
      }, { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
    } catch {
      return Response.json({ ok: false, error: 'espn_writer_connection_failed' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } });
    } finally { await sql.end(); }
  },
};
