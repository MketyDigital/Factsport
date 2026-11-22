export const runtime = 'edge';
export const revalidate = 10;

import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import { getPostgresMatchById } from '@/lib/adapters/postgres-matches';

export async function GET(request: Request) {
  const matchId = new URL(request.url).searchParams.get('match_id');
  if (!matchId) return NextResponse.json({ error: 'Match ID required' }, { status: 400 });
  if ((env.FACTSPORT_MATCH_DETAIL_BACKEND ?? process.env.FACTSPORT_MATCH_DETAIL_BACKEND) !== 'postgres') {
    return NextResponse.json({ error: 'V2 match pin reader is not provisioned.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }
  try {
    const match = await getPostgresMatchById(matchId);
    const staging = env.FACTSPORT_ENVIRONMENT === 'staging';
    return NextResponse.json({
      chat_pin_text: match?.chat_pin_text ?? null,
      chat_pin_link: match?.chat_pin_link ?? null,
    }, { headers: { 'Cache-Control': staging ? 'private, no-store, max-age=0' : 'public, max-age=0, s-maxage=10' } });
  } catch {
    return NextResponse.json({ chat_pin_text: null, chat_pin_link: null }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
