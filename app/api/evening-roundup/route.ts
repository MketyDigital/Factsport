export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { postToSocials } from '@/app/lib/socialService';

export async function GET(request: Request) {
    const url = new URL(request.url);
    if (url.searchParams.get('key') !== process.env.CRON_KEY) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const today = new Date().toISOString().split('T')[0];

    const { error: lockError } = await supabase.from('cron_logs_evening').insert([{ run_date: today }]);
    if (lockError) return NextResponse.json({ message: "Evening roundup already posted today. Skipping." });
    
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)).toISOString();
    const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)).toISOString();

    const { data: matches, error } = await supabase
        .from('matches')
        .select('*')
        .gte('match_date', startOfDay)
        .lte('match_date', endOfDay)
        .in('status', ['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED'])
        .order('match_date', { ascending: true });

    if (error || !matches || matches.length === 0) {
        await supabase.from('cron_logs_evening').delete().eq('run_date', today);
        return NextResponse.json({ message: "No games or error. Lock removed." });
    }

    const frontendUrl = 'https://factsport.com'; 

    let fb1Text = `🏁 FULL TIME RESULTS!\n\nHere is how today played out:\n\n`;
    matches.forEach(m => {
        fb1Text += `⚽ ${m.home_team} ${m.home_score} - ${m.away_score} ${m.away_team}\n`;
    });
    fb1Text += `\nFull stats & news: ${frontendUrl} 🏆`;

    let xText = `🏁 DAILY RESULTS!\n\n`;
    matches.slice(0, 8).forEach(m => {
        xText += `${m.home_team} ${m.home_score} - ${m.away_score} ${m.away_team}\n`;
    });
    xText += `\nFull stats & news: ${frontendUrl}`;

    try {
        await postToSocials({ fb1Message: fb1Text, xMessage: xText }); 
        return NextResponse.json({ success: true, total_matches: matches.length });
    } catch (e) {
        // 🚨 SELF-HEALING: Delete the lock if it fails
        await supabase.from('cron_logs_evening').delete().eq('run_date', today);
        return NextResponse.json({ error: "Posting failed. Lock removed for retry." }, { status: 500 });
    }
}