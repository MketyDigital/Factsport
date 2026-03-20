export const runtime = 'edge'; 

import { NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';
import { SignJWT, jwtVerify } from 'jose';

const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY!;
const apiSecret = process.env.STREAM_SECRET_KEY!; 

// 👑 THE MASTER FAIL-SAFE LIST
const ADMIN_EMAILS = [
    'mkposcosunday@gmail.com',
    'factsportlive@gmail.com',
    'fact@factsport.com'
];

// ==========================================
// GET: THE BOUNCER (Lets people into the room)
// ==========================================
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const matchId = searchParams.get('match_id');
        const guestToken = searchParams.get('guest');

        if (!apiSecret || !matchId) {
            return NextResponse.json({ error: 'Missing Config or Match ID' }, { status: 400 });
        }

        let userId = '';
        let username = '';
        let role = 'user';
        let avatarUrl = '';

        // 🌟 FLOW 1: THE STATELESS VIP GUEST (No Login Required)
        if (guestToken) {
            try {
                const secret = new TextEncoder().encode(apiSecret);
                const { payload } = await jwtVerify(guestToken, secret);
                
                if (payload.match_id !== matchId) throw new Error('Invalid match');

                userId = `guest-${Math.random().toString(36).substring(2, 9)}`;
                username = 'VIP Guest';
                role = 'guest';
                avatarUrl = `https://ui-avatars.com/api/?name=VIP+Guest&background=8B5CF6&color=fff`;
            } catch (e) {
                return NextResponse.json({ error: 'Guest link is invalid or has expired.' }, { status: 403 });
            }
        } 
        // 🌟 FLOW 2: LOGGED-IN FANS & ADMINS
        else {
            const supabase = createClient();
            const { data: { user }, error: authError } = await supabase.auth.getUser();

            if (authError || !user) return NextResponse.json({ error: 'Unauthorized Access' }, { status: 401 });

            // Fetch the profile to check the database role
            const { data: profile } = await supabase
                .from('profiles')
                .select('role, username, avatar_url')
                .eq('id', user.id)
                .single();

            // 1. Check if email is on the master list
            const userEmail = user.email?.toLowerCase() || '';
            const hasAdminEmail = ADMIN_EMAILS.includes(userEmail);

            // 2. Check if the database profile says admin
            const hasAdminRole = profile?.role === 'admin' || user.user_metadata?.is_admin === true;

            userId = user.id;
            username = profile?.username || user.user_metadata?.username || 'FactSport Fan';
            avatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url || '';
            
            // 3. IRONCLAD CHECK: If EITHER is true, they get Master Controls.
            role = (hasAdminEmail || hasAdminRole) ? 'admin' : 'user';
        }

        // 🛡️ Mint the GetStream Token (Valid for 4 hours)
        const exp = Math.round(Date.now() / 1000) + 60 * 60 * 4;
        const secretKey = new TextEncoder().encode(apiSecret);
        
        const token = await new SignJWT({ user_id: userId })
            .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
            .setIssuedAt()
            .setExpirationTime(exp)
            .sign(secretKey);

        return NextResponse.json({ token, userId, username, image: avatarUrl, role, apiKey });

    } catch (error) {
        console.error('Token Gen Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// ==========================================
// POST: THE GENERATOR (Only Admins can use this to make Guest Links)
// ==========================================
export async function POST(req: Request) {
    try {
        const { matchId } = await req.json();
        
        // 1. Verify the person asking for a link is logged in
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // 2. Verify they are actually an Admin
        const userEmail = user.email?.toLowerCase() || '';
        const hasAdminEmail = ADMIN_EMAILS.includes(userEmail);
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        const hasAdminRole = profile?.role === 'admin' || user.user_metadata?.is_admin === true;

        if (!hasAdminEmail && !hasAdminRole) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 3. Generate a stateless guest token that expires in 24 hours
        const exp = Math.round(Date.now() / 1000) + 60 * 60 * 24; 
        const secretKey = new TextEncoder().encode(apiSecret);
        
        const guestToken = await new SignJWT({ match_id: matchId, is_guest: true })
            .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
            .setIssuedAt()
            .setExpirationTime(exp)
            .sign(secretKey);

        // 4. Return the full link
        const domain = process.env.NEXT_PUBLIC_SITE_URL || 'https://factsport.com';
        const inviteLink = `${domain}/matches/${matchId}?guest=${guestToken}`;

        return NextResponse.json({ inviteLink });

    } catch (error) {
        console.error('Link Gen Error:', error);
        return NextResponse.json({ error: 'Failed to generate link' }, { status: 500 });
    }
}