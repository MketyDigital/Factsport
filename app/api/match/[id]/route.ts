// ✅ Required for Cloudflare Pages/Edge compatibility
export const runtime = 'edge'; 
// ✅ Ensures the score is never cached by the server so it stays "Live"
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';
import { getExternalData } from '@/app/lib/matchService';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    
    // 1. Fetch the match record from your Database
    // We need this to get the ESPN api_id and team names
    const { data: dbData, error } = await supabase
      .from('matches')
      .select('*')
      .eq('id', params.id)
      .single();
    
    if (error || !dbData) {
      return NextResponse.json({ error: 'Match not found in database' }, { status: 404 });
    }

    // 2. Use the Centralized Service to fetch fresh data from ESPN
    // This uses the 'matchService.ts' logic we built to keep things modular
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