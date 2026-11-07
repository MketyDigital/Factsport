-- Media editorial authorization is domain-owned, not email/profile metadata-owned.
-- Provision factsport_v2_media_access_admin before applying this migration.
BEGIN;

CREATE TABLE IF NOT EXISTS public.media_editorial_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  role_key text NOT NULL CHECK (role_key IN (
    'writer', 'editor', 'publisher', 'social_manager', 'media_admin'
  )),
  granted_by uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_by uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  revoked_at timestamptz,
  grant_reason text NOT NULL CHECK (char_length(grant_reason) BETWEEN 3 AND 500),
  revoke_reason text,
  CONSTRAINT media_editorial_membership_revocation CHECK (
    (revoked_at IS NULL AND revoked_by IS NULL AND revoke_reason IS NULL)
    OR (revoked_at IS NOT NULL AND revoked_by IS NOT NULL AND char_length(COALESCE(revoke_reason,'')) >= 3)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS media_editorial_memberships_active_unique
  ON public.media_editorial_memberships (user_id, role_key)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS media_editorial_memberships_user_idx
  ON public.media_editorial_memberships (user_id, role_key)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.media_editorial_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN (
    'draft_saved', 'submitted_for_review', 'review_approved',
    'published', 'archived', 'media_rights_reviewed',
    'social_scheduled', 'social_cancelled',
    'membership_granted', 'membership_revoked'
  )),
  article_id uuid REFERENCES public.editorial_articles(id) ON DELETE RESTRICT,
  revision_id uuid REFERENCES public.editorial_article_revisions(id) ON DELETE RESTRICT,
  target_user_id uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS media_editorial_audit_article_idx
  ON public.media_editorial_audit_events (article_id, created_at DESC);
CREATE INDEX IF NOT EXISTS media_editorial_audit_actor_idx
  ON public.media_editorial_audit_events (actor_user_id, created_at DESC);

REVOKE ALL ON public.media_editorial_memberships, public.media_editorial_audit_events
FROM PUBLIC, factsport_v2_reader, factsport_v2_schedule_writer,
  factsport_v2_espn_writer, factsport_v2_media_automation_writer,
  factsport_v2_social_dispatcher;

GRANT USAGE ON SCHEMA public TO factsport_v2_media_access_admin;
GRANT SELECT, INSERT, UPDATE ON public.media_editorial_memberships
  TO factsport_v2_media_access_admin;
GRANT SELECT, INSERT ON public.media_editorial_audit_events
  TO factsport_v2_media_access_admin;

GRANT SELECT ON public.media_editorial_memberships
  TO factsport_v2_editorial_writer;
GRANT SELECT, INSERT ON public.media_editorial_audit_events
  TO factsport_v2_editorial_writer;

COMMIT;
