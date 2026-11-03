/**
 * Dedicated, read-only, authenticated staging connectivity check.
 * Does not replace the Factsport Next.js/vinext application entrypoint.
 * FACTSPORT_SMOKE_TOKEN is generated per GitHub Actions deployment and securely
 * uploaded to Wrangler; no extra GitHub secret is required.
 */
import postgres from 'postgres';

interface Env {
  FACTSPORT_HYPERDRIVE: { connectionString: string };
  FACTSPORT_MEDIA_BUCKET: { head(key: string): Promise<unknown | null> };
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
    if (!['/__internal/db-smoke', '/__internal/r2-smoke'].includes(url.pathname) || request.method !== 'GET') {
      return new Response('Not found', { status: 404 });
    }
    const authorization = request.headers.get('Authorization') || '';
    const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!(await tokenMatches(env.FACTSPORT_SMOKE_TOKEN || '', supplied))) {
      return new Response('Not found', { status: 404 });
    }
    if (url.pathname === '/__internal/r2-smoke') {
      try {
        const found = await env.FACTSPORT_MEDIA_BUCKET.head('__factsport_v2_probe_absent__');
        return Response.json({ ok: true, bound: true, probeObjectExists: !!found },
          { headers: { 'Cache-Control': 'no-store' } });
      } catch {
        return Response.json({ ok: false, error: 'r2_binding_failed' },
          { status: 503, headers: { 'Cache-Control': 'no-store' } });
      }
    }
    const sql = postgres(env.FACTSPORT_HYPERDRIVE.connectionString, {
      max: 1,
      fetch_types: false,
      prepare: true,
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
