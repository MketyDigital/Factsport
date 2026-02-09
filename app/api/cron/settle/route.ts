export const runtime = 'edge'; 
export const dynamic = 'force-dynamic';

import { createClient } from '@/app/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    
    // 1. Security Check
    if (searchParams.get('key') !== process.env.CRON_KEY) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient();

    try {
        // 2. Find Finished Matches that need settling
        const { data: matches, error } = await supabase
            .from('matches')
            .select('*')
            .in('status', ['FT', 'FINISHED']) // Checks for both just in case
            .eq('points_distributed', false)
            .limit(10); // Process 10 at a time to be safe

        if (error) throw error;
        if (!matches || matches.length === 0) {
            return NextResponse.json({ message: 'No matches waiting to settle.' });
        }

        let settledCount = 0;
        
        // 3. Process matches using your SQL Function
        for (const match of matches) {
            const { error: rpcError } = await supabase.rpc('settle_match_points', { target_match_id: match.id.toString() });
            
            if (!rpcError) {
                // Mark as distributed
                await supabase.from('matches').update({ points_distributed: true }).eq('id', match.id);
                settledCount++;
            } else {
                console.error(`Settle RPC Error (Match ID: ${match.id}):`, rpcError);
            }
        }

        return NextResponse.json({ success: true, settled: settledCount, matches_found: matches.length });
        
    } catch (err: any) {
        console.error("Settle Route Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}