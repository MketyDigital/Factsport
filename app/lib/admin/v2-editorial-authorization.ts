import 'server-only';

import { cookies } from 'next/headers';
import { entraCookieNames, readFactsportEntraSession } from '@/lib/auth/entra-external';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';

export type MediaEditorialCapability = 'workspace' | 'read' | 'draft' | 'review' | 'publish' | 'archive' | 'media' | 'social' | 'broadcast';
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
  broadcast: ['media_admin'],
};

/**
 * Entra ID token is verified at callback and the encrypted, expiring Factsport
 * session is authenticated again for every protected Media request.
 */
export async function authorizeMediaEditorialAction(
  capability: MediaEditorialCapability,
): Promise<MediaEditorialAuthorization> {
  let identity: { issuer: string; subject: string } | null = null;
  let internalUserId: string | null = null;
  try {
    const session = await readFactsportEntraSession(cookies().get(entraCookieNames.session)?.value);
    if (!session) return { ok: false, status: 401, error: 'Sign in with your Factsport Media identity.' };
    identity = { issuer: session.issuer, subject: session.subject };
    internalUserId = session.internalUserId;
  } catch {
    return { ok: false, status: 401, error: 'Unable to verify the Factsport Media session.' };
  }
  try {
    const memberships = await withFactsportEditorialPostgres(async sql => sql`
      WITH mapped AS (
        SELECT DISTINCT user_id
        FROM public.external_identities
        WHERE issuer = ${identity!.issuer}
          AND subject = ${identity!.subject}
          AND user_id = ${internalUserId!}::uuid
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
