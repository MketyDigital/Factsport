# Factsport v2 PostgreSQL runtime hardening

Branch: `refactor/factsport-v2`. Completed 2026-11-03. No changes made to main or live domain.

## Verified results

- Admin-backed migration Hyperdrive: `factsport-v2-postgres`, ID `08cee41a81be4c3980450be9563af5e2`. Retained for controlled migration operations only; **not bound to the live staging application**.
- PostgreSQL role: `factsport_v2_reader`. Has `CONNECT` to `factsport_v2`, `USAGE` on `public`, and `SELECT` on `public.matches`. It has **no INSERT on matches, no SELECT on app_users**, and no direct privileges on the two other auth/job tables.
- Runtime Hyperdrive: `factsport-v2-runtime-postgres`, ID `895cca4c06104b8ab9f7c1b72a8ba18f`.
- Runtime Hyperdrive: SQL caching disabled, 5 origin connections, TLS require.
- GitHub Actions one-time setup run [41675097638](https://github.com/MketyDigital/Factsport/actions/runs/41675097638) passed all stages. It verified the original Azure admin URL's *identity* without printing it, created the least-privilege role via a one-time guarded Cloudflare Worker, provisioned a distinct runtime Hyperdrive, and tested the restricted role through it.
- The bootstrap and runtime role-check Workers were both deleted successfully. The new restricted credential is stored in Hyperdrive; no database password was committed.

## Bound app resources

The native Cloudflare app `factsport-v2-staging` now binds `FACTSPORT_HYPERDRIVE` to the **restricted runtime** config and `FACTSPORT_MEDIA_BUCKET` to private `factsport-v2-media-staging`.

The routine staging smoke Worker also uses the restricted runtime Hyperdrive. The routine Hyperdrive safeguard targets only that config.

## Current limitation

The runtime role is deliberately **read-only**. Future fixture sync, ESPN result updates, prize settlement and account creation require purpose-specific writer/settlement roles, transactional jobs, schema additions and idempotency tests. Do **not** grant write privileges to the public request role, turn on the Azure Logic App, or cut over the production site before those are completed.

The staging app uses non-production Supabase placeholders; it demonstrates native build, deployment, secure gating, the database schema and read-only integration but not full historical data or account/auth parity.

The stage gate is a one-time random token rotated each staging deploy. The GitHub Action probes the gate and authorized health. Its value is masked in CI and stored only as a Cloudflare Worker secret, not as a GitHub repository secret.

The separate `factsport-v2-reader-bootstrap` / `factsport-v2-runtime-db-check` one-time workflows should not be retriggered; a duplicate runtime Hyperdrive refuses modification.
