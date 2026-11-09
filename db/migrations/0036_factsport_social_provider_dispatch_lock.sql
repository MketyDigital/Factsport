-- A single provider call may be started per claimed delivery attempt.
-- A crashed/ambiguous provider call is reconciled as unknown_result, never blindly replayed.
BEGIN;

ALTER TABLE public.media_social_delivery_attempts
  ADD COLUMN IF NOT EXISTS provider_started_at timestamptz;

GRANT UPDATE (provider_started_at)
  ON public.media_social_delivery_attempts TO factsport_v2_social_dispatcher;

COMMIT;
