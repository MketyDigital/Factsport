import 'server-only';

import { createClient } from '@/app/lib/supabase/server';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';

export type MediaEditorialCapability = 'workspace' | 'read' | 'draft' | 'review' | 'publish' | 'archive' | 'media' | 'social';
export type MediaEditorialAuthorization =
  | { ok: true; user: { id: string; issuer: string; domainUserId: string; roles: string[] } }
  | { ok: false; status: 401 | 403 | 503; error: string };

const allowedRoles: Record<MediaEditorialCapability, string[]> = {
  workspace: ['writer', 'editor', 'publisher', 'social_manager', 'media_admin'],
  read: ['writer', 'editor', 'publisher', 'media_admin'],
  draft: ['writer', 'editor', 'publisher', 'media_admin'],
  review: ['editor', 'publisher', 'media_admin'],
  publish: ['publisher', 'media_admin'],
  archive: ['publisher', 'media_admin'],
  media: ['editor', 'publisher', 'media_admin'],
  social: ['social_manager', 'editor', 'publisher', 'media_admin'],
};

type VerifiedSessionIdentity = { issuer: string; subject: string };

/**
 * The provider session is verified by getUser(); issuer and subject are then
 * taken from the corresponding signed access-token claims and cross-checked.
 * Email and profile metadata are never identity-linking or authorization keys.
 */
function readSessionIdentity(accessToken: string, verifiedSubject: string): VerifiedSessionIdentity | null {
  const parts = accessToken.split('.');
  if (parts.length !== 3) return null;
  try {
    const encoded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')));
    if (typeof payload.iss !== 'string' || !payload.iss.trim() ||
        typeof payload.sub !== 'string' || payload.sub !== verifiedSubject) return null;
    return { issuer: payload.iss, subject: payload.sub };
  } catch {
    return null;
  }
}

/**
 * Authentication is delegated to the configured identity provider session.
 * Authorization is resolved exclusively from Factsport's issuer+subject bridge
 * and Factsport-owned PostgreSQL role memberships.
 */
export async function authorizeMediaEditorialAction(
  capability: MediaEditorialCapability,
): Promise<MediaEditorialAuthorization> {
  let identity: VerifiedSessionIdentity | null = null;
  try {
    const supabase = createClient();
    const [sessionResult, userResult] = await Promise.all([
      supabase.auth.getSession(),
      supabase.auth.getUser(),
    ]);
    const accessToken = sessionResult.data.session?.access_token;
    const verifiedUser = userResult.data.user;
    if (sessionResult.error || userResult.error || !accessToken || !verifiedUser?.id) {
      return { ok: false, status: 401, error: 'Sign in with a verified Factsport identity.' };
    }
    identity = readSessionIdentity(accessToken, verifiedUser.id);
    if (!identity) {
      return { ok: false, status: 401, error: 'The identity provider token is missing a valid issuer or subject claim.' };
    }
  } catch {
    return { ok: false, status: 401, error: 'Unable to verify the current identity session.' };
  }

  try {
    const memberships = await withFactsportEditorialPostgres(async sql => sql`
      WITH mapped AS (
        SELECT DISTINCT user_id
        FROM public.external_identities
        WHERE issuer = ${identity!.issuer}
          AND subject = ${identity!.subject}
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
      return { ok: false, status: 403, error: 'This issuer and subject are not uniquely linked to a Factsport account.' };
    }
    const roles = memberships[0].roles as string[];
    if (!allowedRoles[capability].some(role => roles.includes(role))) {
      return { ok: false, status: 403, error: 'Your Factsport Media role does not permit this action.' };
    }
    return {
      ok: true,
      user: { id: identity.subject, issuer: identity.issuer, domainUserId: memberships[0].user_id as string, roles },
    };
  } catch (error) {
    console.error('Media editorial authorization unavailable', error);
    return { ok: false, status: 503, error: 'Media authorization is not provisioned. No legacy admin fallback is allowed.' };
  }
}
