export const runtime = 'edge'; 

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/app/lib/supabase/server'; 
import { cookies } from 'next/headers'; // 🟢 Added to read the Vault Cookie

const ADMIN_EMAILS = [
    'mkposcosunday@gmail.com', 
    'factsportlive@gmail.com', 
    'fact@factsport.com'
];

export async function POST(request: Request) {
    try {
        // 1. THE BOUNCER: Check session identity
        const supabaseSession = createClient();
        const { data: { session } } = await supabaseSession.auth.getSession();

        if (!session || !session.user || !session.user.email || !ADMIN_EMAILS.includes(session.user.email.toLowerCase())) {
            return NextResponse.json({ error: 'Unauthorized Access. Incident Logged.' }, { status: 403 });
        }

        // 🟢 2. THE VAULT CHECK: Look for the secure cookie instead of a manual PIN!
        const cookieStore = cookies();
        const isVaultUnlocked = cookieStore.get('admin_vault_unlocked')?.value === 'true';

        if (!isVaultUnlocked) {
            return NextResponse.json({ error: 'Vault is locked. Please unlock the dashboard first.' }, { status: 401 });
        }

        // 3. Parse Request (Notice we don't extract 'pin' anymore!)
        const body = await request.json();
        const { userId, isVip, action } = body;

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