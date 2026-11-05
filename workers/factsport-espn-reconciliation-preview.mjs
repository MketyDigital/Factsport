import postgres from 'postgres';
import { normalizeEspnScoreboardEvent, findUniqueEspnFixtureCandidate } from '../lib/ingestion/factsport-espn-reconciliation.mjs';

const COMPETITIONS = {
  'Premier League': 'eng.1',
  'La Liga': 'esp.1',
  'Bundesliga': 'ger.1',
  'Serie A': 'ita.1',
  'Ligue 1': 'fra.1',
  'Champions League': 'uefa.champions',
};
const SCHEDULE_STATUSES = ['SCHEDULED', 'TBD', 'POSTPONED', 'SUSPENDED', 'PRE', 'PRE_MATCH', 'TIMED'];

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

function dayKey(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString().slice(0, 10).replaceAll('-', '');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.pathname !== '/__internal/reconciliation-preview') {
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
        SELECT id::text, league, home_team, away_team, match_date,
          espn_id, source, status, points_distributed
        FROM public.matches
        WHERE league = ANY(${Object.keys(COMPETITIONS)})
          AND match_date >= now() - interval '1 day'
          AND match_date < now() + interval '7 days'
          AND espn_id IS NULL
          AND source = 'football-data'
          AND points_distributed = false
          AND status = ANY(${SCHEDULE_STATUSES})
        ORDER BY match_date ASC
        LIMIT 500
      `;
      const fixtureGroups = new Map();
      for (const fixture of fixtures) {
        const day = dayKey(fixture.match_date);
        if (!day) continue;
        const key = fixture.league + '|' + day;
        if (!fixtureGroups.has(key)) fixtureGroups.set(key, { league: fixture.league, day, fixtures: [] });
        fixtureGroups.get(key).fixtures.push(fixture);
      }
      const groups = [...fixtureGroups.values()];
      const providerResults = await mapLimit(groups, 3, async group => {
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
      const proposals = [];
      let normalizedEvents = 0, noMatch = 0, ambiguous = 0;
      const providerErrors = [];
      for (const result of providerResults) {
        if (result.error) {
          providerErrors.push({ league: result.group.league, date: result.group.day, error: result.error });
          continue;
        }
        for (const raw of result.events) {
          const event = normalizeEspnScoreboardEvent(raw, result.group.league);
          if (!event) continue;
          normalizedEvents++;
          const candidate = findUniqueEspnFixtureCandidate(event, result.group.fixtures);
          if (candidate.outcome === 'no_match') noMatch++;
          else if (candidate.outcome === 'ambiguous') ambiguous++;
          else proposals.push({
            fixture_id: candidate.candidate.id,
            espn_id: event.espn_id,
            league: event.league,
            home_team: event.home_team,
            away_team: event.away_team,
            match_date: candidate.candidate.match_date,
            kickoff_delta_minutes: Math.round((event.kickoff_ms - Date.parse(candidate.candidate.match_date)) / 60000),
            espn_status: event.status,
            home_score: event.home_score,
            away_score: event.away_score,
          });
        }
      }
      const fixtureCounts = new Map(), eventCounts = new Map();
      for (const proposal of proposals) {
        fixtureCounts.set(proposal.fixture_id, (fixtureCounts.get(proposal.fixture_id) || 0) + 1);
        eventCounts.set(proposal.espn_id, (eventCounts.get(proposal.espn_id) || 0) + 1);
      }
      const unique = proposals.filter(p => fixtureCounts.get(p.fixture_id) === 1 && eventCounts.get(p.espn_id) === 1);
      ambiguous += proposals.length - unique.length;
      return Response.json({
        ok: providerErrors.length === 0,
        dryRun: true,
        writesPerformed: 0,
        database: 'factsport_v2',
        role: 'factsport_v2_espn_writer',
        fixtureRowsScanned: fixtures.length,
        scoreboardGroupsChecked: groups.length,
        normalizedEspnEvents: normalizedEvents,
        uniqueCandidateCount: unique.length,
        ambiguousCount: ambiguous,
        noMatchCount: noMatch,
        providerErrors,
        candidates: unique.slice(0, 100),
        candidatesTruncated: unique.length > 100,
      }, { status: providerErrors.length ? 503 : 200, headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      return Response.json({ ok: false, error: 'reconciliation_preview_failed',
        sqlState: /^[A-Z0-9]{5}$/.test(code) ? code : 'none' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } });
    } finally { await sql.end(); }
  },
};
