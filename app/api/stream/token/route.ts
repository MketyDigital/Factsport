export const runtime = 'edge'; // 🟢 100% Cloudflare Pages Compatible

import { NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';
import { SignJWT } from 'jose';

const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY!;
const apiSecret = process.env.STREAM_API_SECRET!;

export async function GET() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Check if user is logged in
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!apiSecret) {
        return NextResponse.json({ error: 'Missing Stream Secret' }, { status: 500 });
    }

    // 2. Generate a secure token valid for 4 hours using 'jose' (Edge-compatible)
    const exp = Math.round(Date.now() / 1000) + 60 * 60 * 4;
    
    // Convert secret string to a byte array for the Edge crypto engine
    const secretKey = new TextEncoder().encode(apiSecret);
    
    // Sign the JWT payload with the exact algorithm Stream requires (HS256)
    const token = await new SignJWT({ user_id: user.id })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuedAt()
        .setExpirationTime(exp)
        .sign(secretKey);

    return NextResponse.json({ 
        token, 
        userId: user.id, 
        username: user.user_metadata?.username || 'FactSport Fan',
        image: user.user_metadata?.avatar_url || ''
    });
}