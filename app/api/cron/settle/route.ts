export const runtime = 'edge'; 
export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('key') !== process.env.CRON_KEY) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );

    try {
        const { data: matches } = await supabase
            .from('matches')
            .select('*')
            .in('status', ['FT', 'FINISHED']) // Matches new Football-Data logic
            .eq('points_distributed', false)
            .limit(10);

        if (!matches || matches.length === 0) return NextResponse.json({ message: 'No matches waiting.' });

        let settledCount = 0;
        for (const match of matches) {
            const { error: rpcError } = await supabase.rpc('settle_match_points', { target_match_id: match.id.toString() });
            if (!rpcError) {
                await supabase.from('matches').update({ points_distributed: true }).eq('id', match.id);
                settledCount++;
            }
        }
        return NextResponse.json({ success: true, settled: settledCount });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}