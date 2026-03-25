export const runtime = 'edge'; 
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js'; 
import { getExternalData } from '@/app/lib/matchService';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {

  // 🛡️ THE SAFE BROWSER BOUNCER 
  if (process.env.NODE_ENV === 'production') {
      const referer = request.headers.get('referer') || '';
      const fetchSite = request.headers.get('sec-fetch-site') || '';
      const isBrowser = referer.includes('factsport.com') || fetchSite === 'same-origin';
      
      const authHeader = request.headers.get('Authorization') || '';
      const isVIP = authHeader === `Bearer ${process.env.CRON_KEY}`;

      if (!isBrowser && !isVIP) {
          return NextResponse.json({ error: 'Direct ESPN Bridge Access is Restricted.' }, { status: 403 });
      }
  }

  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    
    const { data: dbData, error } = await supabase
      .from('matches')
      .select('*')
      .eq('id', params.id)
      .single();
    
    if (error || !dbData) {
      return NextResponse.json({ error: 'Match not found in database' }, { status: 404 });
    }

    const freshData = await getExternalData(dbData);

    // 🟢 THE CLOUDFLARE SHIELD: Caches at the edge for 5 seconds. 
    // Resolves the DDOS threat and drastically lowers your server CPU usage.
    return NextResponse.json(freshData, {
        headers: {
            'Cache-Control': 'max-age=0, s-maxage=5, stale-while-revalidate=10',
        },
    });

  } catch (error: any) {
    console.error('Bridge API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message }, 
      { status: 500 }
    );
  }
}