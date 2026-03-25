import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 🟢 THE MAGIC SHIELD: Caches this endpoint at the Edge CDN for 60 seconds!
// If 1,000 users click "Load More" for the Premier League in the same minute, the DB is only queried ONCE.
export const revalidate = 60; 

const FINISHED_STATUSES = ['FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD'];

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const league = searchParams.get('league');
    const cursor = searchParams.get('cursor');
    const type = searchParams.get('type'); // 'results' or 'fixtures'

    if (!league || !cursor || !type) {
        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    
    let query = supabase.from('matches')
        .select('*')
        .eq('league', league)
        .limit(15);

    if (type === 'results') {
        query = query
            .in('status', FINISHED_STATUSES)
            .lt('match_date', cursor)
            .order('match_date', { ascending: false });
    } else {
        const statusString = `(${FINISHED_STATUSES.map(s => `"${s}"`).join(',')})`;
        query = query
            .not('status', 'in', statusString)
            .gt('match_date', cursor)
            .order('match_date', { ascending: true });
    }

    const { data, error } = await query;
    
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    
    return NextResponse.json(data || []);
}