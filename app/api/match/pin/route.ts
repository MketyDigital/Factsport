export const runtime = 'edge';
export const revalidate = 10; // 🛡️ THE SHIELD: Cache this response for 10 seconds!

import { NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const matchId = searchParams.get('match_id');

        if (!matchId) {
            return NextResponse.json({ error: 'Match ID required' }, { status: 400 });
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