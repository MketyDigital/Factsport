import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import { listPostgresPublicChatMessages, validCommunityMatchId } from '@/lib/adapters/postgres-community';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'no-store' };

/**
 * Legacy chat D1 Worker is archived for reference only.
 * Runtime requires isolated Factsport PostgreSQL migration 0044 and reader grants.
 */
export async function GET(request: Request) {
  if ((env.FACTSPORT_MEDIA_COMMUNITY_BACKEND ?? process.env.FACTSPORT_MEDIA_COMMUNITY_BACKEND) !== 'postgres') {
    return NextResponse.json({ error: 'Media community is not yet enabled.' }, { status: 503, headers });
  }
  const matchId = new URL(request.url).searchParams.get('match_id');
  if (!validCommunityMatchId(matchId)) {
    return NextResponse.json({ error: 'Invalid match identifier.' }, { status: 400, headers });
  }
  try {
    const rows = await listPostgresPublicChatMessages(matchId);
    return NextResponse.json({ messages: rows }, { headers });
  } catch {
    return NextResponse.json({ error: 'Media community temporarily unavailable.' }, { status: 503, headers });
  }
}

// No community writes until V2 authenticated identity, moderation, rate limits,
// candidate eligibility and atomic vote uniqueness are verified in staging.
export async function POST() {
  return NextResponse.json(
    { error: 'Media community submission is not yet enabled.' },
    { status: 503, headers },
  );
}
