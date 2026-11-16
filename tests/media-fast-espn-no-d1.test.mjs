import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeLegacyEspnSummary } from '../lib/live/legacy-espn-summary.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = pathname => fs.readFileSync(path.join(root, pathname), 'utf8');

function sample(score = null) {
  return {
    header: { competitions: [{
      competitors: [
        { homeAway: 'home', score, team: { id: '1', displayName: 'Home FC' } },
        { homeAway: 'away', score: '2', team: { id: '2', displayName: 'Away FC' } },
      ],
      status: { type: { state: 'in', description: 'In Progress' }, displayClock: "72'" },
      series: { summary: 'Leg two' },
    }] },
    gameInfo: { venue: { fullName: 'Test Stadium' }, officials: [{ displayName: 'Referee 1' }] },
    boxscore: {
      teams: [
        { team: { id: '1' }, statistics: [{ name: 'possessionPct', displayValue: '55%' }] },
        { team: { id: '2' }, statistics: [{ name: 'wonCorners', displayValue: '3' }] },
      ],
      rosters: [
        { team: { id: '1' }, formation: '4-3-3',
          athletes: [{ athlete: { displayName: 'Player A' }, jersey: '9', starter: true }] },
      ],
    },
    commentary: [
      { id: 'event-1', text: 'Goal! Player A scored', time: { displayValue: "72'" },
        play: { type: { text: 'goal' }, participants: [{ athlete: { displayName: 'Player A' } }] } },
      { text: 'Yellow card for Player A', time: { displayValue: "70'" }, play: { type: { text: 'card' } } },
    ],
  };
}

test('original ESPN content mapping retains rich Media fields and stable event IDs', () => {
  const a = normalizeLegacyEspnSummary(sample(), '12345');
  const b = normalizeLegacyEspnSummary(sample(), '12345');
  assert.equal(a.status, 'LIVE');
  assert.equal(a.home_score, null, 'missing ESPN score must not become an invented zero');
  assert.equal(a.away_score, 2);
  assert.equal(a.venue, 'Test Stadium');
  assert.equal(a.referees[0], 'Referee 1');
  assert.equal(a.stats.home.possession, '55%');
  assert.equal(a.stats.away.corners, '3');
  assert.equal(a.lineups.formations.home, '4-3-3');
  assert.equal(a.lineups.home[0].name, 'Player A');
  assert.ok(a.match_events.length >= 2);
  assert.deepEqual(a.events, a.match_events);
  assert.deepEqual(a.events.map(event => event.id), b.events.map(event => event.id));
  assert.equal(a.events.filter(event => event.type === 'goal').length, 1);
});

test('ESPN score validator rejects blanks and invalid scores, preserves zero', () => {
  assert.equal(normalizeLegacyEspnSummary(sample('0'), '12345').home_score, 0);
  assert.equal(normalizeLegacyEspnSummary(sample('bad'), '12345').home_score, null);
  assert.equal(normalizeLegacyEspnSummary(sample('-1'), '12345').home_score, null);
  assert.equal(normalizeLegacyEspnSummary(sample('150'), '12345').home_score, null);
  assert.throws(() => normalizeLegacyEspnSummary({}, '12345'), /Match data unavailable/);
  assert.throws(() => normalizeLegacyEspnSummary(sample(), '../invalid'), /Invalid ESPN identity/);
});

test('fast ESPN route is canonically keyed, gated, cached and D1-free', () => {
  const route = read('app/api/media/live/matches/[id]/route.ts');
  const normalizer = read('lib/live/legacy-espn-summary.mjs');
  const cloudflareTypes = read('types/factsport-cloudflare-workers.d.ts');
  assert.match(route, /FACTSPORT_FAST_LIVE_BACKEND/);
  assert.match(route, /FACTSPORT_MATCH_DETAIL_BACKEND/);
  assert.match(route, /getPostgresMatchById\(params\.id\)/);
  assert.match(route, /espn_id/);
  assert.match(route, /AbortSignal\.timeout\(3500\)/);
  assert.match(route, /1_250_000/);
  assert.match(route, /edgeCache\.match\(cacheKey\)/);
  assert.match(route, /edgeCache\.put\(cacheKey/);
  assert.match(route, /source: 'postgres_snapshot'/);
  assert.match(route, /stale: true/);
  assert.match(route, /source: 'espn_fast'/);
  assert.match(route, /stale: false/);
  assert.match(route, /if \(\['LIVE', 'HT'/);
  assert.match(route, /return 3600/);
  assert.match(cloudflareTypes, /FACTSPORT_FAST_LIVE_BACKEND/);
  assert.doesNotMatch(route, /env\.DB|D1Database|d1_databases|\/api\/motm|SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(normalizer, /env\.DB|caches\.default|randomUUID|\.prepare\(/);
});


test('frontend fast ESPN reader uses verified canonical match ID and never calls the archived external Worker', () => {
  const fetcher = read('app/utils/liveFetcher.ts');
  const provider = read('app/providers/MatchLiveProvider.tsx');
  const page = read('app/match/[id]/page.tsx');
  const label = read('app/components/LiveScoreLabel.tsx');
  assert.match(fetcher, /NEXT_PUBLIC_FACTSPORT_FAST_LIVE_BACKEND !== 'postgres'/);
  assert.match(fetcher, /MATCH_UUID\.test\(matchId\)/);
  assert.match(fetcher, /'\/api\/media\/live\/matches\/'/);
  assert.doesNotMatch(fetcher, /live-api\.factsport\.com|env\.DB|D1Database/);
  assert.match(fetcher, /const key = 'match:' \+ matchId/);
  assert.match(provider, /fetchLiveMatchDeduplicated\(espnId, matchId\)/);
  assert.match(page, /<MatchLiveProvider matchId=\{dbData\.id\}/);
  assert.match(label, /fetchLiveMatchDeduplicated\(espnId, matchId\)/);
});

test('frontend refuses stale database fallbacks rather than regressing live updates', () => {
  const provider = read('app/providers/MatchLiveProvider.tsx');
  const label = read('app/components/LiveScoreLabel.tsx');
  assert.match(provider, /data\.stale !== true/);
  assert.match(label, /matchData\.stale !== true/);
  const route = read('app/api/media/live/matches/[id]/route.ts');
  assert.match(route, /lastStoredSnapshot\(match, servedAt\)/);
  assert.match(route, /stale: true/);
});
