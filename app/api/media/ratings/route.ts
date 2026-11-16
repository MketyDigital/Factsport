import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import { withFactsportPostgres, withFactsportCommunityPostgres } from '@/lib/adapters/postgres-client';
import { validCommunityMatchId } from '@/lib/adapters/postgres-community';
import { anonymousCommunityVisitor } from '@/lib/media/anonymous-community-visitor';
import { verifyMediaCommunityTurnstile } from '@/lib/media/community-turnstile';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
const HEADERS = { 'Cache-Control': 'no-store' };
const enabled = () => (env.FACTSPORT_MEDIA_COMMUNITY_BACKEND ?? process.env.FACTSPORT_MEDIA_COMMUNITY_BACKEND) === 'postgres';
export async function GET(request: Request) {
  if (!enabled()) return NextResponse.json({ error: 'Media ratings not enabled.' }, { status: 503, headers: HEADERS });
  const matchId = new URL(request.url).searchParams.get('matchId');
  if (!validCommunityMatchId(matchId)) return NextResponse.json({ error: 'Invalid match.' }, { status: 400, headers: HEADERS });
  try {
    const rows = await withFactsportPostgres(sql => sql`
      SELECT r.player_name, r.total_score, r.vote_count
      FROM public.public_media_player_rating_totals r
      WHERE r.match_id = (
        SELECT id FROM public.matches
        WHERE id = ${matchId}::uuid OR legacy_match_id = ${matchId}::uuid
        ORDER BY CASE WHEN id = ${matchId}::uuid THEN 0 ELSE 1 END LIMIT 1
      )
      ORDER BY r.player_name ASC LIMIT 100
    `);
    return NextResponse.json(rows, { headers: HEADERS });
  } catch {
    return NextResponse.json({ error: 'Media ratings unavailable.' }, { status: 503, headers: HEADERS });
  }
}

export async function POST(request: Request) {
  if (!enabled() || env.FACTSPORT_MEDIA_COMMUNITY_WRITES !== 'enabled')
    return NextResponse.json({ error: 'Media ratings not enabled.' }, { status: 503, headers: HEADERS });
  if (Number(request.headers.get('content-length') || 0) > 4096)
    return NextResponse.json({ error: 'Submission too large.' }, { status: 413, headers: HEADERS });
  try {
    const visitor = await anonymousCommunityVisitor(request);
    const text = await request.text();
    if (text.length > 4096) return NextResponse.json({ error: 'Submission too large.' }, { status: 413, headers: HEADERS });
    const body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(key => !['matchId','playerName','rating','turnstileToken'].includes(key))) {
      return NextResponse.json({ error: 'Unexpected fields.' }, { status: 400, headers: HEADERS });
    }
    if (!validCommunityMatchId(body.matchId) ||
      typeof body.playerName !== 'string' || body.playerName.trim().length < 1 ||
      body.playerName.trim().length > 120 || !Number.isInteger(body.rating) ||
      body.rating < 6 || body.rating > 10) {
      return NextResponse.json({ error: 'Invalid rating.' }, { status: 400, headers: HEADERS });
    }
    if (!(await verifyMediaCommunityTurnstile(request, body.turnstileToken, 'media-rating'))) {
      return NextResponse.json({ error: 'Complete visitor verification.' }, { status: 403, headers: HEADERS });
    }
    const rows = await withFactsportCommunityPostgres(sql => sql`
      SELECT public.submit_anonymous_media_player_rating(
        ${visitor.tokenHash}, ${visitor.networkHash},
        ${body.matchId}::uuid, ${body.playerName.trim()}, ${body.rating}::integer
      ) AS accepted
    `);
    const response = NextResponse.json({ accepted: rows[0]?.accepted === true }, { status: 201, headers: HEADERS });
    if (visitor.setCookie) response.headers.append('Set-Cookie', visitor.setCookie);
    return response;
  } catch (error) {
    const code = (error as { code?: string }).code;
    const status = code === '23505' ? 409 : code === '23514' ? 429 :
      code === '22023' ? 422 : code === '42501' ? 403 :
      error instanceof SyntaxError ? 400 :
      error instanceof Error && /Cross-origin|Invalid content type|Verified network identity/.test(error.message) ? 403 : 503;
    return NextResponse.json({ error: status === 409 ? 'Already rated this player.' :
      status === 429 ? 'Too many ratings.' :
      status === 422 ? 'This player or voting window is not eligible.' :
      status === 403 ? 'Security verification failed.' :
      status === 400 ? 'Malformed submission.' : 'Media ratings unavailable.' }, { status, headers: HEADERS });
  }
}
