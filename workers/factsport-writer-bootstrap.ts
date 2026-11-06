import postgres from 'postgres';

interface Env {
  FACTSPORT_HYPERDRIVE: { connectionString: string };
  FACTSPORT_BOOTSTRAP_TOKEN?: string;
  FACTSPORT_WRITER_PASSWORD?: string;
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
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST' ||
        new URL(request.url).pathname !== '/__internal/create-factsport-schedule-writer') {
      return new Response('Not found', { status: 404 });
    }
    const auth = request.headers.get('Authorization') || '';
    if (!(await tokenValid(env.FACTSPORT_BOOTSTRAP_TOKEN || '',
      auth.startsWith('Bearer ') ? auth.slice(7) : ''))) {
      return new Response('Not found', { status: 404 });
    }
    const password = env.FACTSPORT_WRITER_PASSWORD || '';
    if (!/^[a-f0-9]{64}$/.test(password)) {
      return Response.json({ ok: false, error: 'invalid_password_format' }, { status: 503 });
    }
    const sql = postgres(env.FACTSPORT_HYPERDRIVE.connectionString, {
      max: 1, fetch_types: false, prepare: true, connect_timeout: 10, idle_timeout: 5,
    });
    try {
      await sql.begin(async tx => {
        const [identity] = await tx`
          SELECT current_database() AS database, current_user AS role
        `;
        if (identity.database !== 'factsport_v2' || identity.role !== 'mketydbadmin') {
          throw new Error('Wrong database or administrator');
        }
        await tx`SELECT pg_advisory_xact_lock(720061, 4)`;
        // Only a CI-generated 64-character hex password is interpolated.
        await tx.unsafe(`DO $role$
        BEGIN
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'factsport_v2_schedule_writer') THEN
            CREATE ROLE factsport_v2_schedule_writer LOGIN PASSWORD '${password}' NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 5;
          ELSE
            ALTER ROLE factsport_v2_schedule_writer LOGIN PASSWORD '${password}' NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 5;
          END IF;
        END
        $role$`);
        await tx`GRANT CONNECT ON DATABASE factsport_v2 TO factsport_v2_schedule_writer`;
        await tx`GRANT USAGE ON SCHEMA public TO factsport_v2_schedule_writer`;
        // Writer may only touch fixture columns. Never prize/identity tables.
        await tx`REVOKE ALL ON TABLE public.matches FROM PUBLIC, factsport_v2_schedule_writer`;
        await tx`GRANT SELECT ON TABLE public.matches TO factsport_v2_schedule_writer`;
        await tx`GRANT INSERT (
          api_id, league, home_team, away_team,
          match_date, status, home_logo, away_logo, venue, stage, match_group,
          source, source_updated_at
        ) ON TABLE public.matches TO factsport_v2_schedule_writer`;
        await tx`GRANT UPDATE (
          league, home_team, away_team, match_date, status,
          home_logo, away_logo, venue, stage, match_group, source_updated_at
        ) ON TABLE public.matches TO factsport_v2_schedule_writer`;
        await tx`REVOKE ALL ON TABLE public.app_users, public.external_identities, public.job_runs FROM PUBLIC, factsport_v2_schedule_writer`;
        const [priv] = await tx`
          SELECT has_column_privilege('factsport_v2_schedule_writer',
                    'public.matches','api_id','INSERT') AS can_insert,
                 has_table_privilege('factsport_v2_schedule_writer',
                    'public.matches','DELETE') AS can_delete,
                 has_column_privilege('factsport_v2_schedule_writer',
                    'public.matches','home_score','INSERT') AS can_insert_home_score,
                 has_column_privilege('factsport_v2_schedule_writer',
                    'public.matches','away_score','INSERT') AS can_insert_away_score,
                 has_column_privilege('factsport_v2_schedule_writer',
                    'public.matches','home_score','UPDATE') AS can_change_home_score,
                 has_column_privilege('factsport_v2_schedule_writer',
                    'public.matches','away_score','UPDATE') AS can_change_away_score,
                 has_column_privilege('factsport_v2_schedule_writer',
                    'public.matches','points_distributed','UPDATE') AS can_change_settlement,
                 has_column_privilege('factsport_v2_schedule_writer',
                    'public.matches','espn_id','UPDATE') AS can_change_espn_link,
                 (SELECT rolinherit FROM pg_roles WHERE rolname='factsport_v2_schedule_writer') AS inherits_roles,
                 (SELECT rolconnlimit FROM pg_roles WHERE rolname='factsport_v2_schedule_writer') AS connection_limit,
                 has_table_privilege('factsport_v2_schedule_writer',
                    'public.app_users','SELECT') AS can_read_users
        `;
        if (!priv.can_insert || priv.can_delete || priv.can_insert_home_score || priv.can_insert_away_score ||
            priv.can_change_home_score || priv.can_change_away_score || priv.can_change_settlement ||
            priv.can_change_espn_link || priv.inherits_roles || Number(priv.connection_limit) !== 5 || priv.can_read_users) {
          throw new Error('Writer permissions invalid');
        }
      });
      return Response.json({ ok: true, role: 'factsport_v2_schedule_writer',
        canWriteFixtures: true, canDelete: false, canChangeScores: false, canInsertScores: false, roleConnectionLimit: 5 },
      { headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
      const c = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
      return Response.json({ ok: false, error: 'writer_bootstrap_failed',
        sqlState: /^[A-Z0-9]{5}$/.test(c) ? c : 'none' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } });
    } finally { await sql.end(); }
  },
};
