import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import { createClient } from '@supabase/supabase-js';
import { listPostgresMatches } from '@/lib/adapters/postgres-matches';

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

    // Staging-only read cutover; never switch automatically based on DATABASE_URL presence.
    if ((env.FACTSPORT_MATCHES_BACKEND ?? process.env.FACTSPORT_MATCHES_BACKEND) === 'postgres') {
        if (type !== 'results' && type !== 'fixtures') {
            return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
        }
        if (league.length > 100 || !Number.isFinite(new Date(cursor).valueOf())) {
            return NextResponse.json({ error: 'Invalid league or cursor' }, { status: 400 });
        }
        try {
            const matches = await listPostgresMatches({ league, cursor, type });
            const cacheControl = env.FACTSPORT_ENVIRONMENT === 'staging'
                ? 'private, no-store, max-age=0'
                : 'public, s-maxage=60';
            return NextResponse.json(matches, { headers: { 'Cache-Control': cacheControl } });
        } catch (error: unknown) {
            // Only the separate token-protected staging Worker receives
            // sanitized error diagnostics; do not expose SQL or connection info.
            if (env.FACTSPORT_ENVIRONMENT === 'staging') {
                const raw = (error && typeof error === 'object' && 'code' in error)
                    ? String((error as { code?: unknown }).code || '') : '';
                const sqlState = /^[A-Z0-9]{5}$/.test(raw) ? raw : 'none';
                const errorClass = error instanceof Error ? error.name : 'Unknown';
                return NextResponse.json({
                    error: 'Match data temporarily unavailable',
                    sqlState, errorClass,
                }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
            }
            return NextResponse.json({ error: 'Match data temporarily unavailable' }, { status: 503 });
        }
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