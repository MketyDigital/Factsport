export const runtime = 'edge';
export const revalidate = 3; 

import { createClient as createPublicClient } from '@supabase/supabase-js'; 
import { Metadata, ResolvingMetadata } from 'next';
import FactSportPlayer from '@/app/components/FactSportPlayer';

const getSupabaseData = async (id: string) => {
    const supabase = createPublicClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data, error } = await supabase.from('matches').select('*').eq('id', id).single();
    if (error) return null;
    return data;
};

// 🟢 Dynamically generate the strict Player Card metadata that X/Twitter requires
export async function generateMetadata({ params }: { params: { id: string } }, parent: ResolvingMetadata): Promise<Metadata> {
    const resolvedParams = await params;
    const match = await getSupabaseData(resolvedParams.id);
    if (!match) return { title: 'Match Not Found | FactSport' };

    const appUrl = process.env.APP_URL || 'https://factsport.com';
    const title = `🔴 LIVE STREAM: ${match.home_team} vs ${match.away_team} | FactSport`;
    const description = `Watch the live match broadcast. Tap to play the full live stream completely free.`;

    // Construct the OG Image data buffer for the preview poster
    const ogData = Buffer.from(JSON.stringify({ 
        type: 'versus', 
        home: match.home_team, 
        away: match.away_team, 
        homeLogo: match.home_logo, 
        awayLogo: match.away_logo 
    })).toString('base64');

    return { 
        title, 
        description, 
        other: {
            'twitter:card': 'player',
            'twitter:title': title,
            'twitter:description': description,
            'twitter:player': `${appUrl}/embed/${match.id}`,
            'twitter:player:width': '1280',
            'twitter:player:height': '720',
            'twitter:image': `${appUrl}/api/og?data=${ogData}`,
        }
    };
}

export default async function EmbedPage({ params }: { params: { id: string } }) {
  const resolvedParams = await params;
  if (!resolvedParams?.id) return (<div className="w-full h-full bg-black"></div>);

  const dbData = await getSupabaseData(resolvedParams.id);
  if (!dbData) return (<div className="w-full h-full bg-black"></div>);

  const FINISHED_STATUSES = ['FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD'];
  const currentStatus = (dbData.status || '').toUpperCase();
  const isFinished = FINISHED_STATUSES.includes(currentStatus);
  
  const matchDateMs = new Date(dbData.match_date).getTime();
  const minutesToKick = (matchDateMs - Date.now()) / 60000;
  const isUniversallyFinished = isFinished || minutesToKick < -240;

  // The active URL for the embed
  const activeVideoUrl = isUniversallyFinished ? dbData.video_url : dbData.livestream_url;

  return (
    <div className="w-screen h-screen bg-black overflow-hidden flex flex-col relative">
      
      {/* 🟢 THE FUNNEL: Automatically redirects the viewer from the X embed back to your full match page after 5 minutes of viewing */}
      <meta httpEquiv="refresh" content={`300;url=/match/${dbData.id}`} />
      
      <FactSportPlayer 
        mediaUrl={activeVideoUrl || ''} 
        matchId={dbData.id} 
        mode="video" 
        isLocked={false} 
        matchDate={dbData.match_date} 
        isFinished={isUniversallyFinished} 
        homeTeam={dbData.home_team}
        awayTeam={dbData.away_team}
        homeLogo={dbData.home_logo}
        awayLogo={dbData.away_logo}
      />
      
      {/* Optional: Add a permanent tiny FactSport logo watermark overlay over the embed */}
      <div className="absolute top-4 left-4 z-50 pointer-events-none">
          <img src="https://Factsport.com/logo.png" alt="FactSport" className="h-8 drop-shadow-lg opacity-80" />
      </div>
    </div>
  );
}