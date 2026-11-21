import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import { getPostgresMatchById } from '@/lib/adapters/postgres-matches';
import { normalizeLegacyEspnSummary } from '@/lib/live/legacy-espn-summary.mjs';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ESPN_ID = /^[a-zA-Z0-9_-]{1,32}$/;
const NO_STORE = { 'Cache-Control': 'no-store' };
type WorkerCache = CacheStorage & { default?: Cache };

function cacheSeconds(status: string) {
  const state = status.toUpperCase();
  if (['LIVE', 'HT', 'IN_PLAY', '1H', '2H', 'ET', 'P'].includes(state)) return 3;
  if (['FT', 'FINISHED', 'POST', 'ENDED', 'AET', 'PEN', 'AWARDED', 'ABD'].includes(state)) return 3600;
  return 60;
}

function lastStoredSnapshot(match: Record<string, any>, servedAt: string) {
  return {
    id: match.id,
    espn_id: match.espn_id,
    status: match.status,
    home_score: match.home_score,
    away_score: match.away_score,
    displayClock: match.display_clock || '',
    match_events: match.match_events || [],
    events: match.match_events || [],
    stats: match.stats || {},
    lineups: match.lineups || {},
    venue: match.venue || null,
    referees: match.referees || [],
    source: 'postgres_snapshot',
    observedAt: match.source_updated_at || null,
    servedAt,
    stale: true,
  };
}

const failed = () => NextResponse.json(
  { error: 'Fast match data is not enabled.' }, { status: 503, headers: NO_STORE },
);

/**
 * Canonical-match-keyed public viewer path.
 *
 * The old uploaded fast Worker is preserved as an inert .js.txt source, not
 * imported. ESPN provider requests never access the former D1 MOTM tables.
 * DB background ingestion and social outbox remain separate workflows.
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  if ((env.FACTSPORT_FAST_LIVE_BACKEND ?? process.env.FACTSPORT_FAST_LIVE_BACKEND) !== 'postgres' ||
      (env.FACTSPORT_MATCH_DETAIL_BACKEND ?? process.env.FACTSPORT_MATCH_DETAIL_BACKEND) !== 'postgres') {
    return failed();
  }
  if (!UUID.test(params.id)) {
    return NextResponse.json({ error: 'Invalid match identifier.' }, { status: 400, headers: NO_STORE });
  }

  let match: Record<string, any> | null;
  try {
    match = await getPostgresMatchById(params.id);
  } catch {
    return NextResponse.json({ error: 'Match reader unavailable.' }, { status: 503, headers: NO_STORE });
  }
  if (!match) return NextResponse.json({ error: 'Match not found.' }, { status: 404, headers: NO_STORE });

  const servedAt = new Date().toISOString();
  const espnId = String(match.espn_id || '');
  if (!ESPN_ID.test(espnId)) {
    return NextResponse.json(lastStoredSnapshot(match, servedAt), { headers: NO_STORE });
  }

  const isStaging = env.FACTSPORT_ENVIRONMENT === 'staging';
  const cacheKeyUrl = new URL(request.url);
  cacheKeyUrl.pathname = '/api/media/live/matches/' + match.id;
  cacheKeyUrl.search = '?espn=' + encodeURIComponent(espnId);
  const cacheKey = new Request(cacheKeyUrl.toString(), { method: 'GET' });
  const edgeCache = isStaging
    ? undefined
    : (globalThis as typeof globalThis & { caches?: WorkerCache }).caches?.default;

  if (edgeCache) {
    try {
      const hit = await edgeCache.match(cacheKey);
      if (hit) {
        const cached = await hit.json() as Record<string, any>;
        const ttl = cacheSeconds(String(cached.status || ''));
        const publicCached = { ...cached, servedAt,
          stale: !cached.observedAt || Date.now() - Date.parse(cached.observedAt) > ttl * 1000,
        };
        delete publicCached.predictor;
        return NextResponse.json(publicCached, { headers: { 'Cache-Control': `public, max-age=0, s-maxage=${ttl}` } });
      }
    } catch {
      // A cache fault is not an ESPN outage; continue to the provider.
    }
  }

  try {
    const upstreamUrl = 'https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=' + encodeURIComponent(espnId);
    const response = await fetch(upstreamUrl, {
      signal: AbortSignal.timeout(3500),
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok || Number(response.headers.get('content-length') || 0) > 1_250_000) {
      throw new Error('ESPN summary unavailable or too large');
    }
    const raw = await response.text();
    if (raw.length > 1_250_000) throw new Error('ESPN summary exceeded safe size');
    const normalized = normalizeLegacyEspnSummary(JSON.parse(raw), espnId);
    const observedAt = new Date().toISOString();
    const ttl = cacheSeconds(normalized.status);
    const payload = { ...normalized, id: match.id, espn_id: espnId, source: 'espn_fast',
      observedAt, stale: false };
    delete payload.predictor;
    if (edgeCache) {
      try {
        await edgeCache.put(cacheKey, new Response(JSON.stringify(payload), {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=0, s-maxage=${ttl}` },
        }));
      } catch {
        // Cache/storage faults should not block a valid ESPN response.
      }
    }
    return NextResponse.json({ ...payload, servedAt }, {
      headers: { 'Cache-Control': isStaging ? 'private, no-store, max-age=0'
        : `public, max-age=0, s-maxage=${ttl}` },
    });
  } catch {
    // Do not invent fresh data when ESPN is unavailable or unmatched.
    return NextResponse.json(lastStoredSnapshot(match, servedAt), { headers: NO_STORE });
  }
}
