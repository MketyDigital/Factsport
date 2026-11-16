import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import { validCommunityMatchId } from '@/lib/adapters/postgres-community';
import { ensureAnonymousMediaSession } from '@/lib/media/anonymous-community-visitor';
import { withFactsportCommunityPostgres } from '@/lib/adapters/postgres-client';
export const runtime = 'edge';
export const dynamic = 'force-dynamic';
const HEADERS = { 'Cache-Control': 'private, no-store' };
export async function GET(request: Request) {
  if ((env.FACTSPORT_MEDIA_COMMUNITY_BACKEND ?? process.env.FACTSPORT_MEDIA_COMMUNITY_BACKEND) !== 'postgres' ||
      env.FACTSPORT_MEDIA_COMMUNITY_WRITES !== 'enabled') {
    return NextResponse.json({ error: 'Media ratings not enabled.' }, { status: 503, headers: HEADERS });
  }
  const matchId = new URL(request.url).searchParams.get('matchId');
  if (!validCommunityMatchId(matchId)) return NextResponse.json({ error: 'Invalid match.' }, { status: 400, headers: HEADERS });
  try {
    const visitor = await ensureAnonymousMediaSession(request);
    const rows = await withFactsportCommunityPostgres(sql => sql`
      SELECT player_name, rating FROM public.get_anonymous_media_player_ratings(
        ${visitor.tokenHash}, ${matchId}::uuid
      )
    `);
    const ratings: Record<string, number> = {};
    for (const row of rows) if (typeof row.player_name === 'string' && Number.isInteger(row.rating)) {
      ratings[row.player_name] = row.rating;
    }
    const response = NextResponse.json({ ratings }, { headers: HEADERS });
    if (visitor.setCookie) response.headers.append('Set-Cookie', visitor.setCookie);
    return response;
  } catch {
    return NextResponse.json({ error: 'Guest ratings state unavailable.' }, { status: 503, headers: HEADERS });
  }
}
