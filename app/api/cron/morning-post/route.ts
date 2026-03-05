export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { isBigTeamMatch, postToSocials } from '@/app/lib/socialService';

export async function GET(request: Request) {
    const url = new URL(request.url);
    if (url.searchParams.get('key') !== process.env.CRON_KEY) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const today = new Date().toISOString().split('T')[0];

    const { data: matches } = await supabase
        .from('matches')
        .select('*')
        .like('match_date', `${today}%`)
        .order('match_date', { ascending: true });

    if (!matches || matches.length === 0) return NextResponse.json({ message: "No games today" });

    const vipMatches = matches.filter(m => isBigTeamMatch(m.home_team, m.away_team));

    if (vipMatches.length > 0) {
        let text = `📅 MATCHDAY IS HERE!\n\nToday's biggest clashes:\n\n`;
        
        vipMatches.forEach(m => {
            const time = new Date(m.match_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            text += `🔥 ${m.home_team} vs ${m.away_team} (${time})\n`;
        });

        text += `\nThere's plenty more action happening. Catch the full schedule, live scores, and watch-alongs on FactSport!`;

        // 🟢 UPDATED: Points to your main domain
        await postToSocials(text, "https://factsport.com"); 
    }

    return NextResponse.json({ success: true, posted: vipMatches.length > 0 });
}