// ✅ Required for Cloudflare Pages/Edge compatibility
export const runtime = 'edge'; 
// ✅ Ensures the score is never cached by the server so it stays "Live"
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js'; // 🟢 OPTIMIZED: Anon Client for pure speed
import { getExternalData } from '@/app/lib/matchService';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {

  // 🛡️ THE SAFE BROWSER BOUNCER 
  // (Allows your Admin Dashboard to use this route, but blocks scrapers)
  if (process.env.NODE_ENV === 'production') {
      const referer = request.headers.get('referer') || '';
      const fetchSite = request.headers.get('sec-fetch-site') || '';
      const isBrowser = referer.includes('factsport.com') || fetchSite === 'same-origin';
      
      // We still allow the CRON_KEY just in case you ever use a backend script, 
      // but now the browser check will let your admin panel through!
      const authHeader = request.headers.get('Authorization') || '';
      const isVIP = authHeader === `Bearer ${process.env.CRON_KEY}`;

      if (!isBrowser && !isVIP) {
          return NextResponse.json({ error: 'Direct ESPN Bridge Access is Restricted.' }, { status: 403 });
      }
  }

  try {
    // 🟢 OPTIMIZED: Bypasses cookie checks entirely for maximum Edge speed
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    
    // 1. Fetch the match record from your Database
    const { data: dbData, error } = await supabase
      .from('matches')
      .select('*')
      .eq('id', params.id)
      .single();
    
    if (error || !dbData) {
      return NextResponse.json({ error: 'Match not found in database' }, { status: 404 });
    }

    // 2. Use the Centralized Service to fetch fresh data from ESPN
    const freshData = await getExternalData(dbData);

    // 3. Return the clean, unified data to your frontend components
    return NextResponse.json(freshData);

  } catch (error: any) {
    console.error('Bridge API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message }, 
      { status: 500 }
    );
  }
}