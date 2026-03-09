import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/app/lib/supabase/server';

const ADMIN_EMAILS = [
    'mkposcosunday@gmail.com', 
    'factsportlive@gmail.com', 
    'fact@factsport.com'
];

export async function POST(request: Request) {
    try {
        // 1. THE BOUNCER
        const supabaseSession = createClient();
        const { data: { session } } = await supabaseSession.auth.getSession();

        if (!session || !session.user || !session.user.email || !ADMIN_EMAILS.includes(session.user.email.toLowerCase())) {
            return NextResponse.json({ error: 'Unauthorized Access. Incident Logged.' }, { status: 403 });
        }

        const body = await request.json();
        const { code_1xbet, link_1xbet, code_melbet, link_melbet, default_affiliate_link, youtube_link } = body;

        const supabaseAdmin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { error } = await supabaseAdmin
            .from('site_settings')
            .update({ 
                code_1xbet, 
                link_1xbet, 
                code_melbet, 
                link_melbet,
                default_affiliate_link,
                youtube_link
            })
            .eq('id', 1);

        if (error) throw error;

        return NextResponse.json({ success: true, message: 'Settings saved securely.' });

    } catch (error: any) {
        console.error("Settings API Error:", error);
        return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
    }
}