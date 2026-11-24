import { NextResponse } from 'next/server';
import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/** Bounded final-match picker for the private TV editor; no upstream calls. */
export async function GET() {
  const authorization = await authorizeMediaEditorialAction('tv');
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, {
      status: authorization.status,
      headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' },
    });
  }

  try {
    const matches = await withFactsportEditorialPostgres(sql => sql`
      SELECT id, league, home_team, away_team, home_score, away_score,
             status, match_date, source, source_updated_at, version
      FROM public.matches
      WHERE upper(status) IN ('FT', 'FINISHED', 'AET', 'PEN')
        AND home_score IS NOT NULL AND away_score IS NOT NULL
        AND home_score >= 0 AND away_score >= 0
      ORDER BY match_date DESC, id DESC
      LIMIT 50
    `);
    return NextResponse.json({ success: true, matches }, {
      headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' },
    });
  } catch (error) {
    console.error('Factsport TV match picker unavailable', error);
    return NextResponse.json({ error: 'TV Studio match picker is not connected.' }, {
      status: 503,
      headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' },
    });
  }
}
