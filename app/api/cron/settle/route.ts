import { createClient } from '@supabase/supabase-js'; // ⚠️ Change this import
import { NextResponse } from 'next/server';

// Force this route to always run dynamically (never cache)
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    // 1. Security Check
    const { searchParams } = new URL(request.url);
    if (searchParams.get('key') !== process.env.CRON_KEY) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Initialize Admin Client (Bypass RLS)
    // We CANNOT use the standard client here because no user is logged in.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Make sure this is in .env.local

    if (!supabaseServiceKey) {
        return NextResponse.json({ error: 'Server configuration error: Missing Service Key' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    try {
        // 3. Find Matches: FINISHED (FT) + Points NOT Distributed
        const { data: matches, error: fetchError } = await supabase
            .from('matches')
            .select('*')
            .eq('status', 'FT')
            .eq('points_distributed', false);

        if (fetchError) throw fetchError;

        if (!matches || matches.length === 0) {
            return NextResponse.json({ message: 'No matches waiting for settlement.' });
        }

        let settledCount = 0;
        const logs: string[] = [];

        // 4. Process Each Match
        for (const match of matches) {
            // Run the SQL Engine
            const { error: rpcError } = await supabase.rpc('settle_match_points', { target_match_id: match.id });

            if (!rpcError) {
                // Mark as Distributed (Crucial step to prevent double payment)
                await supabase
                    .from('matches')
                    .update({ points_distributed: true })
                    .eq('id', match.id);

                logs.push(`Settled: ${match.home_team} vs ${match.away_team} (${match.home_score}-${match.away_score})`);
                settledCount++;
            } else {
                console.error(`Settlement Error [${match.id}]:`, rpcError);
                logs.push(`Failed: ${match.home_team} vs ${match.away_team} - ${rpcError.message}`);
            }
        }

        // 5. Log activity (Optional but recommended)
        if (logs.length > 0) {
            // Ensure you have this table, or remove this block
           await supabase.from('automation_logs').insert({ action: 'AUTO_SETTLE', details: logs.join('; ') });
        }

        return NextResponse.json({ success: true, settled: settledCount, logs });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}