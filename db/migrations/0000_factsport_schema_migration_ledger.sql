-- V2 forward-only migration ledger. No legacy rows are imported or restored.
-- The migration runner writes one checksum row per applied migration.
BEGIN;
CREATE TABLE IF NOT EXISTS public.factsport_schema_migrations (
  version integer PRIMARY KEY CHECK (version >= 0),
  filename text NOT NULL UNIQUE CHECK (filename ~ '^[0-9]{4}_[a-z0-9_]+\\.sql$'),
  checksum_sha256 char(64) NOT NULL CHECK (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  applied_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  applied_by name NOT NULL DEFAULT current_user
);
REVOKE ALL ON TABLE public.factsport_schema_migrations FROM PUBLIC;
COMMIT;
