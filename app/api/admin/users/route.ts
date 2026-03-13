import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/app/lib/supabase/server'; 

const ADMIN_EMAILS = [
    'mkposcosunday@gmail.com', 
    'factsportlive@gmail.com', 
    'fact@factsport.com'
];

// 🔒 Strict security: Pulls PIN from your Cloudflare/Vercel environment variables
const MASTER_ADMIN_PIN = process.env.ADMIN_PIN; 

export async function POST(request: Request) {
    try {
        // 1. THE BOUNCER: Check session identity
        const supabaseSession = createClient();
        const { data: { session } } = await supabaseSession.auth.getSession();

        if (!session || !session.user || !session.user.email || !ADMIN_EMAILS.includes(session.user.email.toLowerCase())) {
            return NextResponse.json({ error: 'Unauthorized Access. Incident Logged.' }, { status: 403 });
        }

        // 2. Parse Request
        const body = await request.json();
        const { userId, isVip, action, pin } = body;

        // 3. THE EXTRA PADLOCK: Check the PIN!
        // If MASTER_ADMIN_PIN is not set in .env, it defaults to blocking everyone to be safe.
        if (!MASTER_ADMIN_PIN || pin !== MASTER_ADMIN_PIN) {
            return NextResponse.json({ error: 'Invalid Master PIN. Intrusion logged.' }, { status: 401 });
        }

        if (!userId || !action) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        // 4. Initialize God Mode (Bypasses RLS safely)
        const supabaseAdmin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // ACTION: Toggle VIP Status
        if (action === 'toggle_vip') {
            const { error } = await supabaseAdmin
                .from('profiles')
                .update({ is_vip: isVip })
                .eq('id', userId);

            if (error) throw error;
            return NextResponse.json({ success: true, message: `VIP status updated` });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error: any) {
        console.error("User Admin API Error:", error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}