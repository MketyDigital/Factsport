-- Explicit per-channel media capability; opt in only after provider adapter E2E.
BEGIN;

ALTER TABLE public.media_social_channels
  ADD COLUMN IF NOT EXISTS supports_media boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.media_social_channels.supports_media IS
  'Operator-confirmed provider capability. Keep false until the configured provider adapter has passed image upload/delivery E2E.';

COMMIT;
