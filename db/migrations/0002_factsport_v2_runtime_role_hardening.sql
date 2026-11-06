-- Factsport v2 runtime-role hardening.
-- Apply only to the isolated factsport_v2 database after the three roles exist.
-- Staging execution is performed through the temporary Cloudflare admin-Hyperdrive
-- Worker in .github/workflows/v2-db-role-hardening.yml; never from a GitHub runner.

BEGIN;

ALTER ROLE factsport_v2_reader
  WITH LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 5;

ALTER ROLE factsport_v2_schedule_writer
  WITH LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 5;

ALTER ROLE factsport_v2_espn_writer
  WITH LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 5;

-- Fixture import never supplies live scores; only the ESPN writer may update them.
REVOKE INSERT (home_score, away_score)
  ON TABLE public.matches FROM factsport_v2_schedule_writer;

-- The runtime Workers do not need temporary tables. Revoke the default PUBLIC
-- TEMP privilege so it is not inherited by the three runtime roles.
REVOKE TEMP ON DATABASE factsport_v2 FROM PUBLIC;

COMMIT;
