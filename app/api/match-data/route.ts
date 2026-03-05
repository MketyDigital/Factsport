import { createClient } from '@/app/lib/supabase/server';
import { NextResponse } from 'next/server';

// 🟢 THE SHIELD: Caches the database response for 5 seconds at the edge.
export const revalidate = 5; 

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('id');

    if (!matchId) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    const supabase = createClient();
    
    // Grabs everything your client components need in one read
    const { data } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .single();

    return NextResponse.json(data);
}