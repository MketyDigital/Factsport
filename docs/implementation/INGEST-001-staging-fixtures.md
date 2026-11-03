# Factsport v2 — schedule ingestion in isolated staging

**Date:** 2026-11-03. **Branch:** `refactor/factsport-v2` only. Live production, DNS, GitHub scheduled ESPN jobs, Supabase, and Azure Logic Apps remain unchanged.

## Verified

1. `factsport_v2_schedule_writer` was created inside Azure database `factsport_v2` using a temporary, token-authenticated administrator-backed Cloudflare Worker. It has SQL-level permissions to read matches and insert/update **fixture fields only**. It cannot update `home_score`/`away_score`, DELETE matches, or read identity/points/job tables.
2. Separate writer Hyperdrive `factsport-v2-schedule-postgres` ID `eb634fef8bb443839fd0847c6c370f85` was created with a generated password, TLS required, origin pool limit 5, SQL query cache disabled. It is different from the runtime **read-only** `factsport-v2-runtime-postgres` Hyperdrive and the original migration/admin Hyperdrive.
3. The one-time setup run [41695514082](https://github.com/MketyDigital/Factsport/actions/runs/41695514082) passed; private bootstrap Worker `factsport-v2-schedule-writer-bootstrap` was **deleted after successful provisioning**. It imported 20 eligible Premier League fixtures out of 21 returned.
4. Multi-league run [41696052184](https://github.com/MketyDigital/Factsport/actions/runs/41696052184) passed. Additional eligible scheduled fixtures: La Liga 20, Bundesliga 18, Serie A 20, Ligue 1 18, Champions League 25. That's 101 additional successful writes, 121 fixture writes across the initial runs (a write is not necessarily a distinct new row).
5. The existing protected native staging app `factsport-v2-staging` was verified to return **nonempty Premier League fixture data** via `/api/matches` through the separate, read-only `FACTSPORT_HYPERDRIVE` ([41695925330](https://github.com/MketyDigital/Factsport/actions/runs/41695925330)).
6. The imported data shape is taken from football-data.org v4 competition matches, consistent with the legacy Factsport provider for fixture schedules. The import normalizer ignores `IN_PLAY`, `PAUSED`, `FINISHED`, `AWARDED`, unsupported statuses, invalid dates, and incomplete team names. All current imports use a -1/+21-day window and don't import scores.

## Data ownership and idempotency

- `api_id` is a unique provider match ID. The import uses `INSERT ... ON CONFLICT(api_id) DO UPDATE` so repeating imports cannot multiply rows with the same provider ID.
- Existing rows can only be refreshed when `source='football-data'`, no `espn_id` has been linked, points have not been distributed, and current status is a schedule-only state. Live, finished, ESPN-owned and settled match rows are never overwritten.
- SQL writer permissions independently prohibit score updates, deletions and private account reads. The public app uses **a different read-only role**.
- Name/time cross-provider reconciliation, ESPN score arbitration and any additional deduplication across a football-data ID and a separate ESPN ID are **not yet implemented**. Do not connect prize settlement or use these imports to override ESPN.
- R2 and match assets are independent; the importer references HTTPS crest URLs without copying them to R2.
- The staging import Worker's HTTP endpoints require a CI-generated token. No provider key or database password is committed; provider key is a Cloudflare Worker secret.

## Scheduling

`workers/factsport-schedule-sync.mjs` supports a Cloudflare scheduled handler for the six competitions, staggering provider calls seven seconds apart to stay comfortably below free-tier request limits. `wrangler.factsport-schedule-sync.jsonc` declares a **staging-only** cron at 03:15 and 15:15 UTC. **VERIFIED ACTIVE:** `.github/workflows/v2-schedule-cron.yml` completed successfully in GitHub Actions run [41696849300](https://github.com/MketyDigital/Factsport/actions/runs/41696849300). Cloudflare's Worker Script Schedules API returned the exact expected Cron expression, and the restricted writer's authorized health check passed while the unauthenticated check returned HTTP 404. This is a staging-only twice-daily schedule; no production ESPN/Logic Apps schedule was changed.

## Rollback

To stop **only** the new staging Cron, remove `triggers.crons` from `wrangler.factsport-schedule-sync.jsonc` and deploy the same Factsport Worker configuration, or remove its Cron Trigger in Cloudflare's dashboard. Do not delete the production ESPN/legacy schedules. The existing staging rows remain; never automatically DELETE fixture rows, R2 objects, or PostgreSQL roles on rollback.

## Remaining production gates

Live ESPN 3-second update parity, match ID reconciliation, end-to-end historical data, user auth migration, settlement idempotency, account privacy, private R2 media migration and supervised production cutover are still outstanding.
