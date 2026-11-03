import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import { factsportPostgres, factsportMediaBucket } from '@/lib/adapters/factsport-cloudflare-bindings';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * Protected by middleware's Factsport staging gate. This endpoint does not
 * expose database credentials, R2 object contents, or operational internals.
 */
export async function GET() {
  if (env.FACTSPORT_ENVIRONMENT !== 'staging') {
    return new NextResponse('Not found', { status: 404 });
  }
  const sql = factsportPostgres();
  try {
    const [database] = await sql`
      SELECT current_database() = 'factsport_v2' AS correct_database,
             to_regclass('public.matches') IS NOT NULL AS matches_table_ready
    `;
    const bucket = factsportMediaBucket();
    await bucket.head('__factsport_v2_healthcheck_absent__');
    const ok = database.correct_database === true && database.matches_table_ready === true;
    return NextResponse.json({ ok, databaseReady: ok, mediaBucketReady: true },
      { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'factsport_staging_dependency_unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } });
  } finally {
    await sql.end();
  }
}
