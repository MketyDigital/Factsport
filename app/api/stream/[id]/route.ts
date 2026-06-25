import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

// This securely proxies the stream so the original URL is hidden from the user.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { id } = await params;

    // 1. Validate the match ID and get the real URL
    const { data: match } = await supabase
        .from('matches')
        .select('stream_url, media_url')
        .eq('id', id)
        .single();

    if (!match) return new NextResponse('Not Found', { status: 404 });

    const targetUrl = match.stream_url || match.media_url;
    if (!targetUrl) return new NextResponse('No Stream', { status: 404 });

    // If it's a YouTube embed, you can't truly "proxy" the video bytes without violating TOS,
    // so we just redirect. For m3u8 or raw mp4 files, we can proxy them.
    if (targetUrl.includes('youtube') || targetUrl.includes('youtu.be')) {
         return NextResponse.redirect(targetUrl);
    }

    try {
        // 2. Fetch the raw video/audio stream from the hidden source
        const response = await fetch(targetUrl, {
            headers: {
                // Optional: Pass through user-agent or fake it if needed
                'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0',
            }
        });

        if (!response.ok) {
            return new NextResponse('Stream source error', { status: response.status });
        }

        // 3. Pipe the stream back to the client directly
        return new NextResponse(response.body, {
            headers: {
                'Content-Type': response.headers.get('Content-Type') || 'application/vnd.apple.mpegurl',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
            }
        });

    } catch (e) {
        return new NextResponse('Internal Proxy Error', { status: 500 });
    }
}
