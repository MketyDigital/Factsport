import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// ✅ FIXED: Missing Edge Runtime definition added back
export const runtime = 'edge'; 
export const dynamic = 'force-dynamic';

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
        // 1. Fetch Matches (Using PLURAL 'points_distributed')
        const { data: matches, error: fetchError } = await supabase
            .from('matches')
            .select('*')
            .eq('status', 'FT')
            .eq('points_distributed', false)
            .limit(10);

        if (fetchError) throw fetchError;
        if (!matches || matches.length === 0) {
            return NextResponse.json({ message: 'No matches waiting for settlement.' });
        }

        let settledCount = 0;
        const logs: string[] = [];

        // 2. Process Loop
        for (const match of matches) {
            const { error: rpcError } = await supabase.rpc('settle_match_points', { 
                target_match_id: match.id 
            });

            if (!rpcError) {
                await supabase
                    .from('matches')
                    .update({ points_distributed: true })
                    .eq('id', match.id);
                
                logs.push(`Settled: ${match.home_team} vs ${match.away_team}`);
                settledCount++;
            } else {
                console.error(`Error settling ${match.id}:`, rpcError);
                logs.push(`Failed: ${match.home_team} - ${rpcError.message}`);
            }
        }

        return NextResponse.json({ success: true, settled: settledCount, logs });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}