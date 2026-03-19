import { NextResponse } from 'next/server';
import { StreamClient } from '@stream-io/node-sdk';
import { createClient } from '@/app/lib/supabase/server';

const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY!;
const apiSecret = process.env.STREAM_API_SECRET!;

export async function GET() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = new StreamClient(apiKey, apiSecret);
    
    // Generate a secure token valid for 4 hours
    const exp = Math.round(new Date().getTime() / 1000) + 60 * 60 * 4;
    const token = client.generateUserToken({ user_id: user.id, exp });

    return NextResponse.json({ 
        token, 
        userId: user.id, 
        username: user.user_metadata?.username || 'FactSport Fan',
        image: user.user_metadata?.avatar_url || ''
    });
}