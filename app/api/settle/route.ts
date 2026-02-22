export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store'; 

import { createClient } from '@/app/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    
    // 1. Security Check (Must match your .env CRON_KEY)
    if (searchParams.get('key') !== process.env.CRON_KEY) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient();

    try {
        // 2. Find Finished Matches that need settling
        // We look for 'FT', 'FINISHED', or 'ABD' (Abandoned)
        const { data: matches, error } = await supabase
            .from('matches')
            .select('*')
            .in('status', ['FT', 'FINISHED', 'ABD']) 
            .eq('points_distributed', false) // 🛑 Crucial: Only settle unpaid matches
            .limit(10); // Process 10 at a time to be safe

        if (error) throw error;
        
        if (!matches || matches.length === 0) {
            return NextResponse.json({ message: 'No matches waiting to settle.' });
        }

        let settledCount = 0;
        let logs: string[] = [];
        
        // 3. Process matches using your SQL Function
        for (const match of matches) {
            console.log(`Processing Settlement: ${match.home_team} vs ${match.away_team} (${match.id})`);
            
            // Call the Database Function
            const { error: rpcError } = await supabase.rpc('settle_match_points', { target_match_id: match.id });
            
            if (!rpcError) {
                // ✅ Success: Mark as distributed
                await supabase.from('matches').update({ points_distributed: true }).eq('id', match.id);
                settledCount++;
                logs.push(`✅ Settled: ${match.home_team} vs ${match.away_team}`);
            } else {
                // ❌ Failure: Log error but continue to next match
                console.error(`Settle RPC Error (Match ID: ${match.id}):`, rpcError);
                logs.push(`❌ Failed: ${match.home_team} vs ${match.away_team} - ${rpcError.message}`);
            }
        }

        return NextResponse.json({ 
            success: true, 
            settled: settledCount, 
            matches_found: matches.length,
            logs: logs
        });
        
    } catch (err: any) {
        console.error("Settle Route Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}