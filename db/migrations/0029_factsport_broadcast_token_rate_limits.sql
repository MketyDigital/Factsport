-- Privacy-preserving rate-limit buckets for the public broadcast token issuer.
-- Only keyed hashes are stored; raw IP addresses and invite tokens are never persisted.
BEGIN;

CREATE TABLE IF NOT EXISTS public.media_broadcast_token_rate_limits (
  bucket_hash char(64) PRIMARY KEY CHECK (bucket_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS media_broadcast_token_rate_limits_updated_idx
  ON public.media_broadcast_token_rate_limits (updated_at);

REVOKE ALL ON public.media_broadcast_token_rate_limits
  FROM PUBLIC, factsport_v2_reader, factsport_v2_schedule_writer,
       factsport_v2_espn_writer, factsport_v2_editorial_writer,
       factsport_v2_media_broadcast_admin;
GRANT SELECT, INSERT, UPDATE ON public.media_broadcast_token_rate_limits
  TO factsport_v2_broadcast_token_issuer;

COMMIT;
