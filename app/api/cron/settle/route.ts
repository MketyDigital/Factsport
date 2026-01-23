import { createClient } from '@/app/lib/supabase/client';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    // 1. Security Check (Using your variable name CRON_KEY)
    const { searchParams } = new URL(request.url);
    if (searchParams.get('key') !== process.env.CRON_KEY) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient();

    // 2. Find Matches that are FINISHED (FT) but Points NOT Distributed
    const { data: matches } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'FT')
        .eq('points_distributed', false);

    if (!matches || matches.length === 0) {
        return NextResponse.json({ message: 'No matches waiting for settlement.' });
    }

    let settledCount = 0;
    const logs = [];

    // 3. Process Each Match
    for (const match of matches) {
        // Run the SQL Engine (Fast & Safe)
        const { error } = await supabase.rpc('settle_match_points', { target_match_id: match.id });

        if (!error) {
            // Mark as Distributed so we don't pay twice
            await supabase.from('matches').update({ points_distributed: true }).eq('id', match.id);
            logs.push(`Settled: ${match.home_team} vs ${match.away_team} (${match.home_score}-${match.away_score})`);
            settledCount++;
        } else {
            logs.push(`Failed: ${match.home_team} vs ${match.away_team} - ${error.message}`);
        }
    }

    // 4. Log the activity
    if (logs.length > 0) {
        await supabase.from('automation_logs').insert({ action: 'AUTO_SETTLE', details: logs.join('; ') });
    }

    return NextResponse.json({ success: true, settled: settledCount, logs });
}