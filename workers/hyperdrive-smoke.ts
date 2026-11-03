/**
 * Dedicated, read-only, authenticated staging connectivity check.
 * Does not replace the Factsport Next.js/vinext application entrypoint.
 * Set FACTSPORT_SMOKE_TOKEN using Wrangler secret; do not store it in git.
 */
import postgres from 'postgres';

interface Env {
  HYPERDRIVE: { connectionString: string };
  FACTSPORT_SMOKE_TOKEN?: string;
}

async function tokenMatches(expected: string, provided: string): Promise<boolean> {
  if (!expected || !provided || expected.length > 4096 || provided.length > 4096) return false;
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
  ]);
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  let delta = 0;
  for (let i = 0; i < left.length; i++) delta |= left[i] ^ right[i];
  return delta === 0;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/__internal/db-smoke' || request.method !== 'GET') {
      return new Response('Not found', { status: 404 });
    }
    const authorization = request.headers.get('Authorization') || '';
    const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!(await tokenMatches(env.FACTSPORT_SMOKE_TOKEN || '', supplied))) {
      return new Response('Not found', { status: 404 });
    }
    const sql = postgres(env.HYPERDRIVE.connectionString, {
      max: 1,
      prepare: false,
      connect_timeout: 10,
      idle_timeout: 5,
    });
    try {
      const [status] = await sql`
        SELECT current_database() AS database,
               to_regclass('public.matches') IS NOT NULL AS matches_table_ready
      `;
      return Response.json({
        ok: status.database === 'factsport_v2',
        database: status.database === 'factsport_v2' ? 'factsport_v2' : 'unexpected',
        matchesTableReady: status.matches_table_ready,
      }, { status: status.database === 'factsport_v2' ? 200 : 503,
           headers: { 'Cache-Control': 'no-store' } });
    } catch {
      // Never include driver errors or connection strings in a public response.
      return Response.json({ ok: false, error: 'database_connection_failed' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } });
    } finally {
      await sql.end();
    }
  },
};
