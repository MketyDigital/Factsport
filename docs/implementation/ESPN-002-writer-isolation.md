# ESPN writer database isolation

**Branch:** `refactor/factsport-v2` only. **Scope:** provision and verify a separate staging PostgreSQL role and Hyperdrive. No score ingestion worker or Cron is deployed by this step.

## Intended privilege boundary

The role `factsport_v2_espn_writer` can SELECT `public.matches` and UPDATE only:
- `espn_id` (for later reviewed unique reconciliation)
- `home_score`, `away_score`, `status`
- `match_events`, `stats`
- `source_updated_at`, `updated_at`, `version`

It cannot update team names, kickoff, source, points-distributed or other settlement fields. It cannot INSERT or DELETE matches and cannot read `app_users`, `external_identities` or `job_runs`. It is distinct from both the read-only runtime role and schedule-only writer.

The one-time workflow uses the existing administrator Hyperdrive only through a token-protected temporary bootstrap Worker, generates a random role password, creates a TLS-required Hyperdrive with SQL caching disabled and origin pool limit five, and removes the temporary bootstrap Worker. The workflow refuses to reset an existing Hyperdrive of the same name.

## Deliberate non-actions

This provisioning does not deploy score polling, change match rows, create a Cron, reconcile/link any ESPN IDs, write scores, alter legacy ESPN/Supabase jobs, activate Azure Logic Apps, change production DNS, or touch `main`. A separate reviewed ingestion implementation and staging canary remain required.
