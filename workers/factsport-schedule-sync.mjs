/**
 * Ephemeral, token-protected staging fixture importer.
 * One allowed football-data.org competition per run; NO live or final scores.
 * Source precedence: skips ESPN-owned, live, and finished matches on conflicts.
 */
import postgres from 'postgres';
import { normalizeFactsportSchedule, factsportDateWindow,
  FACTSPORT_COMPETITIONS } from '../lib/ingestion/factsport-schedule.mjs';

async function authorized(request, token) {
  const raw = request.headers.get('Authorization') || '';
  const supplied = raw.startsWith('Bearer ') ? raw.slice(7) : '';
  if (!token || !supplied || token.length > 4096 || supplied.length > 4096) return false;
  const enc = new TextEncoder();
  const [aa, bb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(token)),
    crypto.subtle.digest('SHA-256', enc.encode(supplied)),
  ]);
  const a = new Uint8Array(aa), b = new Uint8Array(bb);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function database(env) {
  if (!env.FACTSPORT_HYPERDRIVE?.connectionString) throw new Error('Missing Hyperdrive');
  return postgres(env.FACTSPORT_HYPERDRIVE.connectionString, {
    max: 1, fetch_types: false, prepare: true, connect_timeout: 10, idle_timeout: 5,
  });
}

export default {
  async fetch(request, env) {
    const route = new URL(request.url);
    if (!['/__internal/schedule-sync', '/__internal/schedule-check'].includes(route.pathname) ||
        !['GET', 'POST'].includes(request.method) ||
        !(await authorized(request, env.FACTSPORT_SYNC_TOKEN))) {
      return new Response('Not found', { status: 404 });
    }
    const sql = database(env);
    try {
      const [identity] = await sql`
        SELECT current_database() = 'factsport_v2' AS correct_database,
          current_user = 'factsport_v2_schedule_writer' AS correct_role,
          has_table_privilege(current_user, 'public.matches', 'DELETE') AS can_delete,
          has_column_privilege(current_user, 'public.matches', 'home_score', 'UPDATE') AS can_update_scores
      `;
      if (!identity.correct_database || !identity.correct_role ||
          identity.can_delete || identity.can_update_scores) {
        return Response.json({ ok: false, error: 'unsafe_database_role' },
          { status: 503, headers: { 'Cache-Control': 'no-store' } });
      }
      if (route.pathname === '/__internal/schedule-check' && request.method === 'GET') {
        const [count] = await sql`
          SELECT count(*)::integer AS total FROM public.matches
          WHERE source = 'football-data' AND league = 'Premier League'
        `;
        return Response.json({ ok: true, writerRoleVerified: true,
          premierLeagueRows: Number(count.total) },
          { headers: { 'Cache-Control': 'no-store' } });
      }
      if (route.pathname !== '/__internal/schedule-sync' || request.method !== 'POST') {
        return new Response('Not found', { status: 404 });
      }
      const code = route.searchParams.get('competition');
      if (!Object.hasOwn(FACTSPORT_COMPETITIONS, code || '')) {
        return Response.json({ ok: false, error: 'unsupported_competition' }, { status: 400 });
      }
      const league = FACTSPORT_COMPETITIONS[code];
      const apiKey = env.FACTSPORT_FOOTBALL_DATA_KEY;
      if (!apiKey) return Response.json({ ok: false, error: 'provider_key_missing' }, { status: 503 });
      const window = factsportDateWindow(new Date(), 21);
      const api = new URL(`https://api.football-data.org/v4/competitions/${code}/matches`);
      api.searchParams.set('dateFrom', window.dateFrom);
      api.searchParams.set('dateTo', window.dateTo);
      const res = await fetch(api.toString(), {
        headers: { 'X-Auth-Token': apiKey, Accept: 'application/json' },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) {
        return Response.json({ ok: false, error: 'provider_request_failed', providerHttpStatus: res.status },
          { status: 503, headers: { 'Cache-Control': 'no-store' } });
      }
      const body = await res.json();
      if (!Array.isArray(body.matches) || body.matches.length > 1000) {
        return Response.json({ ok: false, error: 'provider_payload_invalid' },
          { status: 503, headers: { 'Cache-Control': 'no-store' } });
      }
      const now = new Date();
      const normalized = body.matches.map(raw => normalizeFactsportSchedule(raw, league, now))
        .filter(Boolean);
      let applied = 0;
      for (const match of normalized) {
        const saved = await sql`
          INSERT INTO public.matches (
            api_id, league, home_team, away_team, match_date, status,
            home_logo, away_logo, venue, stage, match_group, source, source_updated_at
          ) VALUES (
            ${match.api_id}, ${match.league}, ${match.home_team}, ${match.away_team},
            ${match.match_date}, ${match.status}, ${match.home_logo},
            ${match.away_logo}, ${match.venue}, ${match.stage},
            ${match.match_group}, 'football-data', now()
          )
          ON CONFLICT (api_id) DO UPDATE SET
            league = excluded.league,
            home_team = excluded.home_team,
            away_team = excluded.away_team,
            match_date = excluded.match_date,
            status = excluded.status,
            home_logo = excluded.home_logo,
            away_logo = excluded.away_logo,
            venue = excluded.venue,
            stage = excluded.stage,
            match_group = excluded.match_group,
            source_updated_at = now()
          WHERE public.matches.source = 'football-data'
            AND public.matches.espn_id IS NULL
            AND public.matches.status IN ('SCHEDULED','TBD','POSTPONED','SUSPENDED','CANCELLED')
            AND public.matches.points_distributed = false
          RETURNING id
        `;
        applied += saved.length;
      }
      return Response.json({ ok: true, competition: code, fetched: body.matches.length,
        eligible: normalized.length, applied, skipLiveAndFinished: true },
        { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      return Response.json({ ok: false, error: 'factsport_schedule_sync_failed',
        sqlState: /^[A-Z0-9]{5}$/.test(code) ? code : 'none' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } });
    } finally { await sql.end(); }
  },
};
