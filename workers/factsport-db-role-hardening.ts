import postgres from 'postgres';

interface Env {
  FACTSPORT_HYPERDRIVE: { connectionString: string };
  FACTSPORT_HARDEN_TOKEN?: string;
}

async function tokenMatches(expected: string, provided: string): Promise<boolean> {
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST' ||
        new URL(request.url).pathname !== '/__internal/harden-staging-db-roles') {
      return new Response('Not found', { status: 404 });
    }
    const auth = request.headers.get('Authorization') || '';
    const provided = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!(await tokenMatches(env.FACTSPORT_HARDEN_TOKEN || '', provided))) {
      return new Response('Not found', { status: 404 });
    }
    const connectionString = env.FACTSPORT_HYPERDRIVE?.connectionString;
    if (!connectionString) {
      return Response.json({ ok: false, error: 'hyperdrive_missing' }, {
        status: 503, headers: { 'Cache-Control': 'no-store' },
      });
    }

    const sql = postgres(connectionString, {
      max: 1, fetch_types: false, prepare: false, connect_timeout: 10, idle_timeout: 5,
    });
    try {
      const result = await sql.begin(async tx => {
        const [identity] = await tx`
          SELECT current_database() AS database, current_user AS connected_as
        `;
        if (identity.database !== 'factsport_v2' || identity.connected_as !== 'mketydbadmin') {
          throw new Error('unexpected_database_identity');
        }
        await tx`SELECT pg_advisory_xact_lock(720061, 9)`;

        const memberships = await tx`
          SELECT member.rolname AS role_name, granted.rolname AS member_of
          FROM pg_auth_members membership
          JOIN pg_roles member ON member.oid = membership.member
          JOIN pg_roles granted ON granted.oid = membership.roleid
          WHERE member.rolname IN (
            'factsport_v2_reader',
            'factsport_v2_schedule_writer',
            'factsport_v2_espn_writer'
          )
        `;
        if (memberships.length !== 0) {
          throw new Error('unexpected_role_memberships');
        }

        await tx`ALTER ROLE factsport_v2_reader WITH NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 5`;
        await tx`ALTER ROLE factsport_v2_schedule_writer WITH NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 5`;
        await tx`ALTER ROLE factsport_v2_espn_writer WITH NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 5`;

        await tx`REVOKE INSERT (home_score, away_score) ON TABLE public.matches FROM factsport_v2_schedule_writer`;
        await tx`REVOKE TEMPORARY ON DATABASE factsport_v2 FROM PUBLIC, factsport_v2_reader, factsport_v2_schedule_writer, factsport_v2_espn_writer`;

        const roles = await tx`
          SELECT rolname AS role_name, rolinherit AS inherits_roles,
            rolconnlimit AS connection_limit, rolsuper AS is_superuser,
            rolcreatedb AS can_create_databases, rolcreaterole AS can_create_roles,
            rolreplication AS can_replicate, rolbypassrls AS bypasses_rls
          FROM pg_roles
          WHERE rolname IN (
            'factsport_v2_reader',
            'factsport_v2_schedule_writer',
            'factsport_v2_espn_writer'
          )
          ORDER BY rolname
        `;
        const [schedule] = await tx`
          SELECT
            has_column_privilege('factsport_v2_schedule_writer','public.matches','api_id','INSERT') AS can_insert_fixture,
            has_column_privilege('factsport_v2_schedule_writer','public.matches','home_score','INSERT') AS can_insert_home_score,
            has_column_privilege('factsport_v2_schedule_writer','public.matches','away_score','INSERT') AS can_insert_away_score,
            has_column_privilege('factsport_v2_schedule_writer','public.matches','home_score','UPDATE') AS can_update_home_score,
            has_column_privilege('factsport_v2_schedule_writer','public.matches','away_score','UPDATE') AS can_update_away_score,
            has_column_privilege('factsport_v2_schedule_writer','public.matches','points_distributed','UPDATE') AS can_update_settlement
        `;
        const [reader] = await tx`
          SELECT
            has_column_privilege('factsport_v2_reader','public.matches','api_id','INSERT') AS can_insert_fixture,
            has_column_privilege('factsport_v2_reader','public.matches','home_score','UPDATE') AS can_update_score,
            has_table_privilege('factsport_v2_reader','public.matches','DELETE') AS can_delete
        `;
        const [espn] = await tx`
          SELECT
            has_column_privilege('factsport_v2_espn_writer','public.matches','espn_id','UPDATE') AS can_link_espn,
            has_column_privilege('factsport_v2_espn_writer','public.matches','home_score','UPDATE') AS can_update_home_score,
            has_column_privilege('factsport_v2_espn_writer','public.matches','away_score','UPDATE') AS can_update_away_score,
            has_column_privilege('factsport_v2_espn_writer','public.matches','points_distributed','UPDATE') AS can_update_settlement,
            has_column_privilege('factsport_v2_espn_writer','public.matches','home_team','UPDATE') AS can_update_team,
            has_column_privilege('factsport_v2_espn_writer','public.matches','match_date','UPDATE') AS can_update_kickoff,
            has_table_privilege('factsport_v2_espn_writer','public.matches','INSERT') AS can_insert,
            has_table_privilege('factsport_v2_espn_writer','public.matches','DELETE') AS can_delete
        `;
        const [databasePrivileges] = await tx`
          SELECT
            has_database_privilege('factsport_v2_reader', current_database(), 'TEMP') AS reader_can_create_temp,
            has_database_privilege('factsport_v2_schedule_writer', current_database(), 'TEMP') AS schedule_can_create_temp,
            has_database_privilege('factsport_v2_espn_writer', current_database(), 'TEMP') AS espn_can_create_temp
        `;
        const safeRoles = roles.length === 3 && roles.every(r =>
          r.inherits_roles === false && Number(r.connection_limit) === 5 &&
          r.is_superuser === false && r.can_create_databases === false &&
          r.can_create_roles === false && r.can_replicate === false && r.bypasses_rls === false);
        const safeSchedule = !!schedule.can_insert_fixture &&
          !schedule.can_insert_home_score && !schedule.can_insert_away_score &&
          !schedule.can_update_home_score && !schedule.can_update_away_score &&
          !schedule.can_update_settlement;
        const safeReader = !reader.can_insert_fixture && !reader.can_update_score && !reader.can_delete;
        const safeDatabase = !databasePrivileges.reader_can_create_temp &&
          !databasePrivileges.schedule_can_create_temp && !databasePrivileges.espn_can_create_temp;
        const safeEspn = !!espn.can_link_espn && !!espn.can_update_home_score &&
          !!espn.can_update_away_score && !espn.can_update_settlement &&
          !espn.can_update_team && !espn.can_update_kickoff && !espn.can_insert && !espn.can_delete;
        if (!safeRoles || !safeSchedule || !safeReader || !safeEspn || !safeDatabase) {
          throw new Error('post_hardening_privilege_check_failed');
        }
        return {
          ok: true,
          noTempTables: true,
          roles,
          schedule: {
            canInsertFixture: !!schedule.can_insert_fixture,
            cannotInsertOrUpdateScores: !schedule.can_insert_home_score &&
              !schedule.can_insert_away_score && !schedule.can_update_home_score &&
              !schedule.can_update_away_score,
            cannotUpdateSettlement: !schedule.can_update_settlement,
          },
          reader: {
            cannotWriteMatches: !reader.can_insert_fixture && !reader.can_update_score && !reader.can_delete,
          },
          espn: {
            canUpdateLiveFields: !!(espn.can_link_espn && espn.can_update_home_score && espn.can_update_away_score),
            cannotUpdateScheduleOrSettlement: !espn.can_update_team &&
              !espn.can_update_kickoff && !espn.can_update_settlement,
            cannotInsertOrDelete: !espn.can_insert && !espn.can_delete,
          },
        };
      });
      return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code) : '';
      const name = error && typeof error === 'object' && 'name' in error
        ? String((error as { name?: unknown }).name) : 'unknown';
      return Response.json({
        ok: false, error: 'role_hardening_failed',
        sqlState: /^[A-Z0-9]{5}$/.test(code) ? code : 'none',
        errorName: /^[A-Za-z0-9_]{1,40}$/.test(name) ? name : 'unknown',
      }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    } finally {
      try { await sql.end(); } catch { /* preserve sanitized result */ }
    }
  },
};
