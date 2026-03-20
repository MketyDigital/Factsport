import { NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server'; 

// 🟢 THE MAGIC SHIELD: This caches the response globally for 1 hour.
// 1 million users could hit this route, and Supabase only sees 1 request.
export const revalidate = 3600; 

export async function GET() {
    try {
        const supabase = createClient();
        
        // 1. Fetch Global Settings
        const { data: settings } = await supabase.from('site_settings').select('*').eq('id', 1).single();
        
        let code1x = settings?.code_1xbet;
        let codeMel = settings?.code_melbet;

        // 2. Fallback: If Admin 1xBet code is empty, find the newest match with a code
        if (!code1x) {
            const { data: latestMatch } = await supabase
                .from('matches')
                .select('booking_code')
                .not('booking_code', 'is', null)
                .neq('booking_code', '')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (latestMatch?.booking_code) {
                code1x = latestMatch.booking_code;
            }
        }

        // Return a clean, formatted payload
        return NextResponse.json({
            link1x: settings?.link_1xbet || null,
            linkMel: settings?.link_melbet || null,
            code1x: code1x || null,
            codeMel: codeMel || null
        });

    } catch (error) {
        console.error("Cache API Error:", error);
        return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }
}