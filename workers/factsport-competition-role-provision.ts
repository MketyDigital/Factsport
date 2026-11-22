import postgres from 'postgres';

interface Env {
  FACTSPORT_HYPERDRIVE: { connectionString: string };
  FACTSPORT_PROVISION_TOKEN?: string;
  FACTSPORT_COMPETITION_PASSWORD?: string;
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
        new URL(request.url).pathname !== '/__internal/provision-competition-login') {
      return new Response('Not found', { status: 404 });
    }
    const auth = request.headers.get('Authorization') || '';
    if (!(await tokenMatches(env.FACTSPORT_PROVISION_TOKEN || '',
      auth.startsWith('Bearer ') ? auth.slice(7) : ''))) {
      return new Response('Not found', { status: 404 });
    }
    const password = env.FACTSPORT_COMPETITION_PASSWORD || '';
    if (!/^[a-f0-9]{64}$/.test(password)) {
      return Response.json({ ok: false, error: 'invalid_generated_credential' }, { status: 503 });
    }
    const connectionString = env.FACTSPORT_HYPERDRIVE?.connectionString;
    if (!connectionString) return Response.json({ ok: false, error: 'hyperdrive_missing' }, { status: 503 });
    const sql = postgres(connectionString, {
      max: 1, fetch_types: false, prepare: false, connect_timeout: 10, idle_timeout: 5,
    });
    try {
      const [identity] = await sql`
        SELECT current_database() AS database, current_user AS connected_as
      `;
      if (identity.database !== 'factsport_v2' || identity.connected_as !== 'mketydbadmin') {
        return Response.json({ ok: false, error: 'unexpected_database_identity' }, { status: 503 });
      }
      const [capability] = await sql`
        SELECT rolsuper, rolcanlogin, rolinherit, rolcreaterole, rolcreatedb,
          rolreplication, rolbypassrls
        FROM pg_roles WHERE rolname = 'factsport_v2_competition_writer'
      `;
      if (!capability || capability.rolsuper || capability.rolcanlogin ||
          capability.rolinherit || capability.rolcreaterole || capability.rolcreatedb ||
          capability.rolreplication || capability.rolbypassrls) {
        return Response.json({ ok: false, error: 'competition_capability_role_drift' }, { status: 409 });
      }

      const [existing] = await sql`
        SELECT rolcanlogin, rolsuper, rolinherit, rolcreaterole, rolcreatedb,
          rolreplication, rolbypassrls, rolconnlimit
        FROM pg_roles WHERE rolname = 'factsport_v2_competition_app'
      `;
      if (existing && (existing.rolsuper || existing.rolcreaterole || existing.rolcreatedb ||
          existing.rolreplication || existing.rolbypassrls || !existing.rolcanlogin)) {
        return Response.json({ ok: false, error: 'competition_login_role_drift' }, { status: 409 });
      }
      const memberOf = await sql`
        SELECT granted.rolname AS role_name
        FROM pg_auth_members membership
        JOIN pg_roles member ON member.oid = membership.member
        JOIN pg_roles granted ON granted.oid = membership.roleid
        WHERE member.rolname = 'factsport_v2_competition_app'
      `;
      if (memberOf.some(row => row.role_name !== 'factsport_v2_competition_writer')) {
        return Response.json({ ok: false, error: 'competition_login_membership_drift' }, { status: 409 });
      }

      // This random password exists only in this one-run provisioner and the
      // dedicated Cloudflare Hyperdrive created immediately afterward.
      await sql.unsafe(`DO $provision$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'factsport_v2_competition_app') THEN
          EXECUTE format(
            'CREATE ROLE %I WITH LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 3 PASSWORD %L',
            'factsport_v2_competition_app', '${password}'
          );
        ELSE
          -- Preserve the password already stored in the dedicated Hyperdrive.
          EXECUTE format(
            'ALTER ROLE %I WITH LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 3',
            'factsport_v2_competition_app'
          );
        END IF;
        GRANT factsport_v2_competition_writer TO factsport_v2_competition_app;
        GRANT SELECT ON public.public_competition_standings,
          public.public_competition_player_stats TO factsport_v2_competition_writer;
      END
      $provision$;`);

      const [result] = await sql`
        SELECT login.rolcanlogin AS can_login, login.rolsuper AS is_superuser,
          login.rolcreaterole AS can_create_roles, login.rolcreatedb AS can_create_databases,
          login.rolreplication AS can_replicate, login.rolbypassrls AS bypasses_rls,
          login.rolinherit AS inherits_roles, login.rolconnlimit AS connection_limit,
          pg_has_role(login.oid, capability.oid, 'USAGE') AS inherits_writer,
          has_table_privilege(login.rolname, 'public.competition_standings', 'INSERT,UPDATE') AS can_write_standings,
          has_table_privilege(login.rolname, 'public.competition_player_stats', 'INSERT,UPDATE') AS can_write_scorers,
          has_table_privilege(login.rolname, 'public.public_competition_standings', 'SELECT') AS can_read_standings_inventory,
          has_table_privilege(login.rolname, 'public.public_competition_player_stats', 'SELECT') AS can_read_scorer_inventory,
          has_table_privilege(login.rolname, 'public.matches', 'UPDATE') AS can_update_matches,
          has_table_privilege(login.rolname, 'public.matches', 'DELETE') AS can_delete_matches,
          has_schema_privilege(login.rolname, 'public', 'CREATE') AS can_create_in_public,
          has_database_privilege(login.rolname, current_database(), 'TEMP') AS can_create_temp
        FROM pg_roles login
        JOIN pg_roles capability ON capability.rolname = 'factsport_v2_competition_writer'
        WHERE login.rolname = 'factsport_v2_competition_app'
      `;
      const ok = result?.can_login === true && result.is_superuser === false &&
        result.can_create_roles === false && result.can_create_databases === false &&
        result.can_replicate === false && result.bypasses_rls === false &&
        result.inherits_roles === true && Number(result.connection_limit) === 3 &&
        result.inherits_writer === true && result.can_write_standings === true &&
        result.can_write_scorers === true && result.can_read_standings_inventory === true &&
        result.can_read_scorer_inventory === true && result.can_update_matches === false &&
        result.can_delete_matches === false && result.can_create_in_public === false &&
        result.can_create_temp === false;
      if (!ok) return Response.json({ ok: false, error: 'competition_login_privilege_check_failed' }, { status: 503 });
      return Response.json({
        ok: true, database: identity.database,
        capabilityRole: 'factsport_v2_competition_writer',
        loginRole: 'factsport_v2_competition_app', leastPrivilege: true,
        canUpdateMatches: result.can_update_matches, canDeleteMatches: result.can_delete_matches,
        connectionLimit: result.connection_limit,
      }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code) : '';
      return Response.json({
        ok: false, error: 'competition_login_provision_failed',
        sqlState: /^[A-Z0-9]{5}$/.test(code) ? code : 'none',
      }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    } finally {
      try { await sql.end(); } catch { /* retain sanitized response */ }
    }
  },
};
