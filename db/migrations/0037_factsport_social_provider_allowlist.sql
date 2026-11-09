-- The V2 dispatcher has four explicit provider adapters. Unknown provider names must fail closed.
BEGIN;

ALTER TABLE public.media_social_channels
  DROP CONSTRAINT IF EXISTS social_channel_provider_format,
  ADD CONSTRAINT social_channel_provider_format
    CHECK (provider IN ('meta','telegram','buffer','make'));

COMMIT;
