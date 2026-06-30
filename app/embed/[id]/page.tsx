export const runtime = 'edge';
export const revalidate = 3; 

import { createClient as createPublicClient } from '@supabase/supabase-js'; 
import { Metadata, ResolvingMetadata } from 'next';
import EmbedPlayerClient from '@/app/components/EmbedPlayerClient';

const getSupabaseData = async (id: string) => {
    const supabase = createPublicClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data, error } = await supabase.from('matches').select('*').eq('id', id).single();
    if (error) return null;
    return data;
};

const getSiteSettings = async () => {
    const supabase = createPublicClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data } = await supabase.from('site_settings').select('*').limit(1).maybeSingle();
    return data || {};
};

// 🟢 Dynamically generate the strict Player Card metadata that X/Twitter requires
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }, parent: ResolvingMetadata): Promise<Metadata> {
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

export default async function EmbedPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  if (!resolvedParams?.id) return (<div className="w-full h-full bg-black"></div>);

  const dbData = await getSupabaseData(resolvedParams.id);
  if (!dbData) return (<div className="w-full h-full bg-black"></div>);

  const siteSettings = await getSiteSettings();
  
  const FINISHED_STATUSES = ['FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD'];
  const currentStatus = (dbData.status || '').toUpperCase();
  const isFinishedApi = FINISHED_STATUSES.includes(currentStatus);
  
  const matchDateMs = new Date(dbData.match_date).getTime();
  const minutesToKick = (matchDateMs - Date.now()) / 60000;
  
  // Universally finished means we should display highlights and hide the stream
  // We rely purely on the API status to handle extra time, penalties, or delays properly.
  const isUniversallyFinished = isFinishedApi;

  // The active URL for the embed
  const activeVideoUrl = isUniversallyFinished ? dbData.video_url : dbData.livestream_url;

  // Global Announcement
  const announcement = {
      text: siteSettings.announcement_text || '',
      link: siteSettings.announcement_link || null,
      enabled: siteSettings.announcement_enabled === true
  };

  return (
    <EmbedPlayerClient 
        match={dbData}
        activeVideoUrl={activeVideoUrl}
        telegramSupport={siteSettings.telegram_support || null}
        announcement={announcement}
        appUrl={process.env.APP_URL || 'https://factsport.com'}
    />
  );
}