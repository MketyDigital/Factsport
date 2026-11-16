import { NextResponse } from 'next/server';
import { anonymousCommunityVisitor } from '@/lib/media/anonymous-community-visitor';
import { withFactsportCommunityPostgres } from '@/lib/adapters/postgres-client';
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

// No account, email or Prediction entitlement. A visitor receives an opaque,
// signed HttpOnly cookie; writes use a dedicated PostgreSQL role and stored
// functions with per-visitor uniqueness and network rate limits.
export async function POST(request: Request) {
  if ((env.FACTSPORT_MEDIA_COMMUNITY_BACKEND ?? process.env.FACTSPORT_MEDIA_COMMUNITY_BACKEND) !== 'postgres' ||
      env.FACTSPORT_MEDIA_COMMUNITY_WRITES !== 'enabled') {
    return NextResponse.json({ error: 'Media participation is not yet enabled.' }, { status: 503, headers });
  }
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > 4096) {
    return NextResponse.json({ error: 'Submission too large.' }, { status: 413, headers });
  }
  try {
    const visitor = await anonymousCommunityVisitor(request);
    const bodyText = await request.text();
    if (bodyText.length > 4096) {
      return NextResponse.json({ error: 'Submission too large.' }, { status: 413, headers });
    }
    const body = JSON.parse(bodyText);
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).some(key => !['match_id', 'message'].includes(key))) {
      return NextResponse.json({ error: 'Unexpected submission fields.' }, { status: 400, headers });
    }
    const matchId = body.match_id;
    const value = body.message;
    if (!validCommunityMatchId(matchId) || typeof value !== 'string' ||
        value.trim().length < 1 || value.trim().length > 200) {
      return NextResponse.json({ error: 'Invalid match or content.' }, { status: 400, headers });
    }
    const rows = await withFactsportCommunityPostgres(sql => sql`
      SELECT public.submit_anonymous_media_chat(
        ${visitor.tokenHash}, ${visitor.networkHash},
        ${matchId}::uuid, ${value.trim()}
      ) AS result
    `);
    const response = NextResponse.json({ messageId: rows[0]?.result }, {
      status: 201, headers,
    });
    if (visitor.setCookie) response.headers.append('Set-Cookie', visitor.setCookie);
    return response;
  } catch (error) {
    const sqlCode = (error as { code?: string }).code;
    const status = sqlCode === '23505' ? 409 : sqlCode === '23514' ? 429
      : sqlCode === '22023' ? 422 : sqlCode === '42501' ? 403
      : error instanceof SyntaxError ? 400
      : error instanceof Error && /Cross-origin|Invalid content type|Verified network identity/.test(error.message) ? 403
      : 503;
    return NextResponse.json({
      error: status === 409 ? 'You have already voted on this match.' :
        status === 429 ? 'Too many submissions. Please try again later.' :
        status === 422 ? 'This submission is not permitted for this match.' :
        status === 403 ? 'Submission blocked by security policy.' :
        status === 400 ? 'Malformed submission.' :
        'Community participation is temporarily unavailable.',
    }, { status, headers });
  }
}
