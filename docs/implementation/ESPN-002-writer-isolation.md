# ESPN writer database isolation

**Branch:** `refactor/factsport-v2` only. **Scope:** provision and verify a separate staging PostgreSQL role and Hyperdrive. No score ingestion worker or Cron is deployed by this step.

## Provisioned resources

- PostgreSQL role: `factsport_v2_espn_writer`
- Cloudflare Hyperdrive: `factsport-v2-espn-postgres`
- Hyperdrive ID: `c5166b8496624a80a0a77c750585c271`
- Azure database: `factsport_v2`; TLS required, SQL query cache disabled, origin pool limit five.
- The temporary administrator-backed bootstrap Worker was deleted after provisioning.

## Intended privilege boundary

The role can SELECT `public.matches` and UPDATE only `espn_id`, `home_score`, `away_score`, `status`, `match_events`, `stats`, `source_updated_at`, `updated_at` and `version`.

It cannot update team names, kickoff, source, points-distributed or other settlement fields. It cannot INSERT or DELETE matches and cannot read `app_users`, `external_identities` or `job_runs`. It is distinct from the read-only runtime role and schedule-only writer.

The provisioning workflow generated a random password and created the dedicated TLS-required Hyperdrive. A separate temporary verifier Worker connects as this role and checks actual database identity plus positive and negative privileges. That verifier is removed after the check. Verification passed in [run 42047371419](https://github.com/MketyDigital/Factsport/actions/runs/42047371419). The read-only reconciliation preview also connected successfully through this Hyperdrive in [run 42050234345](https://github.com/MketyDigital/Factsport/actions/runs/42050234345).

## Deliberate non-actions

No score ingestion worker, match-row update, Cron, ESPN ID reconciliation, production route, legacy ESPN/Supabase change, Azure Logic App activation, production DNS change or `main` branch commit. A separate reviewed ingestion implementation and staging canary remain required.


## 2026-11-06 preview-role separation

The ESPN writer role/Hyperdrive is reserved for a future score updater. The reconciliation and score-parity preview workers now use the already-provisioned read-only `factsport_v2_reader` runtime Hyperdrive (`895cca...`). Preview code must not use the column-limited writer identity merely because it only issues SELECT statements.
