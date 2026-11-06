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

## Current role topology and remaining limitation

The public application runtime remains deliberately **read-only** through `factsport_v2_reader` / Hyperdrive `895cca...`. Separate staging-only worker identities now exist: `factsport_v2_schedule_writer` / Hyperdrive `eb634...` for fixture-only ingestion, and `factsport_v2_espn_writer` / Hyperdrive `c516...` reserved for future ESPN live-field writes. The administrative Hyperdrive `08cee...` is used only for guarded provisioning, audit and hardening. These identities must never be merged or substituted.

The staging hardening run [42265651629](https://github.com/MketyDigital/Factsport/actions/runs/42265651629) applied `NOINHERIT`, non-privileged role flags, five-connection limits, removed schedule score INSERT grants, and revoked `TEMP` from `PUBLIC`. The independent read-only audit [42265971339](https://github.com/MketyDigital/Factsport/actions/runs/42265971339) confirmed the database owner is `mketydbadmin`, all three runtime roles have no role memberships, no temporary-table privilege, no executable public functions or usable public sequences, and no access to private account/identity/job tables. The schedule worker is the only deployed writer in this slice; the ESPN writer is still reserved and must not be used for score updates until transaction, reconciliation, source-fencing, idempotency and parity gates pass.

Prize settlement, account creation, prediction/game tables and the rest of the product schema are not yet implemented in v2. Do **not** grant write privileges to the public request role, turn on the Azure Logic App, or cut over the production site before those features are migrated and verified.

The staging app uses non-production Supabase placeholders; it demonstrates native build, deployment, secure gating, the database schema and read-only integration but not full historical data or account/auth parity.

The stage gate is a one-time random token rotated each staging deploy. The GitHub Action probes the gate and authorized health. Its value is masked in CI and stored only as a Cloudflare Worker secret, not as a GitHub repository secret.

The separate `factsport-v2-reader-bootstrap` / `factsport-v2-runtime-db-check` one-time workflows should not be retriggered; a duplicate runtime Hyperdrive refuses modification.
