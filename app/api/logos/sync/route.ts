import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: Request) {
    try {
        // 🛡️ THE SECURITY BOUNCER: Checking for your existing CRON_KEY
        const secretKey = req.headers.get('x-cron-key');
        if (secretKey !== process.env.CRON_KEY) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { teamName, logoUrl } = await req.json();
        
        if (!teamName || !logoUrl || logoUrl.includes('supabase') || logoUrl.includes('espncdn')) {
            return NextResponse.json({ skipped: true, url: logoUrl }, { status: 200 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        // 🟢 FIX: Must use SERVICE_ROLE_KEY to bypass Row Level Security when uploading files!
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data: existing } = await supabase
            .from('team_logos')
            .select('local_url')
            .eq('team_name', teamName)
            .single();
        
        if (existing?.local_url) {
            return NextResponse.json({ local_url: existing.local_url });
        }

        const imageRes = await fetch(logoUrl);
        if (!imageRes.ok) throw new Error('Failed to download image from source');
        
        const imageBuffer = await imageRes.arrayBuffer();
        const contentType = imageRes.headers.get('content-type') || 'image/png';

        const safeFileName = `${teamName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}-${Date.now()}.png`;

        const { error: uploadError } = await supabase.storage
            .from('team-logos')
            .upload(`public/${safeFileName}`, imageBuffer, { 
                contentType, 
                upsert: true,
                cacheControl: '31536000' 
            });
        
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('team-logos').getPublicUrl(`public/${safeFileName}`);

        await supabase.from('team_logos').insert([{
            team_name: teamName,
            original_url: logoUrl,
            local_url: publicUrl
        }]);

        return NextResponse.json({ local_url: publicUrl });

    } catch (error: any) {
        console.error('Logo Sync Error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}