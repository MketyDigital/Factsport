export const runtime = 'edge';
export const revalidate = 3;

import { createClient as createPublicClient } from '@supabase/supabase-js';
import { Metadata, ResolvingMetadata } from 'next';
import { notFound } from 'next/navigation';
import EmbedPlayerClient from '@/app/components/EmbedPlayerClient';
import { getPostgresMatchById, getPostgresMatchPlaybackById } from '@/lib/adapters/postgres-matches';
import { getPublicHomepageSettings } from '@/lib/adapters/postgres-homepage';

const getMatchData = async (id: string): Promise<any> => {
  if (process.env.FACTSPORT_MATCH_DETAIL_BACKEND === 'postgres') {
    return getPostgresMatchById(id);
  }
  if (process.env.NODE_ENV !== 'development') return null;
  const supabase = createPublicClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await supabase.from('matches')
    .select('id, api_id, espn_id, league, home_team, away_team, home_score, away_score, match_date, status, home_logo, away_logo')
    .eq('id', id).single();
  return error ? null : data;
};

const getPlaybackProjection = async (id: string): Promise<any> => {
  if (process.env.FACTSPORT_MATCH_DETAIL_BACKEND === 'postgres') {
    return getPostgresMatchPlaybackById(id);
  }
  if (process.env.NODE_ENV !== 'development') return null;
  const supabase = createPublicClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data } = await supabase.from('matches')
    .select('video_url, livestream_url, audio_url')
    .eq('id', id).maybeSingle();
  return data || null;
};

const getAnnouncement = async (): Promise<any> => {
  if (process.env.FACTSPORT_HOMEPAGE_BACKEND === 'postgres') {
    const settings = await getPublicHomepageSettings();
    return {
      text: settings?.announcement_text || '',
      link: settings?.announcement_link || null,
      enabled: settings?.announcement_enabled === true,
    };
  }
  if (process.env.NODE_ENV !== 'development') return { text: '', link: null, enabled: false };
  const supabase = createPublicClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data } = await supabase.from('site_settings')
    .select('announcement_text, announcement_link, announcement_enabled')
    .limit(1).maybeSingle();
  return {
    text: data?.announcement_text || '',
    link: data?.announcement_link || null,
    enabled: data?.announcement_enabled === true,
  };
};

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const resolved = await params;
  const match = await getMatchData(resolved.id);
  if (!match) return { title: 'Match Not Found | FactSport', robots: { index: false, follow: false } };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://factsport.com';
  const title = `LIVE MATCH: ${match.home_team} vs ${match.away_team} | FactSport`;
  const description = `Open the secure FactSport match player for ${match.home_team} vs ${match.away_team}.`;
  const bytes = new TextEncoder().encode(JSON.stringify({
    type: 'versus', home: match.home_team, away: match.away_team,
    homeLogo: match.home_logo, awayLogo: match.away_logo,
  }));
  const binary = Array.from(bytes, byte => String.fromCodePoint(byte)).join('');
  const ogData = btoa(binary);

  return {
    title, description,
    robots: { index: false, follow: false, noarchive: true },
    other: {
      'twitter:card': 'player',
      'twitter:title': title,
      'twitter:description': description,
      'twitter:player': `${appUrl}/embed/${match.id}`,
      'twitter:player:width': '1280',
      'twitter:player:height': '720',
      'twitter:image': `${appUrl}/api/og?data=${ogData}`,
    },
  };
}

export default async function EmbedPage({ params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  if (!resolved?.id) return notFound();
  if (process.env.NODE_ENV !== 'development' && process.env.FACTSPORT_MATCH_DETAIL_BACKEND !== 'postgres') return notFound();

  const [match, playback, announcement] = await Promise.all([
    getMatchData(resolved.id),
    getPlaybackProjection(resolved.id),
    getAnnouncement(),
  ]);
  if (!match) return notFound();

  const initialMode: 'video' | 'audio' =
    !playback?.video_url && !playback?.livestream_url && playback?.audio_url ? 'audio' : 'video';

  return (
    <EmbedPlayerClient
      match={match}
      initialMode={initialMode}
      announcement={announcement}
      appUrl={process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://factsport.com'}
    />
  );
}
