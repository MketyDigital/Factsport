import postgres from 'postgres';
import { normalizeEspnScoreboardEvent } from '../lib/ingestion/factsport-espn-reconciliation.mjs';
import { compareLinkedEspnFixture } from '../lib/ingestion/factsport-espn-score-preview.mjs';

const COMPETITIONS = {
  'Premier League': 'eng.1',
  'La Liga': 'esp.1',
  'Bundesliga': 'ger.1',
  'Serie A': 'ita.1',
  'Ligue 1': 'fra.1',
  'Champions League': 'uefa.champions',
};

async function tokenValid(expected, actual) {
  if (!expected || !actual || expected.length > 4096 || actual.length > 4096) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(expected)),
    crypto.subtle.digest('SHA-256', enc.encode(actual)),
  ]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function dayKey(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10).replaceAll('-', '') : null;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      out[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return out;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/__internal/score-parity-preview') {
      return new Response('Not found', { status: 404 });
    }
    const auth = request.headers.get('Authorization') || '';
    if (!(await tokenValid(env.FACTSPORT_PREVIEW_TOKEN || '',
      auth.startsWith('Bearer ') ? auth.slice(7) : ''))) {
      return new Response('Not found', { status: 404 });
    }
    if (!env.FACTSPORT_HYPERDRIVE?.connectionString) {
      return Response.json({ ok: false, error: 'hyperdrive_missing' }, { status: 503 });
    }
    const sql = postgres(env.FACTSPORT_HYPERDRIVE.connectionString, {
      max: 1, fetch_types: false, prepare: true, connect_timeout: 10, idle_timeout: 5,
    });
    try {
      const [identity] = await sql`SELECT current_database() AS database, current_user AS role`;
      if (identity.database !== 'factsport_v2' || identity.role !== 'factsport_v2_espn_writer') {
        return Response.json({ ok: false, error: 'unexpected_database_identity' }, { status: 503 });
      }
      const fixtures = await sql`
        SELECT id::text, espn_id, league, home_team, away_team, match_date,
          home_score, away_score, status
        FROM public.matches
        WHERE league = ANY(${sql.array(Object.keys(COMPETITIONS))})
          AND match_date >= now() - interval '1 day'
          AND match_date < now() + interval '3 days'
          AND espn_id IS NOT NULL
          AND source = 'football-data'
          AND points_distributed = false
        ORDER BY match_date ASC
        LIMIT 500
      `;
      const groups = new Map();
      for (const fixture of fixtures) {
        const day = dayKey(fixture.match_date);
        if (!day) continue;
        const key = fixture.league + '|' + day;
        if (!groups.has(key)) groups.set(key, { league: fixture.league, day, fixtures: [] });
        groups.get(key).fixtures.push(fixture);
      }
      const proposals = [], providerErrors = [];
      let normalizedEvents = 0, inSyncCount = 0, unsupportedCount = 0;
      const providerResults = await mapLimit([...groups.values()], 3, async group => {
        const code = COMPETITIONS[group.league];
        const api = new URL(`https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/scoreboard`);
        api.searchParams.set('dates', group.day);
        api.searchParams.set('limit', '1000');
        try {
          const response = await fetch(api.toString(), {
            headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
            signal: AbortSignal.timeout(15000),
          });
          if (!response.ok) return { group, error: 'espn_http_' + response.status, events: [] };
          const body = await response.json();
          if (!Array.isArray(body.events)) return { group, error: 'invalid_scoreboard_payload', events: [] };
          return { group, events: body.events };
        } catch {
          return { group, error: 'espn_fetch_failed', events: [] };
        }
      });
      for (const result of providerResults) {
        const group = result.group;
        if (result.error) {
          providerErrors.push({ league: group.league, date: group.day, error: result.error });
          continue;
        }
        const byId = new Map();
        for (const raw of result.events) {
          const event = normalizeEspnScoreboardEvent(raw, group.league);
          if (event) { normalizedEvents++; byId.set(event.espn_id, event); }
        }
        for (const fixture of group.fixtures) {
          const event = byId.get(String(fixture.espn_id));
          if (!event) continue;
          const comparison = compareLinkedEspnFixture(fixture, event);
          if (comparison.outcome === 'unsupported_status') { unsupportedCount++; continue; }
          if (comparison.outcome === 'in_sync') { inSyncCount++; continue; }
          if (comparison.outcome === 'parity_difference') {
            proposals.push({
              fixture_id: fixture.id, espn_id: fixture.espn_id, league: fixture.league,
              home_team: fixture.home_team, away_team: fixture.away_team,
              current_status: fixture.status, expected_status: comparison.expectedStatus,
              current_home_score: fixture.home_score, current_away_score: fixture.away_score,
              expected_home_score: comparison.expectedHomeScore,
              expected_away_score: comparison.expectedAwayScore,
              score_changed: comparison.scoreChanged, status_changed: comparison.statusChanged,
            });
          }
        }
      }
      return Response.json({
        ok: providerErrors.length === 0, dryRun: true, writesPerformed: 0,
        database: 'factsport_v2', role: 'factsport_v2_espn_writer',
        linkedFixturesScanned: fixtures.length, scoreboardGroupsChecked: groups.size,
        normalizedEspnEvents: normalizedEvents, inSyncCount, unsupportedCount,
        proposedUpdateCount: proposals.length, providerErrors, proposals: proposals.slice(0, 100),
        proposalsTruncated: proposals.length > 100,
      }, { status: providerErrors.length ? 503 : 200, headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      const errorName = error && typeof error === 'object' && 'name' in error ? String(error.name) : 'unknown';
      return Response.json({ ok: false, error: 'score_parity_preview_failed',
        errorName: /^[A-Za-z0-9_]{1,40}$/.test(errorName) ? errorName : 'unknown',
        sqlState: /^[A-Z0-9]{5}$/.test(code) ? code : 'none' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } });
    } finally { await sql.end(); }
  },
};
