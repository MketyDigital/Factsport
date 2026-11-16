/**
 * PostgreSQL-only public community read models.
 * Legacy Cloudflare D1 Workers are archived under docs/audit/legacy-source
 * and are never imported or queried here.
 */
import 'server-only';
import { withFactsportPostgres } from '@/lib/adapters/postgres-client';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validCommunityMatchId(id: unknown): id is string {
  return typeof id === 'string' && UUID.test(id);
}

export async function listPostgresPublicChatMessages(matchId: string) {
  if (!validCommunityMatchId(matchId)) throw new Error('Invalid match identifier');
  const rows = await withFactsportPostgres(sql => sql`
    SELECT c.id, c.username, c.avatar_url, c.message, c.created_at
    FROM public.public_media_match_chat_messages c
    WHERE c.match_id = (
      SELECT id FROM public.matches
      WHERE id = ${matchId}::uuid OR legacy_match_id = ${matchId}::uuid
      ORDER BY CASE WHEN id = ${matchId}::uuid THEN 0 ELSE 1 END
      LIMIT 1
    )
    ORDER BY c.created_at DESC, c.id DESC
    LIMIT 50
  `);
  return rows.reverse();
}

export async function listPostgresPublicMotmTotals(matchId: string) {
  if (!validCommunityMatchId(matchId)) throw new Error('Invalid match identifier');
  return withFactsportPostgres(sql => sql`
    SELECT m.player_name, m.votes
    FROM public.public_media_match_motm_totals m
    WHERE m.match_id = (
      SELECT id FROM public.matches
      WHERE id = ${matchId}::uuid OR legacy_match_id = ${matchId}::uuid
      ORDER BY CASE WHEN id = ${matchId}::uuid THEN 0 ELSE 1 END
      LIMIT 1
    )
    ORDER BY m.votes DESC, m.player_name ASC
    LIMIT 100
  `);
}
