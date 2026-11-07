import 'server-only';

import { createClient } from '@/app/lib/supabase/server';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';

export type MediaEditorialCapability = 'read' | 'draft' | 'review' | 'publish' | 'archive' | 'media' | 'social';
export type MediaEditorialAuthorization =
  | { ok: true; user: { id: string; domainUserId: string; roles: string[] } }
  | { ok: false; status: 401 | 403; error: string };

const allowedRoles: Record<MediaEditorialCapability, string[]> = {
  read: ['writer', 'editor', 'publisher', 'social_manager', 'media_admin'],
  draft: ['writer', 'editor', 'publisher', 'media_admin'],
  review: ['editor', 'publisher', 'media_admin'],
  publish: ['publisher', 'media_admin'],
  archive: ['publisher', 'media_admin'],
  media: ['editor', 'publisher', 'media_admin'],
  social: ['social_manager', 'editor', 'publisher', 'media_admin'],
};

/**
 * Authentication is delegated to the configured identity provider session.
 * Authorization is resolved exclusively from Factsport's own PostgreSQL role
 * memberships and explicit external identity bridge; email/profile metadata is
 * never an authorization source.
 */
export async function authorizeMediaEditorialAction(
  capability: MediaEditorialCapability,
): Promise<MediaEditorialAuthorization> {
  let authUser;
  try {
    const supabase = createClient();
    const result = await supabase.auth.getUser();
    authUser = result.data.user;
    if (result.error || !authUser?.id) {
      return { ok: false, status: 401, error: 'Sign in with a verified Factsport identity.' };
    }
  } catch {
    return { ok: false, status: 401, error: 'Unable to verify the current identity session.' };
  }

  try {
    const memberships = await withFactsportEditorialPostgres(async sql => sql`
      WITH mapped AS (
        SELECT DISTINCT user_id
        FROM public.external_identities
        WHERE subject = ${authUser.id}
      )
      SELECT mapped.user_id,
        COALESCE(array_agg(DISTINCT membership.role_key)
          FILTER (WHERE membership.role_key IS NOT NULL), ARRAY[]::text[]) AS roles
      FROM mapped
      LEFT JOIN public.media_editorial_memberships membership
        ON membership.user_id = mapped.user_id AND membership.revoked_at IS NULL
      GROUP BY mapped.user_id
      LIMIT 2
    `);
    if (memberships.length !== 1) {
      return { ok: false, status: 403, error: 'This identity is not uniquely linked to a Factsport account.' };
    }
    const roles = memberships[0].roles as string[];
    if (!allowedRoles[capability].some(role => roles.includes(role))) {
      return { ok: false, status: 403, error: 'Your Factsport Media role does not permit this action.' };
    }
    return { ok: true, user: { id: authUser.id, domainUserId: memberships[0].user_id as string, roles } };
  } catch (error) {
    console.error('Media editorial authorization unavailable', error);
    return { ok: false, status: 503, error: 'Media authorization is not provisioned. No legacy admin fallback is allowed.' };
  }
}
