import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import { validCommunityMatchId } from '@/lib/adapters/postgres-community';
import { ensureAnonymousMediaSession } from '@/lib/media/anonymous-community-visitor';
import { withFactsportCommunityPostgres } from '@/lib/adapters/postgres-client';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const HEADERS = { 'Cache-Control': 'private, no-store' };

/** Voter state is tied to an HttpOnly Media cookie, never Prediction identity. */
export async function GET(request: Request) {
  if ((env.FACTSPORT_MEDIA_COMMUNITY_BACKEND ?? process.env.FACTSPORT_MEDIA_COMMUNITY_BACKEND) !== 'postgres' ||
      env.FACTSPORT_MEDIA_COMMUNITY_WRITES !== 'enabled') {
    return NextResponse.json({ error: 'Media voting not enabled.' }, { status: 503, headers: HEADERS });
  }
  const matchId = new URL(request.url).searchParams.get('matchId');
  if (!validCommunityMatchId(matchId)) {
    return NextResponse.json({ error: 'Invalid match.' }, { status: 400, headers: HEADERS });
  }
  try {
    // Establish the guest identity before enabling the vote button.
    const visitor = await ensureAnonymousMediaSession(request);
    const rows = await withFactsportCommunityPostgres(sql => sql`
      SELECT public.get_anonymous_media_vote_state(${visitor.tokenHash}, ${matchId}::uuid) AS has_voted
    `);
    const response = NextResponse.json({ hasVoted: rows[0]?.has_voted === true }, { headers: HEADERS });
    if (visitor.setCookie) response.headers.append('Set-Cookie', visitor.setCookie);
    return response;
  } catch {
    return NextResponse.json({ error: 'Voting state unavailable.' }, { status: 503, headers: HEADERS });
  }
}
