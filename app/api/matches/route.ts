// app/api/matches/route.ts

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';
export const revalidate = 0;
export const dynamic = 'force-dynamic';

const FINISHED_STATUSES = ['FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD'];

const statusInString = `(${FINISHED_STATUSES.map((s) => `"${s}"`).join(',')})`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const league = searchParams.get('league');
  const cursor = searchParams.get('cursor');
  const type = searchParams.get('type');
  const excludeIdsRaw = searchParams.get('exclude_ids') || '';

  if (!league || !type) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  if (!['results', 'fixtures'].includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }

  const excludeIds = new Set(
    excludeIdsRaw
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
  );

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  let query = supabase
    .from('matches')
    .select('*')
    .limit(15);

  if (league !== 'All') {
    query = query.eq('league', league);
  }

  const safeCursor = cursor || new Date().toISOString();

  if (type === 'results') {
    query = query
      .in('status', FINISHED_STATUSES)
      .lt('match_date', safeCursor)
      .order('match_date', { ascending: false });
  } else {
    query = query
      .not('status', 'in', statusInString)
      .gt('match_date', safeCursor)
      .order('match_date', { ascending: true });
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items = (data || []).filter((m: any) => !excludeIds.has(String(m.id)));

  return NextResponse.json(
    {
      items,
      nextCursor: items.length > 0 ? items[items.length - 1].match_date : safeCursor,
      hasMore: items.length >= 15
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=0, s-maxage=20, stale-while-revalidate=60'
      }
    }
  );
}