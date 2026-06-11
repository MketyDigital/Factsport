// app/api/cache/group-standings/route.ts

export const runtime = 'edge';
export const revalidate = 120;

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const league = searchParams.get('league');
  const season = searchParams.get('season');

  if (!league) {
    return NextResponse.json({ error: 'Missing league' }, { status: 400 });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    let query = supabase
      .from('group_standings')
      .select('*')
      .eq('league_name', league)
      .order('group_name', { ascending: true })
      .order('position', { ascending: true });

    if (season) {
      query = query.eq('season', season);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data || [], {
      headers: {
        'Cache-Control': 'public, max-age=0, s-maxage=120, stale-while-revalidate=300'
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}