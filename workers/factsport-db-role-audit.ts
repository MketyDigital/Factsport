import postgres from 'postgres';

interface Env {
  FACTSPORT_HYPERDRIVE: { connectionString: string };
  FACTSPORT_AUDIT_TOKEN?: string;
}

const ROLES = [
  'factsport_v2_reader',
  'factsport_v2_schedule_writer',
  'factsport_v2_espn_writer',
] as const;
const TABLES = ['matches', 'app_users', 'external_identities', 'job_runs'] as const;
const TABLE_PRIVILEGES = [
  'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER',
] as const;

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
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.pathname !== '/__internal/db-role-audit') {
      return new Response('Not found', { status: 404 });
    }
    const auth = request.headers.get('Authorization') || '';
    const provided = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!(await tokenMatches(env.FACTSPORT_AUDIT_TOKEN || '', provided))) {
      return new Response('Not found', { status: 404 });
    }
    if (!env.FACTSPORT_HYPERDRIVE?.connectionString) {
      return Response.json({ ok: false, error: 'hyperdrive_missing' }, { status: 503 });
    }

    const sql = postgres(env.FACTSPORT_HYPERDRIVE.connectionString, {
      max: 1, fetch_types: false, prepare: true, connect_timeout: 10, idle_timeout: 5,
    });
    let auditPhase = 'identity';
    try {
      const [identity] = await sql`
        SELECT current_database() AS database, current_user AS role
      `;
      if (identity.database !== 'factsport_v2' || identity.role !== 'mketydbadmin') {
        return Response.json({ ok: false, error: 'unexpected_database_identity' }, {
          status: 503, headers: { 'Cache-Control': 'no-store' },
        });
      }

      auditPhase = 'roles';
      const roles = await sql`
        SELECT rolname AS role_name, rolcanlogin AS can_login,
          rolsuper AS is_superuser, rolinherit AS inherits_roles,
          rolcreaterole AS can_create_roles, rolcreatedb AS can_create_databases,
          rolreplication AS can_replicate, rolbypassrls AS bypasses_rls,
          rolconnlimit AS connection_limit
        FROM pg_roles
        WHERE rolname = ANY(${sql.array([...ROLES])})
        ORDER BY rolname
      `;

      auditPhase = 'table_privileges';
      const tablePrivileges = await sql`
        WITH roles(role_name) AS (
          VALUES ('factsport_v2_reader'), ('factsport_v2_schedule_writer'),
                 ('factsport_v2_espn_writer')
        ), tables(table_name) AS (
          VALUES ('matches'), ('app_users'), ('external_identities'), ('job_runs')
        ), privileges(privilege_name) AS (
          VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
                 ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')
        )
        SELECT roles.role_name, tables.table_name, privileges.privilege_name,
          has_table_privilege(roles.role_name,
            'public.' || tables.table_name, privileges.privilege_name) AS allowed
        FROM roles CROSS JOIN tables CROSS JOIN privileges
        ORDER BY roles.role_name, tables.table_name, privileges.privilege_name
      `;

      auditPhase = 'match_column_privileges';
      const matchColumnPrivileges = await sql`
        WITH roles(role_name) AS (
          VALUES ('factsport_v2_reader'), ('factsport_v2_schedule_writer'),
                 ('factsport_v2_espn_writer')
        ), columns AS (
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'matches'
        )
        SELECT roles.role_name, columns.column_name,
          has_column_privilege(roles.role_name, 'public.matches',
            columns.column_name, 'SELECT') AS can_select,
          has_column_privilege(roles.role_name, 'public.matches',
            columns.column_name, 'INSERT') AS can_insert,
          has_column_privilege(roles.role_name, 'public.matches',
            columns.column_name, 'UPDATE') AS can_update,
          has_column_privilege(roles.role_name, 'public.matches',
            columns.column_name, 'REFERENCES') AS can_reference
        FROM roles CROSS JOIN columns
        ORDER BY roles.role_name, columns.column_name
      `;

      auditPhase = 'memberships';
      const memberships = await sql`
        SELECT member.rolname AS role_name, granted.rolname AS member_of
        FROM pg_auth_members membership
        JOIN pg_roles member ON member.oid = membership.member
        JOIN pg_roles granted ON granted.oid = membership.roleid
        WHERE member.rolname = ANY(${sql.array([...ROLES])})
        ORDER BY member.rolname, granted.rolname
      `;

      auditPhase = 'database_schema_privileges';
      const databaseAndSchemaPrivileges = await sql`
        WITH roles(role_name) AS (
          VALUES ('factsport_v2_reader'), ('factsport_v2_schedule_writer'),
                 ('factsport_v2_espn_writer')
        )
        SELECT role_name,
          has_database_privilege(role_name, current_database(), 'CONNECT') AS can_connect,
          has_database_privilege(role_name, current_database(), 'CREATE') AS can_create_schema,
          has_database_privilege(role_name, current_database(), 'TEMP') AS can_create_temp,
          has_schema_privilege(role_name, 'public', 'USAGE') AS can_use_public_schema,
          has_schema_privilege(role_name, 'public', 'CREATE') AS can_create_in_public
        FROM roles ORDER BY role_name
      `;

      auditPhase = 'public_function_access';
      const publicFunctionAccess = await sql`
        WITH roles(role_name) AS (
          VALUES ('factsport_v2_reader'), ('factsport_v2_schedule_writer'),
                 ('factsport_v2_espn_writer')
        )
        SELECT roles.role_name, count(functions.oid)::integer AS executable_public_functions,
          coalesce(array_agg(functions.proname::text ORDER BY functions.proname::text)
            FILTER (WHERE functions.oid IS NOT NULL), ARRAY[]::text[]) AS function_names
        FROM roles
        LEFT JOIN pg_proc functions
          ON functions.pronamespace = 'public'::regnamespace
          AND has_function_privilege(roles.role_name, functions.oid, 'EXECUTE')
        GROUP BY roles.role_name
        ORDER BY roles.role_name
      `;

      auditPhase = 'public_sequence_access';
      const publicSequenceAccess = await sql`
        WITH roles(role_name) AS (
          VALUES ('factsport_v2_reader'), ('factsport_v2_schedule_writer'),
                 ('factsport_v2_espn_writer')
        )
        SELECT roles.role_name,
          coalesce(array_agg(sequences.sequence_name ORDER BY sequences.sequence_name)
            FILTER (WHERE sequences.sequence_name IS NOT NULL), ARRAY[]::text[]) AS usable_sequences
        FROM roles
        LEFT JOIN information_schema.sequences sequences
          ON sequences.sequence_schema = 'public'
          AND has_sequence_privilege(roles.role_name,
            'public.' || sequences.sequence_name, 'USAGE')
        GROUP BY roles.role_name
        ORDER BY roles.role_name
      `;

      auditPhase = 'owned_objects';
      const ownedObjects = await sql`
        WITH roles(role_name) AS (
          VALUES ('factsport_v2_reader'), ('factsport_v2_schedule_writer'),
                 ('factsport_v2_espn_writer')
        )
        SELECT roles.role_name,
          count(classes.oid)::integer AS owned_public_relations
        FROM roles
        LEFT JOIN pg_class classes
          ON classes.relnamespace = 'public'::regnamespace
          AND classes.relowner = (SELECT oid FROM pg_roles WHERE rolname = roles.role_name)
        GROUP BY roles.role_name
        ORDER BY roles.role_name
      `;

      return Response.json({
        ok: roles.length === ROLES.length,
        database: 'factsport_v2',
        connectedAs: 'mketydbadmin',
        roles, tablePrivileges, matchColumnPrivileges, memberships,
        databaseAndSchemaPrivileges, publicFunctionAccess,
        publicSequenceAccess, ownedObjects,
      }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code) : '';
      return Response.json({
        ok: false, error: 'db_role_audit_failed', auditPhase,
        sqlState: /^[A-Z0-9]{5}$/.test(code) ? code : 'none',
      }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    } finally {
      await sql.end();
    }
  },
};
