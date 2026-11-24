import { NextResponse } from 'next/server';
import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';
import { isSameOriginRequest } from '@/app/lib/admin/authorization';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';
import { planMatchStory } from '@/lib/tv/match-story';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FINAL_STATUSES = new Set(['FT', 'FINISHED', 'AET', 'PEN']);
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };

/** Private TV Studio inventory. */
export async function GET() {
  const authorization = await authorizeMediaEditorialAction('tv');
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status, headers: PRIVATE_HEADERS });
  }

  try {
    const episodes = await withFactsportEditorialPostgres(sql => sql`
      SELECT id, show_format, match_id, revision, source_digest, status, title,
             duration_seconds, created_at, updated_at
      FROM public.factsport_tv_episodes
      ORDER BY updated_at DESC, id DESC
      LIMIT 100
    `);
    return NextResponse.json({ success: true, episodes }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error('Factsport TV episode inventory unavailable', error);
    return NextResponse.json({ error: 'TV Studio episode inventory is not connected.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}

/** Create an evidence-linked, rights-blocked draft from a canonical V2 match only. */
export async function POST(request: Request) {
  const authorization = await authorizeMediaEditorialAction('tv');
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status, headers: PRIVATE_HEADERS });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Same-origin request required.' }, { status: 403, headers: PRIVATE_HEADERS });
  }
  if (Number(request.headers.get('content-length') || 0) > 4096) {
    return NextResponse.json({ error: 'Request is too large.' }, { status: 413, headers: PRIVATE_HEADERS });
  }

  let matchId = '';
  try {
    const body = await request.json() as { matchId?: unknown };
    matchId = typeof body?.matchId === 'string' ? body.matchId.trim() : '';
  } catch {
    return NextResponse.json({ error: 'A valid match ID is required.' }, { status: 400, headers: PRIVATE_HEADERS });
  }
  if (!UUID.test(matchId)) {
    return NextResponse.json({ error: 'A valid match ID is required.' }, { status: 400, headers: PRIVATE_HEADERS });
  }

  try {
    const result = await withFactsportEditorialPostgres(sql => sql.begin(async tx => {
      const rows = await tx`
        SELECT id, league, home_team, away_team, home_score, away_score,
               status, source, source_updated_at, updated_at, version
        FROM public.matches
        WHERE id = ${matchId}::uuid
        FOR SHARE
      `;
      const match = rows[0];
      if (!match) return { kind: 'not_found' as const };

      const finalStatus = String(match.status || '').trim().toUpperCase();
      const homeScore = Number(match.home_score);
      const awayScore = Number(match.away_score);
      if (!FINAL_STATUSES.has(finalStatus) || !Number.isSafeInteger(homeScore) || homeScore < 0 ||
          !Number.isSafeInteger(awayScore) || awayScore < 0) {
        return { kind: 'needs_data' as const };
      }

      const sourceUpdated = match.source_updated_at || match.updated_at;
      const observedAt = sourceUpdated instanceof Date ? sourceUpdated.toISOString() : new Date(sourceUpdated).toISOString();
      const plan = await planMatchStory({
        matchId: String(match.id),
        homeTeam: String(match.home_team || '').slice(0, 100),
        awayTeam: String(match.away_team || '').slice(0, 100),
        competition: String(match.league || 'Football').slice(0, 120),
        finalScore: { home: homeScore, away: awayScore },
        finishedVerifiedAt: observedAt,
        facts: [{
          id: `final-score-${String(match.version || 0)}`,
          kind: 'score',
          text: `Verified full-time score: ${homeScore}–${awayScore}`,
          source: String(match.source || 'Factsport V2 canonical match record').slice(0, 160),
          observedAt,
          sourceUpdatedAt: observedAt,
          verified: true,
          homeScore,
          awayScore,
        }],
        // Provider/data and all media rights remain uncleared until an authorized review.
        rights: { dataCleared: false, assetsCleared: false },
      });
      const title = `${String(match.home_team).trim()} vs ${String(match.away_team).trim()} | Factsport Match Story`.slice(0, 240);
      const frozenSnapshot = {
        schemaVersion: 1,
        source: String(match.source || 'Factsport V2 canonical match record'),
        sourceUpdatedAt: observedAt,
        canonicalVersion: Number(match.version || 0),
        storyPlan: plan,
        readiness: { status: 'blocked_rights', reason: 'data_and_asset_rights_review_required' },
      };
      const idempotencyKey = `match_story:${String(match.id)}:${plan.sourceDigest}`;
      const inserted = await tx`
        INSERT INTO public.factsport_tv_episodes (
          show_format, match_id, source_digest, idempotency_key, status, title,
          snapshot, editorial_content, created_by, updated_by
        ) VALUES (
          'match_story', ${match.id}::uuid, ${plan.sourceDigest}, ${idempotencyKey},
          'blocked_rights', ${title}, ${JSON.stringify(frozenSnapshot)}::jsonb,
          ${JSON.stringify({ scriptStatus: 'not_started', audioStatus: 'not_started' })}::jsonb,
          ${authorization.user.domainUserId}::uuid, ${authorization.user.domainUserId}::uuid
        )
        ON CONFLICT DO NOTHING
        RETURNING id, show_format, match_id, revision, source_digest, status, title,
                  duration_seconds, created_at, updated_at
      `;
      let episode = inserted[0];
      const created = Boolean(episode);
      if (!episode) {
        const existing = await tx`
          SELECT id, show_format, match_id, revision, source_digest, status, title,
                 duration_seconds, created_at, updated_at
          FROM public.factsport_tv_episodes
          WHERE show_format = 'match_story' AND match_id = ${match.id}::uuid
            AND source_digest = ${plan.sourceDigest}
          ORDER BY revision DESC
          LIMIT 1
        `;
        episode = existing[0];
        if (!episode) throw new Error('tv_episode_idempotency_conflict');
      } else {
        await tx`
          INSERT INTO public.factsport_tv_audit_events (episode_id, actor_user_id, action, details)
          VALUES (
            ${episode.id}::uuid, ${authorization.user.domainUserId}::uuid,
            'episode_created', ${JSON.stringify({ showFormat: 'match_story', status: plan.status, sourceDigest: plan.sourceDigest })}::jsonb
          )
        `;
      }
      return { kind: 'ok' as const, created, episode };
    }));

    if (result.kind === 'not_found') {
      return NextResponse.json({ error: 'Canonical match was not found.' }, { status: 404, headers: PRIVATE_HEADERS });
    }
    if (result.kind === 'needs_data') {
      return NextResponse.json({ error: 'Only a verified final score can start a Match Story draft.' }, { status: 409, headers: PRIVATE_HEADERS });
    }
    return NextResponse.json({ success: true, episode: result.episode, duplicate: !result.created }, {
      status: result.created ? 201 : 200,
      headers: PRIVATE_HEADERS,
    });
  } catch (error) {
    console.error('Factsport TV episode creation failed', error);
    return NextResponse.json({ error: 'TV episode draft could not be created.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
