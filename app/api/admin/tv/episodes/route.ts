import { NextResponse } from 'next/server';
import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/** Private TV Studio episode inventory. No match-feed or publishing side effect. */
export async function GET() {
  const authorization = await authorizeMediaEditorialAction('tv');
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, {
      status: authorization.status,
      headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' },
    });
  }

  try {
    const episodes = await withFactsportEditorialPostgres(sql => sql`
      SELECT id, show_format, match_id, revision, source_digest, status, title,
             duration_seconds, created_at, updated_at
      FROM public.factsport_tv_episodes
      ORDER BY updated_at DESC, id DESC
      LIMIT 100
    `);
    return NextResponse.json({ success: true, episodes }, {
      headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' },
    });
  } catch (error) {
    console.error('Factsport TV episode inventory unavailable', error);
    return NextResponse.json({ error: 'TV Studio episode inventory is not connected.' }, {
      status: 503,
      headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' },
    });
  }
}
