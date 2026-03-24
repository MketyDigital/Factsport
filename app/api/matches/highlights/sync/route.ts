import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';
export const dynamic = 'force-dynamic'; 
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// 🟢 MASSIVE TRUSTED CHANNEL ROSTER
// SuperSport, BeIN, Sky, TNT, UEFA, FIFA, and top 5 European leagues.
const TRUSTED_CHANNELS = [
    'UCpXhH0N5l3EIuXWOKL80Zzw', 'UCv1xGkI1L4K6Yk_Dk1rMvPQ', 
    'UCNAf1k0yIjyGu3k9BwAg3lg', 'UC4i_9WvfPRTuRWEaWyfKuFw', 
    'UCBJeMCIeAE2iqqgFlhKAkFA', 'UCKOEcbWE1W5E01T8y0qW6SQ', 
    'UC6GLKMOGjwKNqXCXbf-Ryyw', 'UCrCChz8uQ1H7L1S2k1H4X5Q', 
    'UCb1G_d8o4rRk3wB0n6Z3mDQ', 'UCG5qGWdu8nIRZqJ_GgXQAWg', 
    'UC0IGBdOVni-jzSQpAMGQhCw', 'UCpcTrCXblq78GZrTUTLWeBw', 
    'UCqZQlzSHbVJrwrn5XvzrzcA'
];

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        if (searchParams.get('key') !== process.env.CRON_KEY) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const YOUTUBE_KEY = process.env.YOUTUBE_API_KEY;
        if (!YOUTUBE_KEY) throw new Error("Missing YouTube API Key");

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!, 
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        
        let syncedCount = 0;
        let cleanedCount = 0;

        // ==========================================
        // PHASE 1: THE BROKEN VIDEO SWEEPER
        // ==========================================
        const { data: existingVids } = await supabase
            .from('matches')
            .select('id, video_url')
            .not('video_url', 'is', null)
            .like('video_url', '%youtube.com%')
            .order('match_date', { ascending: false })
            .limit(50); 

        if (existingVids && existingVids.length > 0) {
            const videoIds = existingVids.map(m => m.video_url.split('v=')[1]?.split('&')[0]).filter(Boolean);
            
            if (videoIds.length > 0) {
                const checkUrl = `https://www.googleapis.com/youtube/v3/videos?key=${YOUTUBE_KEY}&id=${videoIds.join(',')}&part=status`;
                const checkRes = await fetch(checkUrl);
                const checkData = await checkRes.json();

                const validIds = (checkData.items || [])
                    .filter((item: any) => item.status?.embeddable === true)
                    .map((item: any) => item.id);

                for (const match of existingVids) {
                    const vId = match.video_url.split('v=')[1]?.split('&')[0];
                    if (!validIds.includes(vId)) {
                        await supabase.from('matches').update({ video_url: null }).eq('id', match.id);
                        cleanedCount++;
                    }
                }
            }
        }

        // ==========================================
        // PHASE 2: THE PRECISION GEO-SHIELD FETCHER
        // ==========================================
        const today = new Date();
        const threeDaysAgo = new Date(today);
        threeDaysAgo.setDate(today.getDate() - 3);

        const { data: missingMatches } = await supabase
            .from('matches')
            .select('id, home_team, away_team, match_date, league') 
            .eq('status', 'FT')
            .is('video_url', null)
            .gte('match_date', threeDaysAgo.toISOString());

        if (missingMatches && missingMatches.length > 0) {
            for (const match of missingMatches) {
                const matchDateObj = new Date(match.match_date);
                const matchYear = matchDateObj.getFullYear();
                const matchMonth = matchDateObj.toLocaleString('default', { month: 'long' }); 
                const compName = match.league || '';

                // LAYER 1: Precision Query
                const query = `${match.home_team} vs ${match.away_team} ${compName} ${matchMonth} ${matchYear} highlights official`;
                
                const searchUrl = `https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_KEY}&q=${encodeURIComponent(query)}&part=snippet&type=video&videoEmbeddable=true&maxResults=5`;
                const searchRes = await fetch(searchUrl);
                const searchData = await searchRes.json();

                if (!searchData.items || searchData.items.length === 0) continue;

                const foundVideoIds = searchData.items.map((i: any) => i.id.videoId).join(',');
                const verifyUrl = `https://www.googleapis.com/youtube/v3/videos?key=${YOUTUBE_KEY}&id=${foundVideoIds}&part=contentDetails,status,snippet`;
                const verifyRes = await fetch(verifyUrl);
                const verifyData = await verifyRes.json();

                let bestVideoId = null;

                for (const searchItem of searchData.items) {
                    const vidId = searchItem.id.videoId;
                    const channelId = searchItem.snippet.channelId;
                    const videoTitle = searchItem.snippet.title.toLowerCase();
                    const videoPublishedAt = new Date(searchItem.snippet.publishedAt);
                    
                    // LAYER 2: The Time-Machine Check (-24h to +168h buffer)
                    const hoursDifference = (videoPublishedAt.getTime() - matchDateObj.getTime()) / (1000 * 60 * 60);
                    if (hoursDifference < -24 || hoursDifference > 168) continue; 

                    // LAYER 3: The Title Safety Net
                    const homeShort = match.home_team.substring(0, 4).toLowerCase();
                    const awayShort = match.away_team.substring(0, 4).toLowerCase();
                    if (!videoTitle.includes(homeShort) && !videoTitle.includes(awayShort)) continue;

                    // GEO-BLOCK SHIELD
                    const geoData = verifyData.items?.find((v: any) => v.id === vidId);
                    if (!geoData) continue;

                    const regionRestrictions = geoData.contentDetails?.regionRestriction;
                    const isGloballySafe = !regionRestrictions || (!regionRestrictions.blocked && !regionRestrictions.allowed);

                    if (isGloballySafe && TRUSTED_CHANNELS.includes(channelId)) {
                        bestVideoId = vidId;
                        break; // Perfect official match found!
                    }

                    if (isGloballySafe && !bestVideoId) {
                        bestVideoId = vidId; // Safe fallback
                    }
                }

                if (bestVideoId) {
                    await supabase
                        .from('matches')
                        .update({ video_url: `https://www.youtube.com/watch?v=${bestVideoId}` })
                        .eq('id', match.id); // Targeted strict update
                    syncedCount++;
                }
            }
        }

        return NextResponse.json({ 
            success: true, 
            message: `Execution complete. Added ${syncedCount} new global highlights. Swept and removed ${cleanedCount} broken/restricted videos.` 
        });

    } catch (error: any) {
        console.error('Sync/Sweep Error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}