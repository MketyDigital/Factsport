# Factsport v2 — PostgreSQL first executable slice

Branch: `refactor/factsport-v2`. Never apply to `main` or a production database.

## Azure evidence
Server `mketypostgres`, database `factsport_v2`, region `westus`, PostgreSQL 18, B1ms. The GitHub `DATABASE_URL` repository secret is for Actions, **not automatically injected into Cloudflare**.

## Deployment sequence
1. Keep TLS required. Allow only the known, needed source egress IP ranges, never an all-Internet or all-Azure firewall rule. A GitHub-hosted runner does not have one fixed IP. Use a self-hosted runner on a controlled IP or a tunnel/approved network path for database operations. Avoid uploading admin credentials to arbitrary runners.
2. Create the dedicated limited PostgreSQL application role and grant only the necessary access **before using a runtime DATABASE_URL**. Do not use the Azure admin for normal app traffic.
3. **COMPLETED (2026-11-03):** Applied `db/migrations/0001_factsport_core.sql` to `factsport_v2` via a temporary GitHub-deployed Cloudflare Worker and existing Hyperdrive; all four core tables verified. Temporary migration Worker deleted successfully. Verified by GitHub Actions run `41669938819`. No Supabase rows imported or deleted. This migration is NOT the whole Factsport schema.
4. Run `npm install` and `npm run db:check` from an allowed network using a read-only `DATABASE_URL`. `coreTablesFound` should equal 4.
5. Set `FACTSPORT_MATCHES_BACKEND=postgres` and a **separate runtime DATABASE_URL** in the staging server environment only. Keep flag unset for existing Supabase reads. Exercise `/api/matches?league=Premier%20League&type=fixtures&cursor=2026-11-01T00:00:00Z`.
6. Keep existing ESPN live polling / fixture provider priority and Azure Logic App disabled until parity, idempotency and auth tests pass.

## Constraints
- No secrets in git history, workflow logs or browser bundles.
- Feature flag is server-side only; no `NEXT_PUBLIC_` prefix.
- The first schema is intentionally empty; expect [] from the PostgreSQL query until a controlled sports-provider bootstrap is implemented.
- This code remains the Next.js verification baseline. Cloudflare Workers/vinext conversion is not yet deployed; staging Hyperdrive and R2 bindings have been verified.
- Existing GitHub Actions scheduled workflows still use legacy Supabase and AI configuration. They must be retired/refactored before production cutover.
- Shared B1ms has 2 GiB RAM; connection limit is deliberately small. Do not assume an unrestricted new PostgreSQL connection per request can support Cloudflare scale; use Hyperdrive/pooling before Worker cutover.

## Verified staging infrastructure

- Cloudflare `factsport-v2-postgres` Hyperdrive ID `08cee41a81be4c3980450be9563af5e2`, binding `FACTSPORT_HYPERDRIVE`.
- Private R2 staging bucket `factsport-v2-media-staging`, binding `FACTSPORT_MEDIA_BUCKET`.
- Worker `factsport-v2-db-smoke` passed authenticated database and R2 probes in successful Actions run `41669938819`.
- The migration was fixed by removing `CREATE EXTENSION pgcrypto` because PostgreSQL 18 provides `gen_random_uuid()` without it. The temporary `factsport-v2-schema-bootstrap` Worker was deleted after migration.
- `v2-verify` TypeScript/regression workflow passed at commit `ac35d6d218abef1ad9ca8e3a7427c0d9b5767836` (run `41669955613`).
- Current Hyperdrive credential still uses initial administrator account. Introduce a dedicated least-privilege role before any live application traffic.
