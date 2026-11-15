import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import { listPostgresLiveScoreSnapshot } from '@/lib/adapters/postgres-matches';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const unavailable = () => NextResponse.json(
  { error: 'Live score snapshot is not enabled.' },
  { status: 503, headers: { 'Cache-Control': 'no-store' } },
);

/**
 * Read-only public projection of the database already updated by the external
 * fast live worker. Never poll upstream providers or accept client writes here.
 */
export async function GET() {
  if ((env.FACTSPORT_MATCHES_BACKEND ?? process.env.FACTSPORT_MATCHES_BACKEND) !== 'postgres') {
    return unavailable();
  }
  try {
    const rows = await listPostgresLiveScoreSnapshot();
    return NextResponse.json(
      { matches: rows, refreshedAt: new Date().toISOString() },
      { headers: {
        'Cache-Control': env.FACTSPORT_ENVIRONMENT === 'staging'
          ? 'private, no-store, max-age=0'
          : 'public, max-age=0, s-maxage=10, stale-while-revalidate=5',
      } },
    );
  } catch {
    return NextResponse.json(
      { error: 'Live scores temporarily unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
