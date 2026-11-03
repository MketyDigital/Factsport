/**
 * Ephemeral migration Worker. GitHub Actions deletes it after the authorized migration.
 * Requires one-time FACTSPORT_BOOTSTRAP_TOKEN deployed as a Worker secret.
 * No read/write SQL is accepted over HTTP; only reviewed checked-in migration SQL.
 */
import postgres from 'postgres';
import { factsportMigrationStatements } from './generated-factsport-migration';

interface Env {
  FACTSPORT_HYPERDRIVE: { connectionString: string };
  FACTSPORT_BOOTSTRAP_TOKEN?: string;
}

async function validToken(expected: string, supplied: string): Promise<boolean> {
  if (!expected || !supplied || expected.length > 4096 || supplied.length > 4096) return false;
  const e = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', e.encode(expected)),
    crypto.subtle.digest('SHA-256', e.encode(supplied)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let mismatch = 0;
  for (let i = 0; i < x.length; i++) mismatch |= x[i] ^ y[i];
  return mismatch === 0;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname !== '/__internal/factsport-schema-bootstrap' || request.method !== 'POST') {
      return new Response('Not found', { status: 404 });
    }
    const auth = request.headers.get('Authorization') || '';
    if (!(await validToken(env.FACTSPORT_BOOTSTRAP_TOKEN || '',
      auth.startsWith('Bearer ') ? auth.slice(7) : ''))) {
      return new Response('Not found', { status: 404 });
    }
    const sql = postgres(env.FACTSPORT_HYPERDRIVE.connectionString, {
      max: 1, fetch_types: false, prepare: true, connect_timeout: 10, idle_timeout: 5,
    });
    try {
      const result = await sql.begin(async (tx) => {
        const [database] = await tx`SELECT current_database() AS name`;
        if (database.name !== 'factsport_v2') throw new Error('Wrong database');
        await tx`SELECT pg_advisory_xact_lock(720061, 2)`;
        for (const statement of factsportMigrationStatements) {
          await tx.unsafe(statement);
        }
        const [count] = await tx`
          SELECT count(*)::integer AS present
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name IN ('matches', 'app_users', 'external_identities', 'job_runs')
        `;
        return Number(count.present);
      });
      return Response.json({ ok: result === 4, tablesPresent: result },
        { status: result === 4 ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
    } catch {
      return Response.json({ ok: false, error: 'factsport_schema_bootstrap_failed' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } });
    } finally {
      await sql.end();
    }
  },
};
