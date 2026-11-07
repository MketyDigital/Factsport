import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { env } from 'cloudflare:workers';
import { getPostgresMatchPlaybackById } from '@/lib/adapters/postgres-matches';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FINISHED = new Set(['FT', 'FINISHED', 'POST', 'ENDED', 'FULL TIME', 'AET', 'PEN', 'AWARDED', 'ABD']);
const SCHEDULED = new Set(['SCHEDULED', 'PRE', 'PRE_MATCH', 'UPCOMING', 'TBD', 'DELAYED', 'TIMED']);
const LIVE = new Set(['LIVE', '1H', '2H', 'HT', 'HALFTIME', 'HALF TIME', 'ET', 'EXTRA TIME', 'P', 'PENALTIES', 'IN_PLAY', 'IN PLAY', 'PAUSED', 'SUSPENDED']);
const UNAVAILABLE = new Set(['POSTPONED', 'CANCELLED', 'CANCELED']);

function safePlaybackUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  if (value.trim() === 'streamio') return 'streamio';
  const trimmed = value.trim();
  if (trimmed.startsWith('/')) {
    if (trimmed.startsWith('//') || trimmed.includes(String.fromCharCode(92))) return null;
    const rawPath = trimmed.split(/[?#]/, 1)[0];
    if (rawPath.split('/').some(segment => segment === '..')) return null;
    try {
      const relative = new URL(trimmed, 'https://factsport.invalid');
      if (relative.origin !== 'https://factsport.invalid') return null;
      return `${relative.pathname}${relative.search}${relative.hash}`;
    } catch {
      return null;
    }
  }
  try {
    const url = new URL(trimmed);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    const normalizedHost = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
    if (normalizedHost === 'localhost' || normalizedHost === '127.0.0.1' || normalizedHost === '0.0.0.0' || normalizedHost === '::1' || normalizedHost.startsWith('fc') || normalizedHost.startsWith('fe80:') || normalizedHost.endsWith('.local') || normalizedHost.endsWith('.internal')) return null;
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(normalizedHost)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const id = params?.id || '';
  if (!UUID.test(id)) return NextResponse.json({ status: 'unavailable' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });

  const backend = env.FACTSPORT_MATCH_DETAIL_BACKEND ?? process.env.FACTSPORT_MATCH_DETAIL_BACKEND;
  if (backend === 'postgres') {
    try {
      const match = await getPostgresMatchPlaybackById(id);
      if (!match) return NextResponse.json({ status: 'unavailable' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
      const status = String(match.status || '').toUpperCase();
      const isFinished = FINISHED.has(status);
      const isLive = LIVE.has(status);
      if (UNAVAILABLE.has(status)) return NextResponse.json({ status: 'unavailable' }, { headers: { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie' } });
      const matchTime = new Date(match.match_date).getTime();
      if (!Number.isFinite(matchTime)) return NextResponse.json({ status: 'unavailable' }, { status: 422, headers: { 'Cache-Control': 'no-store' } });
      const unlockAt = matchTime - 15 * 60 * 1000;
      if (!isFinished && !isLive && Date.now() < unlockAt) {
        return NextResponse.json({
          status: 'locked', unlockAt: new Date(unlockAt).toISOString(),
          mode: match.audio_url && !match.livestream_url ? 'audio' : 'video',
        }, { headers: { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie' } });
      }
      const videoSource = isFinished ? match.video_url : match.livestream_url;
      const audioSource = isFinished ? null : match.audio_url;
      const videoUrl = safePlaybackUrl(videoSource);
      const audioUrl = safePlaybackUrl(audioSource);
      const mediaUrl = videoUrl || audioUrl;
      if (!mediaUrl) return NextResponse.json({ status: 'unavailable' }, { headers: { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie' } });
      return NextResponse.json({
        status: 'ready', mediaUrl, audioUrl: videoUrl ? audioUrl : null,
        mode: videoUrl ? 'video' : 'audio', isFinished,
      }, { headers: { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie' } });
    } catch {
      return NextResponse.json({ error: 'Playback availability temporarily unavailable' }, {
        status: 503, headers: { 'Cache-Control': 'no-store' },
      });
    }
  }
  if (env.FACTSPORT_ENVIRONMENT === 'staging') {
    return NextResponse.json({ error: 'V2 playback reader is not provisioned.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data: match, error } = await supabase
      .from('matches')
      .select('match_date, status, video_url, livestream_url, audio_url')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!match) return NextResponse.json({ status: 'unavailable' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });

    const status = String(match.status || '').toUpperCase();
    const isFinished = FINISHED.has(status);
    const isLive = LIVE.has(status);
    if (UNAVAILABLE.has(status)) return NextResponse.json({ status: 'unavailable' }, { headers: { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie' } });
    const matchTime = new Date(match.match_date).getTime();
    if (!Number.isFinite(matchTime)) return NextResponse.json({ status: 'unavailable' }, { status: 422, headers: { 'Cache-Control': 'no-store' } });

    const unlockAt = matchTime - 15 * 60 * 1000;
    if (!isFinished && !isLive && Date.now() < unlockAt) {
      return NextResponse.json({
        status: 'locked',
        unlockAt: new Date(unlockAt).toISOString(),
        mode: match.audio_url && !match.livestream_url ? 'audio' : 'video',
      }, { headers: { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie' } });
    }

    const videoSource = isFinished ? match.video_url : match.livestream_url;
    const audioSource = isFinished ? null : match.audio_url;
    const videoUrl = safePlaybackUrl(videoSource);
    const audioUrl = safePlaybackUrl(audioSource);
    const mediaUrl = videoUrl || audioUrl;
    if (!mediaUrl) {
      return NextResponse.json({ status: 'unavailable' }, { headers: { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie' } });
    }

    return NextResponse.json({
      status: 'ready',
      mediaUrl,
      audioUrl: videoUrl ? audioUrl : null,
      mode: videoUrl ? 'video' : 'audio',
      isFinished,
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie' } });
  } catch {
    return NextResponse.json({ error: 'Playback availability temporarily unavailable' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
