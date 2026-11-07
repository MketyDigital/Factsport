export const runtime = 'edge';
export const revalidate = 10; // 🛡️ THE SHIELD: Cache this response for 10 seconds!

import { NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';
import { env } from 'cloudflare:workers';
import { getPostgresMatchById } from '@/lib/adapters/postgres-matches';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const matchId = searchParams.get('match_id');

        if (!matchId) {
            return NextResponse.json({ error: 'Match ID required' }, { status: 400 });
        }

        const backend = env.FACTSPORT_MATCH_DETAIL_BACKEND ?? process.env.FACTSPORT_MATCH_DETAIL_BACKEND;
        if (backend === 'postgres') {
            const match = await getPostgresMatchById(matchId);
            const staging = env.FACTSPORT_ENVIRONMENT === 'staging';
            return NextResponse.json({
                chat_pin_text: match?.chat_pin_text ?? null,
                chat_pin_link: match?.chat_pin_link ?? null,
            }, { headers: { 'Cache-Control': staging ? 'private, no-store, max-age=0' : 'public, max-age=0, s-maxage=10' } });
        }
        if ((env.FACTSPORT_ENVIRONMENT === 'staging' || env.FACTSPORT_ENVIRONMENT === 'production')) {
            return NextResponse.json({ error: 'V2 match pin reader is not provisioned.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
        }

        const supabase = createClient();
        const { data, error } = await supabase
            .from('matches')
            .select('chat_pin_text, chat_pin_link')
            .eq('id', matchId)
            .single();

        if (error || !data) {
            return NextResponse.json({ chat_pin_text: null, chat_pin_link: null });
        }

        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ chat_pin_text: null, chat_pin_link: null }, { status: 500 });
    }
}