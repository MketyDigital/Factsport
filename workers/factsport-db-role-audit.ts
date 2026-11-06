import postgres from 'postgres';

interface Env {
  FACTSPORT_HYPERDRIVE: { connectionString: string };
  FACTSPORT_AUDIT_TOKEN?: string;
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
    if (request.method !== 'GET' || new URL(request.url).pathname !== '/__internal/db-role-audit') {
      return new Response('Not found', { status: 404 });
    }
    const auth = request.headers.get('Authorization') || '';
    const provided = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!(await tokenMatches(env.FACTSPORT_AUDIT_TOKEN || '', provided))) {
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
      const [identity] = await sql`
        SELECT current_database() AS database, current_user AS connected_as
      `;
      if (identity.database !== 'factsport_v2' || identity.connected_as !== 'mketydbadmin') {
        return Response.json({ ok: false, error: 'unexpected_database_identity' }, {
          status: 503, headers: { 'Cache-Control': 'no-store' },
        });
      }
      const roles = await sql`
        SELECT rolname AS role_name, rolcanlogin AS can_login,
          rolsuper AS is_superuser, rolinherit AS inherits_roles,
          rolcreaterole AS can_create_roles, rolcreatedb AS can_create_databases,
          rolreplication AS can_replicate, rolbypassrls AS bypasses_rls,
          rolconnlimit AS connection_limit
        FROM pg_roles
        WHERE rolname IN (
          'factsport_v2_reader',
          'factsport_v2_schedule_writer',
          'factsport_v2_espn_writer'
        )
        ORDER BY rolname
      `;
      const tablePrivileges = await sql`
        WITH role_names(role_name) AS (
          VALUES ('factsport_v2_reader'), ('factsport_v2_schedule_writer'),
                 ('factsport_v2_espn_writer')
        ), table_names(table_name) AS (
          VALUES ('matches'), ('app_users'), ('external_identities'), ('job_runs')
        ), privilege_names(privilege_name) AS (
          VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
                 ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')
        )
        SELECT role_names.role_name, table_names.table_name,
          privilege_names.privilege_name,
          has_table_privilege(role_names.role_name::name,
            'public.' || table_names.table_name, privilege_names.privilege_name) AS allowed
        FROM role_names CROSS JOIN table_names CROSS JOIN privilege_names
        ORDER BY role_names.role_name, table_names.table_name, privilege_names.privilege_name
      `;
      return Response.json({
        ok: roles.length === 3,
        roleCount: roles.length,
        tablePrivilegeCount: tablePrivileges.length,
        database: identity.database,
        connectedAs: identity.connected_as,
        roles, tablePrivileges,
      }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code) : '';
      const name = error && typeof error === 'object' && 'name' in error
        ? String((error as { name?: unknown }).name) : 'unknown';
      return Response.json({
        ok: false, error: 'db_role_audit_query_failed',
        sqlState: /^[A-Z0-9]{5}$/.test(code) ? code : 'none',
        errorName: /^[A-Za-z0-9_]{1,40}$/.test(name) ? name : 'unknown',
      }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    } finally {
      try { await sql.end(); } catch { /* preserve the sanitized audit result */ }
    }
  },
};
