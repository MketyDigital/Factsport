/**
 * Public homepage read models. Every query targets a narrowly projected view;
 * no settings secrets, private analysis, settlement flags or unpublished media.
 * Each operation creates and closes its own request-scoped Hyperdrive client.
 */
import 'server-only';
import { withFactsportPostgres } from '@/lib/adapters/postgres-client';

export async function listPublicFeaturedMatches(input: { from: string; to: string; limit?: number }) {
  const from = new Date(input.from);
  const to = new Date(input.to);
  const limit = input.limit ?? 10;
  if (!Number.isFinite(from.valueOf()) || !Number.isFinite(to.valueOf()) || from >= to) {
    throw new Error('Invalid featured match window');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error('Invalid featured match limit');

  return withFactsportPostgres(sql => sql`
    SELECT id, league, home_team, away_team, home_score, away_score,
           match_date, status, home_logo, away_logo, venue, stage,
           match_group, espn_id, source, source_updated_at, version,
           is_featured, featured_rank, season
    FROM public.public_featured_matches
    WHERE match_date >= ${from.toISOString()} AND match_date <= ${to.toISOString()}
    ORDER BY featured_rank ASC, match_date ASC, id ASC
    LIMIT ${limit}
  `);
}

export async function listPublicMatchHighlights(limit = 5) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error('Invalid highlight limit');
  return withFactsportPostgres(async sql => {
    const rows = await sql`
      SELECT highlight_id, match_id, league, home_team, away_team,
             home_logo, away_logo, provider, title, description,
             canonical_url, embed_url, published_at, thumbnail_media_key,
             attribution_text
      FROM public.public_match_highlights
      ORDER BY published_at DESC, highlight_id DESC
      LIMIT ${limit}
    `;
    return rows.map((row: any) => ({
      ...row,
      id: row.match_id,
      thumbnail_url: row.thumbnail_media_key ? `/api/media/${row.thumbnail_media_key}` : null,
    }));
  });
}

export async function getPublicMediaStudioSettings() {
  return withFactsportPostgres(async sql => {
    const rows = await sql`
      SELECT title, audio_url, video_url, is_active, room_name,
             public_listening_enabled, callin_enabled
      FROM public.public_media_studio_settings
      LIMIT 1
    `;
    return rows[0] ?? null;
  });
}

export async function getPublicHomepageSettings() {
  return withFactsportPostgres(async sql => {
    const rows = await sql`
      SELECT featured_match_id, announcement_text, announcement_link, announcement_enabled
      FROM public.public_homepage_settings
      LIMIT 1
    `;
    return rows[0] ?? null;
  });
}

export async function listCurrentCompetitionStandings(leagueCode: string) {
  if (!/^[A-Z0-9_-]{1,16}$/.test(leagueCode)) throw new Error('Invalid league code');
  return withFactsportPostgres(sql => sql`
    SELECT league_code, league_name, season, match_group, team_id,
           team_name, team_short_name, team_crest, position,
           played_games, won, draw, lost, goals_for, goals_against,
           goal_difference, points, source_updated_at
    FROM public.public_competition_standings
    WHERE league_code = ${leagueCode}
    ORDER BY match_group ASC, position ASC, team_id ASC
  `);
}

export async function listPublicHighlightLeagues() {
  return withFactsportPostgres(async sql => {
    const rows = await sql`
      SELECT DISTINCT league
      FROM public.public_match_highlights
      WHERE league IS NOT NULL AND length(league) <= 100
      ORDER BY league ASC
    `;
    return rows.map((row: any) => String(row.league));
  });
}

export async function countPublicMatchHighlights(league?: string | null) {
  const normalizedLeague = league && league !== 'All' ? league.trim() : null;
  if (normalizedLeague && normalizedLeague.length > 80) throw new Error('Invalid highlight league');
  return withFactsportPostgres(async sql => {
    const rows = normalizedLeague
      ? await sql`
          SELECT count(*)::integer AS total_count
          FROM public.public_match_highlights
          WHERE league ILIKE ${'%' + normalizedLeague + '%'}
        `
      : await sql`
          SELECT count(*)::integer AS total_count
          FROM public.public_match_highlights
        `;
    return Number(rows[0]?.total_count ?? 0);
  });
}

export async function listPublicMatchHighlightsPage(input: {
  league?: string | null; limit?: number; offset?: number;
}) {
  const limit = input.limit ?? 12;
  const offset = input.offset ?? 0;
  const league = input.league && input.league !== 'All' ? input.league.trim() : null;
  if (league && league.length > 80) throw new Error('Invalid highlight league');
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error('Invalid highlight page size');
  if (!Number.isInteger(offset) || offset < 0 || offset > 5000) throw new Error('Invalid highlight offset');
  return withFactsportPostgres(async sql => {
    const rows = league
      ? await sql`
          SELECT highlight_id, match_id, league, home_team, away_team,
                 home_logo, away_logo, home_score, away_score, match_date,
                 provider, title, description, canonical_url, embed_url,
                 published_at, thumbnail_media_key, attribution_text
          FROM public.public_match_highlights
          WHERE league ILIKE ${'%' + league + '%'}
          ORDER BY published_at DESC, highlight_id DESC
          LIMIT ${limit} OFFSET ${offset}
        `
      : await sql`
          SELECT highlight_id, match_id, league, home_team, away_team,
                 home_logo, away_logo, home_score, away_score, match_date,
                 provider, title, description, canonical_url, embed_url,
                 published_at, thumbnail_media_key, attribution_text
          FROM public.public_match_highlights
          ORDER BY published_at DESC, highlight_id DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
    return rows.map((row: any) => ({
      ...row,
      id: row.match_id,
      thumbnail_url: row.thumbnail_media_key ? `/api/media/${row.thumbnail_media_key}` : null,
    }));
  });
}

export async function listCurrentCompetitionPlayerLeaders(
  leagueCode: string,
  stat: 'goals' | 'assists',
  limit = 5
) {
  if (!/^[A-Z0-9_-]{1,16}$/.test(leagueCode)) throw new Error('Invalid league code');
  if (stat !== 'goals' && stat !== 'assists') throw new Error('Invalid player statistic');
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new Error('Invalid player leader limit');
  return withFactsportPostgres(sql => {
    if (stat === 'goals') {
      return sql`
        SELECT player_id, player_name, team_name, team_short_name, team_crest,
               goals AS value, assists, source_updated_at
        FROM public.public_competition_player_stats
        WHERE league_code = ${leagueCode} AND goals > 0
        ORDER BY goals DESC, assists DESC, player_name ASC, player_id ASC
        LIMIT ${limit}
      `;
    }
    return sql`
      SELECT player_id, player_name, team_name, team_short_name, team_crest,
             assists AS value, goals, source_updated_at
      FROM public.public_competition_player_stats
      WHERE league_code = ${leagueCode} AND assists > 0
      ORDER BY assists DESC, goals DESC, player_name ASC, player_id ASC
      LIMIT ${limit}
    `;
  });
}

export async function listCurrentCompetitionDirectory() {
  return withFactsportPostgres(sql => sql`
    SELECT league_code, league_name, season,
           count(DISTINCT team_id)::integer AS team_count,
           count(DISTINCT match_group)::integer AS group_count,
           max(source_updated_at) AS source_updated_at
    FROM public.public_competition_standings
    GROUP BY league_code, league_name, season
    ORDER BY league_name ASC, season DESC
  `);
}
