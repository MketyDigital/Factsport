-- Every new public article revision records an explicit publisher policy attestation.
BEGIN;

ALTER TABLE public.editorial_article_revisions
  ADD COLUMN IF NOT EXISTS public_media_policy_confirmed_by uuid
    REFERENCES public.app_users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS public_media_policy_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS public_media_policy_version text;

ALTER TABLE public.editorial_article_revisions
  DROP CONSTRAINT IF EXISTS editorial_revision_public_media_confirmation_pair,
  ADD CONSTRAINT editorial_revision_public_media_confirmation_pair
    CHECK (
      (public_media_policy_confirmed_by IS NULL
       AND public_media_policy_confirmed_at IS NULL
       AND public_media_policy_version IS NULL)
      OR
      (public_media_policy_confirmed_by IS NOT NULL
       AND public_media_policy_confirmed_at IS NOT NULL
       AND public_media_policy_version IS NOT NULL)
    );

COMMIT;
