# Factsport v2 — PostgreSQL first executable slice

Branch: `refactor/factsport-v2`. Never apply to `main` or a production database.

## Azure evidence
Server `mketypostgres`, database `factsport_v2`, region `westus`, PostgreSQL 18, B1ms. The GitHub `DATABASE_URL` repository secret is for Actions, **not automatically injected into Cloudflare**.

## Deployment sequence
1. Keep TLS required. Allow only the known, needed source egress IP ranges, never an all-Internet or all-Azure firewall rule. A GitHub-hosted runner does not have one fixed IP. Use a self-hosted runner on a controlled IP or a tunnel/approved network path for database operations. Avoid uploading admin credentials to arbitrary runners.
2. Create the dedicated limited PostgreSQL application role and grant only the necessary access **before using a runtime DATABASE_URL**. Do not use the Azure admin for normal app traffic.
3. Apply `db/migrations/0001_factsport_core.sql` to the empty `factsport_v2` database using an authenticated admin SQL client from an explicitly allowed source. Review SQL before applying. This migration creates the initial matches, identity mapping and job run tables only; it is NOT the whole Factsport schema.
4. Run `npm install` and `npm run db:check` from an allowed network using a read-only `DATABASE_URL`. `coreTablesFound` should equal 4.
5. Set `FACTSPORT_MATCHES_BACKEND=postgres` and a **separate runtime DATABASE_URL** in the staging server environment only. Keep flag unset for existing Supabase reads. Exercise `/api/matches?league=Premier%20League&type=fixtures&cursor=2026-11-01T00:00:00Z`.
6. Keep existing ESPN live polling / fixture provider priority and Azure Logic App disabled until parity, idempotency and auth tests pass.

## Constraints
- No secrets in git history, workflow logs or browser bundles.
- Feature flag is server-side only; no `NEXT_PUBLIC_` prefix.
- The first schema is intentionally empty; expect [] from the PostgreSQL query until a controlled sports-provider bootstrap is implemented.
- This code remains the Next.js verification baseline. Cloudflare Workers/vinext conversion and Hyperdrive integration are **not yet** deployed or verified.
- Existing GitHub Actions scheduled workflows still use legacy Supabase and AI configuration. They must be retired/refactored before production cutover.
- Shared B1ms has 2 GiB RAM; connection limit is deliberately small. Do not assume an unrestricted new PostgreSQL connection per request can support Cloudflare scale; use Hyperdrive/pooling before Worker cutover.
