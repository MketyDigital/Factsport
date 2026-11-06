import postgres from 'postgres';

interface Env {
  FACTSPORT_HYPERDRIVE: { connectionString: string };
  FACTSPORT_BOOTSTRAP_TOKEN?: string;
  FACTSPORT_READER_PASSWORD?: string;
}

async function matches(expected: string, actual: string) {
  if (!expected || !actual || expected.length > 4096 || actual.length > 4096) return false;
  const enc = new TextEncoder();
  const [l, r] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(expected)),
    crypto.subtle.digest('SHA-256', enc.encode(actual)),
  ]);
  const a = new Uint8Array(l), b = new Uint8Array(r);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

export default {
  async fetch(request: Request, env: Env) {
    if (new URL(request.url).pathname !== '/__internal/create-factsport-reader' ||
        request.method !== 'POST') return new Response('Not found', { status: 404 });
    const provided = request.headers.get('Authorization')?.replace(/^Bearer /, '') || '';
    if (!(await matches(env.FACTSPORT_BOOTSTRAP_TOKEN || '', provided))) {
      return new Response('Not found', { status: 404 });
    }
    const password = env.FACTSPORT_READER_PASSWORD || '';
    if (!/^[a-f0-9]{64}$/.test(password)) {
      return Response.json({ ok: false, error: 'invalid_secret_format' }, { status: 503 });
    }
    const sql = postgres(env.FACTSPORT_HYPERDRIVE.connectionString, {
      max: 1, fetch_types: false, prepare: true, connect_timeout: 10, idle_timeout: 5,
    });
    try {
      const result = await sql.begin(async (tx) => {
        const [details] = await tx`
          SELECT current_database() AS database, current_user AS username
        `;
        if (details.database !== 'factsport_v2' || details.username !== 'mketydbadmin') {
          throw new Error('Wrong database or bootstrap administrator');
        }
        await tx`SELECT pg_advisory_xact_lock(720061, 3)`;
        // The only dynamic part is a generated, strictly validated 64-digit hex
        // password; all SQL identifiers and role names are fixed Factsport literals.
        await tx.unsafe(`DO $body$
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'factsport_v2_reader') THEN
              CREATE ROLE factsport_v2_reader LOGIN PASSWORD '${password}' NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 5;
            ELSE
              ALTER ROLE factsport_v2_reader LOGIN PASSWORD '${password}' NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 5;
            END IF;
          END
        $body$`);
        await tx`GRANT CONNECT ON DATABASE factsport_v2 TO factsport_v2_reader`;
        await tx`GRANT USAGE ON SCHEMA public TO factsport_v2_reader`;
        await tx`REVOKE ALL ON TABLE public.matches FROM factsport_v2_reader`;
        await tx`REVOKE ALL ON TABLE public.matches FROM PUBLIC, factsport_v2_reader`;
        await tx`GRANT SELECT ON TABLE public.matches TO factsport_v2_reader`;
        await tx`REVOKE ALL ON TABLE public.app_users, public.external_identities, public.job_runs FROM PUBLIC, factsport_v2_reader`;
        const [check] = await tx`
          SELECT
            has_table_privilege('factsport_v2_reader','public.matches','SELECT') AS can_read_matches,
            has_table_privilege('factsport_v2_reader','public.matches','INSERT') AS can_insert_matches,
            has_table_privilege('factsport_v2_reader','public.matches','UPDATE') AS can_update_matches,
            has_table_privilege('factsport_v2_reader','public.matches','DELETE') AS can_delete_matches,
            (SELECT rolinherit FROM pg_roles WHERE rolname='factsport_v2_reader') AS inherits_roles,
            (SELECT rolconnlimit FROM pg_roles WHERE rolname='factsport_v2_reader') AS connection_limit,
            has_table_privilege('factsport_v2_reader','public.app_users','SELECT') AS can_read_users
        `;
        if (!check.can_read_matches || check.can_insert_matches || check.can_update_matches ||
            check.can_delete_matches || check.inherits_roles || Number(check.connection_limit) !== 5 ||
            check.can_read_users) {
          throw new Error('Unexpected role privileges');
        }
        return true;
      });
      return Response.json({ ok: result, role: 'factsport_v2_reader', leastPrivilege: result },
        { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      const c = (error && typeof error === 'object' && 'code' in error) ?
        String((error as { code?: unknown }).code) : '';
      return Response.json({
        ok: false,
        error: 'role_bootstrap_failed',
        sqlState: /^[A-Z0-9]{5}$/.test(c) ? c : 'none',
      }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    } finally {
      await sql.end();
    }
  },
};
