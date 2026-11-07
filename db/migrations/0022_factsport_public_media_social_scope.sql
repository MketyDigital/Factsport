-- Public Media social distribution is not a Prediction or bookmaker promotion channel.
-- Private Prediction distribution must use its own app/service and credentials.
BEGIN;

ALTER TABLE public.media_social_channels
  ADD COLUMN IF NOT EXISTS surface_scope text NOT NULL DEFAULT 'public_media';
ALTER TABLE public.media_social_channels
  DROP CONSTRAINT IF EXISTS media_social_channels_surface_scope_check,
  ADD CONSTRAINT media_social_channels_surface_scope_check
    CHECK (surface_scope = 'public_media');

ALTER TABLE public.media_social_publications
  ADD COLUMN IF NOT EXISTS distribution_scope text NOT NULL DEFAULT 'public_media',
  ADD COLUMN IF NOT EXISTS public_content_confirmed_by uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS public_content_confirmed_at timestamptz;

ALTER TABLE public.media_social_publications
  DROP CONSTRAINT IF EXISTS media_social_publications_distribution_scope_check,
  ADD CONSTRAINT media_social_publications_distribution_scope_check
    CHECK (distribution_scope = 'public_media');

ALTER TABLE public.media_social_publications
  DROP CONSTRAINT IF EXISTS media_social_publications_public_content_confirmation_check,
  ADD CONSTRAINT media_social_publications_public_content_confirmation_check
    CHECK (
      (public_content_confirmed_by IS NULL AND public_content_confirmed_at IS NULL)
      OR (public_content_confirmed_by IS NOT NULL AND public_content_confirmed_at IS NOT NULL)
    );

ALTER TABLE public.media_social_publications
  DROP CONSTRAINT IF EXISTS media_social_publications_public_delivery_requires_confirmation,
  ADD CONSTRAINT media_social_publications_public_delivery_requires_confirmation
    CHECK (
      status NOT IN ('scheduled', 'queued', 'publishing', 'published')
      OR (distribution_scope = 'public_media'
          AND public_content_confirmed_by IS NOT NULL
          AND public_content_confirmed_at IS NOT NULL)
    ) NOT VALID;

COMMIT;
