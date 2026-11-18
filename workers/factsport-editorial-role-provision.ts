import postgres from 'postgres';

interface Env {
  FACTSPORT_HYPERDRIVE: { connectionString: string };
  FACTSPORT_PROVISION_TOKEN?: string;
  FACTSPORT_EDITORIAL_PASSWORD?: string;
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
        new URL(request.url).pathname !== '/__internal/provision-editorial-login') {
      return new Response('Not found', { status: 404 });
    }
    const auth = request.headers.get('Authorization') || '';
    if (!(await tokenMatches(
      env.FACTSPORT_PROVISION_TOKEN || '',
      auth.startsWith('Bearer ') ? auth.slice(7) : '',
    ))) return new Response('Not found', { status: 404 });

    const password = env.FACTSPORT_EDITORIAL_PASSWORD || '';
    if (!/^[a-f0-9]{64}$/.test(password)) {
      return Response.json({ ok: false, error: 'invalid_generated_credential' }, { status: 503 });
    }
    const connectionString = env.FACTSPORT_HYPERDRIVE?.connectionString;
    if (!connectionString) {
      return Response.json({ ok: false, error: 'hyperdrive_missing' }, { status: 503 });
    }

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
        FROM pg_roles WHERE rolname = 'factsport_v2_editorial_writer'
      `;
      if (!capability || capability.rolsuper || capability.rolcanlogin ||
          capability.rolinherit || capability.rolcreaterole || capability.rolcreatedb ||
          capability.rolreplication || capability.rolbypassrls) {
        return Response.json({ ok: false, error: 'editorial_capability_role_drift' }, { status: 409 });
      }
      const membershipDrift = await sql`
        SELECT granted.rolname AS member_of
        FROM pg_auth_members membership
        JOIN pg_roles member ON member.oid = membership.member
        JOIN pg_roles granted ON granted.oid = membership.roleid
        WHERE member.rolname = 'factsport_v2_editorial_app'
          AND granted.rolname <> 'factsport_v2_editorial_writer'
      `;
      if (membershipDrift.length) {
        return Response.json({ ok: false, error: 'editorial_login_membership_drift' }, { status: 409 });
      }

      const provisionSql = `DO $provision$
      DECLARE password_value text := '${password}';
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'factsport_v2_editorial_app') THEN
          EXECUTE format(
            'CREATE ROLE %I WITH LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 5 PASSWORD %L',
            'factsport_v2_editorial_app', password_value
          );
        ELSE
          EXECUTE format(
            'ALTER ROLE %I WITH LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 5 PASSWORD %L',
            'factsport_v2_editorial_app', password_value
          );
        END IF;
        GRANT factsport_v2_editorial_writer TO factsport_v2_editorial_app;
      END
      $provision$;`;
      await sql.unsafe(provisionSql);

      const [result] = await sql`
        SELECT login.rolcanlogin AS can_login,
          login.rolsuper AS is_superuser,
          login.rolcreaterole AS can_create_roles,
          login.rolcreatedb AS can_create_databases,
          login.rolreplication AS can_replicate,
          login.rolbypassrls AS bypasses_rls,
          login.rolinherit AS inherits_roles,
          login.rolconnlimit AS connection_limit,
          pg_has_role(login.oid, capability.oid, 'USAGE') AS inherits_editorial_capability,
          has_column_privilege(login.rolname, 'public.external_identities', 'issuer', 'SELECT')
            AND has_column_privilege(login.rolname, 'public.external_identities', 'subject', 'SELECT')
            AND has_column_privilege(login.rolname, 'public.external_identities', 'user_id', 'SELECT')
            AS can_read_identity_mapping,
          has_table_privilege(login.rolname, 'public.media_editorial_memberships', 'SELECT')
            AS can_read_editorial_memberships,
          has_schema_privilege(login.rolname, 'public', 'CREATE') AS can_create_in_public,
          has_database_privilege(login.rolname, current_database(), 'TEMP') AS can_create_temp
        FROM pg_roles login
        JOIN pg_roles capability ON capability.rolname = 'factsport_v2_editorial_writer'
        WHERE login.rolname = 'factsport_v2_editorial_app'
      `;
      const ok = result?.can_login === true && result.is_superuser === false &&
        result.can_create_roles === false && result.can_create_databases === false &&
        result.can_replicate === false && result.bypasses_rls === false &&
        result.inherits_roles === true && Number(result.connection_limit) === 5 &&
        result.inherits_editorial_capability === true &&
        result.can_read_identity_mapping === true &&
        result.can_read_editorial_memberships === true &&
        result.can_create_in_public === false && result.can_create_temp === false;
      if (!ok) {
        return Response.json({ ok: false, error: 'editorial_login_privilege_check_failed' }, { status: 503 });
      }
      return Response.json({
        ok: true, database: identity.database, capabilityRole: 'factsport_v2_editorial_writer',
        loginRole: 'factsport_v2_editorial_app', leastPrivilege: true,
        canLogin: result.can_login, canCreateRoles: result.can_create_roles,
        canCreateDatabases: result.can_create_databases, canReplicate: result.can_replicate,
        bypassesRls: result.bypasses_rls, inheritsRoles: result.inherits_roles,
        connectionLimit: result.connection_limit, canCreateInPublic: result.can_create_in_public,
        canCreateTemp: result.can_create_temp,
      }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code) : '';
      return Response.json({
        ok: false, error: 'editorial_login_provision_failed',
        sqlState: /^[A-Z0-9]{5}$/.test(code) ? code : 'none',
      }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    } finally {
      try { await sql.end(); } catch { /* preserve sanitized result */ }
    }
  },
};
