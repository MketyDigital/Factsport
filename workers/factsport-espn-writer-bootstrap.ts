import postgres from 'postgres';

interface Env {
  FACTSPORT_HYPERDRIVE: { connectionString: string };
  FACTSPORT_BOOTSTRAP_TOKEN?: string;
  FACTSPORT_ESPN_PASSWORD?: string;
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
    if (request.method !== 'POST' ||
        new URL(request.url).pathname !== '/__internal/create-factsport-espn-writer') {
      return new Response('Not found', { status: 404 });
    }
    const auth = request.headers.get('Authorization') || '';
    if (!(await tokenValid(env.FACTSPORT_BOOTSTRAP_TOKEN || '',
      auth.startsWith('Bearer ') ? auth.slice(7) : ''))) {
      return new Response('Not found', { status: 404 });
    }
    const password = env.FACTSPORT_ESPN_PASSWORD || '';
    if (!/^[a-f0-9]{64}$/.test(password)) {
      return Response.json({ ok: false, error: 'invalid_password_format' }, { status: 503 });
    }
    const sql = postgres(env.FACTSPORT_HYPERDRIVE.connectionString, {
      max: 1, fetch_types: false, prepare: true, connect_timeout: 10, idle_timeout: 5,
    });
    try {
      await sql.begin(async tx => {
        const [identity] = await tx`SELECT current_database() AS database, current_user AS role`;
        if (identity.database !== 'factsport_v2' || identity.role !== 'mketydbadmin') {
          throw new Error('Wrong database or administrator');
        }
        await tx`SELECT pg_advisory_xact_lock(720061, 5)`;
        await tx.unsafe(`DO $role$
        BEGIN
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'factsport_v2_espn_writer') THEN
            CREATE ROLE factsport_v2_espn_writer LOGIN PASSWORD '${password}' NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 5;
          ELSE
            ALTER ROLE factsport_v2_espn_writer LOGIN PASSWORD '${password}' NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 5;
          END IF;
        END
        $role$`);
        await tx`GRANT CONNECT ON DATABASE factsport_v2 TO factsport_v2_espn_writer`;
        await tx`GRANT USAGE ON SCHEMA public TO factsport_v2_espn_writer`;
        await tx`REVOKE ALL ON TABLE public.matches FROM PUBLIC, factsport_v2_espn_writer`;
        await tx`GRANT SELECT ON TABLE public.matches TO factsport_v2_espn_writer`;
        await tx`GRANT UPDATE (
          espn_id, home_score, away_score, status, match_events, stats,
          source_updated_at, updated_at, version
        ) ON TABLE public.matches TO factsport_v2_espn_writer`;
        await tx`REVOKE ALL ON TABLE public.app_users, public.external_identities, public.job_runs FROM PUBLIC, factsport_v2_espn_writer`;
        const [p] = await tx`
          SELECT
            has_table_privilege('factsport_v2_espn_writer','public.matches','SELECT') AS can_read_matches,
            has_column_privilege('factsport_v2_espn_writer','public.matches','espn_id','UPDATE') AS can_link_espn,
            has_column_privilege('factsport_v2_espn_writer','public.matches','home_score','UPDATE') AS can_update_home_score,
            has_column_privilege('factsport_v2_espn_writer','public.matches','away_score','UPDATE') AS can_update_away_score,
            has_column_privilege('factsport_v2_espn_writer','public.matches','status','UPDATE') AS can_update_status,
            has_column_privilege('factsport_v2_espn_writer','public.matches','match_events','UPDATE') AS can_update_events,
            has_column_privilege('factsport_v2_espn_writer','public.matches','stats','UPDATE') AS can_update_stats,
            has_column_privilege('factsport_v2_espn_writer','public.matches','points_distributed','UPDATE') AS can_update_points_flag,
            has_column_privilege('factsport_v2_espn_writer','public.matches','home_team','UPDATE') AS can_update_team_names,
            has_column_privilege('factsport_v2_espn_writer','public.matches','match_date','UPDATE') AS can_update_kickoff,
            has_table_privilege('factsport_v2_espn_writer','public.matches','INSERT') AS can_insert,
            has_table_privilege('factsport_v2_espn_writer','public.matches','DELETE') AS can_delete,
            has_table_privilege('factsport_v2_espn_writer','public.app_users','SELECT') AS can_read_users,
            has_table_privilege('factsport_v2_espn_writer','public.external_identities','SELECT') AS can_read_identities,
            has_table_privilege('factsport_v2_espn_writer','public.job_runs','SELECT') AS can_read_job_runs,
            (SELECT rolinherit FROM pg_roles WHERE rolname='factsport_v2_espn_writer') AS inherits_roles,
            (SELECT rolconnlimit FROM pg_roles WHERE rolname='factsport_v2_espn_writer') AS connection_limit
        `;
        if (!p.can_read_matches || !p.can_link_espn || !p.can_update_home_score ||
            !p.can_update_away_score || !p.can_update_status || !p.can_update_events ||
            !p.can_update_stats || p.can_update_points_flag || p.can_update_team_names ||
            p.can_update_kickoff || p.can_insert || p.can_delete || p.can_read_users ||
            p.can_read_identities || p.can_read_job_runs || p.inherits_roles || Number(p.connection_limit) !== 5) {
          throw new Error('ESPN writer permissions invalid');
        }
      });
      return Response.json({
        ok: true, role: 'factsport_v2_espn_writer',
        canReadMatches: true, canUpdateEspnLiveFields: true,
        canUpdateSettlement: false, canUpdateScheduleIdentity: false,
        canInsert: false, canDelete: false, canReadPrivateTables: false, roleConnectionLimit: 5,
      }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      const c = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      return Response.json({ ok: false, error: 'espn_writer_bootstrap_failed',
        sqlState: /^[A-Z0-9]{5}$/.test(c) ? c : 'none' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } });
    } finally { await sql.end(); }
  },
};
