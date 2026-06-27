import { createClient } from '@supabase/supabase-js';
import FactSportPlayer from '@/app/components/FactSportPlayer';

export const dynamic = 'force-dynamic';

const getSupabase = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
    return createClient(url, key);
};

export default async function PlayerEmbed({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params;
    const supabase = getSupabase();
    
    const { data: match } = await supabase
        .from('matches')
        .select('*')
        .eq('id', resolvedParams.id)
        .single();

    if (!match || !match.media_url) {
        return (
            <div style={{ backgroundColor: 'black', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100vw', fontFamily: 'sans-serif', margin: 0, padding: 0 }}>
                <h2>Stream Unavailable</h2>
            </div>
        );
    }

    const isLive = ['LIVE', 'IN_PLAY', 'IN', '1H', '2H', 'HT', 'HALFTIME', 'ET', 'EXTRA TIME', 'P', 'PENALTIES'].includes((match.status || '').toUpperCase());
    const isFinished = ['FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD'].includes((match.status || '').toUpperCase());

    return (
        <div style={{ margin: 0, padding: 0, width: '100vw', height: '100vh', backgroundColor: 'black', overflow: 'hidden' }}>
            <FactSportPlayer 
                mediaUrl={match.media_url} 
                matchId={match.id} 
                mode={match.media_url.includes('audio') ? 'audio' : 'video'} 
                isLocked={!isLive && !isFinished}
                isFinished={isFinished}
                matchDate={match.match_date}
            />
        </div>
    );
}
