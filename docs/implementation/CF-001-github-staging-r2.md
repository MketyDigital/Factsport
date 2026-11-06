# Factsport v2 — GitHub-to-Cloudflare staging automation

**Implemented on `refactor/factsport-v2`, not `main`.**

## What the connection can and cannot do

The connected GitHub app can commit repository files, but does not expose GitHub Secrets/Variables administration or a workflow-dispatch action. ChatGPT cannot read masked GitHub secrets, nor authenticate directly to Cloudflare with an ID disclosed in chat.

GitHub Actions *can* authenticate to Cloudflare through repository secrets. GitHub's `workflow_dispatch` requires the workflow to exist on the default branch; this project intentionally does not touch `main`. Therefore `.github/workflows/v2-cloudflare-staging.yml` uses **push only to `refactor/factsport-v2`**, restricted to the staging workflow/config paths, after the owner explicitly approved staging automation in chat (no gating repository variable needed). It does **not** trigger production deployment.

## Required GitHub settings (one-time, secrets never committed)

GitHub repository → Settings → Secrets and variables → Actions:

- Existing Cloudflare account ID secret: **`CLOUDFLARE_ID`** (name supplied by owner).
- Existing Cloudflare token candidate: **`CLOUDFLARE_KEY`** (name supplied by owner). This must be an active Cloudflare **management API token** with Workers Scripts Edit and Workers R2 Storage Write permissions. The CI preflight checks token validity using Cloudflare's API and the following steps check actual permissions. If this is an R2-only management token it can create the bucket but cannot deploy the Worker. An **R2 S3 Access Key ID/Secret Access Key is not interchangeable** with the Cloudflare API token used by Wrangler. `MKETY_CF_R2_ACCESS` is intentionally not used for Worker deployment.
- No persistent GitHub smoke-token secret: Actions generates a random, masked 256-bit `FACTSPORT_SMOKE_TOKEN` per run, uploads it only as the staging Worker's Wrangler secret, and uses it to test the two read-only endpoints. The token rotates on each deployment.
- No `FACTSPORT_V2_STAGING_DEPLOY` variable: the owner approved staging provisioning explicitly. New pushes matching the workflow's path filters to the **refactor branch** run staging automation.

The owner confirmed that `CLOUDFLARE_ID` and `CLOUDFLARE_KEY` are the Factsport repository secrets. The owner supplied secret names and authorized staging deployment. A push to the specified v2 branch paths starts the workflow, but the GitHub connector cannot read actual secret contents or poll all workflow runs. The CI job is independent of default-branch workflow_dispatch. The workflow will verify the bucket, create it only if it is missing, deploy `factsport-v2-db-smoke` with both bindings, set the worker smoke token, then privately test Hyperdrive and R2 read-only routes. No schema migration, R2 object write, public bucket enablement, production site deployment, social post, or Logic App enablement is performed.

## Resources / binding names

| Resource | Value |
|---|---|
| Existing Hyperdrive | `factsport-v2-postgres`, ID `08cee41a81be4c3980450be9563af5e2` |
| Existing Azure database | `mketypostgres` / `factsport_v2` |
| New R2 staging bucket (created by gated Actions) | `factsport-v2-media-staging` — private |
| Staging smoke Worker | `factsport-v2-db-smoke` |
| Hyperdrive binding | `FACTSPORT_HYPERDRIVE` |
| R2 binding | `FACTSPORT_MEDIA_BUCKET` |
| Reserved vinext Factsport app | `factsport-v2-staging` — **not deployed** |

The Worker only exposes `/__internal/db-smoke` and `/__internal/r2-smoke`, both with a private bearer token. R2 probe uses `head` for a sentinel key, never writes media. PostgreSQL probe uses `SELECT` only. The R2 bucket is **not public** and has no public/custom domain.

### Important: network and application readiness

The 15 existing Azure firewall ranges are shared Cloudflare IP ranges, not proof of exclusive Factsport access. TLS and a dedicated least-privilege Postgres role remain necessary before production traffic.

The **actual vinext application** now has committed `cloudflare.config.ts` and `vite.config.ts` with a separate Worker name `factsport-v2-staging`. The modern Cloudflare `cf/config` setup was built successfully in a disposable runner (run `41670696225`), then committed to the refactor branch. Staging **application deployment** is still held pending runtime auth/service parity and secret mapping; only the read-only database probe Worker is deployed. The deployed production site remains the legacy Next.js/Supabase stack. The refactor branch now also contains vinext/React 19/Vite dependencies. Preserve ESPN live polling and provider precedence during cutover.

The GitHub Actions `DATABASE_URL` secret is not used by this workflow: all Azure database traffic passes through the existing Hyperdrive connection and is performed by the Worker. This avoids opening the Azure firewall to GitHub-hosted runners.

## Validation and rollback

The first CI run is expected to report any missing secret or permission and should not output the secret value. A successful run prints `db-smoke: OK` and `r2-smoke: OK`; `matchesTableReady: false` is normal until SQL migrations are separately applied.

Stop future deploys by disabling the v2 Cloudflare staging GitHub workflow or removing its trigger from the v2 branch. The R2 bucket and Worker will remain until explicitly deleted; disabling the variable does not delete resources or erase uploaded media. The smoke Worker is safe to delete later after app cutover. The probe token rotates automatically on each deployment. To revoke it immediately, delete/rotate the Worker secret or delete the isolated Worker. Never run destructive R2 delete operations automatically.

## Existing Mkety secret boundary

`MKETY_DATABASE_URL` must **not** be assumed to be the new Azure `factsport_v2` URL: the existing Mkety database may be shared or have an unrelated role/database. This staging pipeline intentionally does not use it, and does not apply SQL migrations. `MKETY_CF_R2_ENDPOINT` and `MKETY_CF_R2_ACCESS` are not used to deploy Workers. No credential value should be added to repository files.

## Cloudflare native application migration status

The first native vinext build succeeded in Actions run `41670696225`. The generated safe files were inspected and adapted, and these files were committed to `refactor/factsport-v2`:

- `cloudflare.config.ts` — Worker `factsport-v2-staging`, with `FACTSPORT_HYPERDRIVE` and `FACTSPORT_MEDIA_BUCKET` bindings; no production route
- `vite.config.ts` — Cloudflare Vite plugin and vinext App Router SSR/RSC targets
- `package.json` — vinext/Cloudflare Vite toolchain and isolated `build:vinext` script
- `.github/workflows/v2-vinext-compat.yml` — actual committed-config build/test with no deployment

The old placeholder `wrangler.v2-app.target.jsonc` was removed. This does **not** mean consumer auth, paid features, Supabase data migrations, Logic Apps, sports ingestion or the existing ESPN 3-second scoring path have been moved; do not promote the Worker or switch DNS yet. The Hyperdrive connection still uses the bootstrap Azure administrator and must be restricted before serving production application traffic.


---

## 2026-11-06 status correction — supersedes earlier deployment-status statements above

This addendum reflects the current checked-in branch configuration and the successful Actions run recorded below. Where earlier sections say the vinext app is not deployed or only the smoke Worker is deployed, those statements are historical and no longer current.

### Current Cloudflare staging topology in source

| Purpose | Worker/config | Hyperdrive ID | Intended DB identity |
|---|---|---|---|
| Full vinext app staging | `factsport-v2-staging` via `cloudflare.config.ts` | `895cca4c06104b8ab9f7c1b72a8ba18f` | App reader; the Hyperdrive verification script expects `factsport_v2_reader` |
| Read-only DB/R2 smoke | `factsport-v2-db-smoke` via `wrangler.hyperdrive-smoke.jsonc` | `895cca4c06104b8ab9f7c1b72a8ba18f` | Read-only probe; workflow tests database name and R2 binding |
| Schedule fixture sync | `factsport-v2-schedule-sync` via `wrangler.factsport-schedule-sync.jsonc` | `eb634fef8bb443839fd0847c6c370f85` | `factsport_v2_schedule_writer` |
| ESPN score parity preview | Worker source exists; no matching deployment config/workflow was found in the inspected paths | Not established | Source expects `factsport_v2_espn_writer`; this is not a DB-enforced read-only identity |

The older Hyperdrive ID `08cee41a81be4c3980450be9563af5e2` listed earlier in this document is not referenced by the current app, smoke, or schedule-sync config files inspected on this branch. Treat it as historical/unverified until a read-only Cloudflare account inventory establishes its purpose. Do not delete it based only on this note.

### Latest full application staging evidence

- Native vinext build and regression run: [42172478877](https://github.com/MketyDigital/Factsport/actions/runs/42172478877) — passed engine tests, ingestion tests, preview Worker syntax check, TypeScript, and Cloudflare build.
- Full app staging deployment: [42172478876](https://github.com/MketyDigital/Factsport/actions/runs/42172478876) — passed Cloudflare credential presence, regression tests, TypeScript, native Worker build, isolated staging deploy, unauthenticated denial on `/`, `/api/matches`, and `/admin`, protected health check, Hyperdrive/R2 dependency checks, and populated PostgreSQL matches API.
- These are staging-only Workers; no production domain, DNS, production route, or production data migration was changed by these runs.

This does **not** prove feature parity. The app-staging workflow supplies placeholder Supabase build variables, and the smoke tests only exercise the staging gate, health endpoint, and matches API. Do not interpret a passing smoke test as proof that login, account lifecycle, VIP/payment, predictions, settlement, editorial, social, media migration, or admin workflows are ready.

### Network and database identity controls

The database endpoint is publicly addressed but, per the owner's stated setup and the earlier implementation note, inbound firewall access is intended to be restricted to Cloudflare IP ranges. The implementation note records 15 shared Cloudflare ranges. These are shared Cloudflare egress ranges, not a Factsport-exclusive network identity. A Cloudflare IP allowlist is only one layer; production readiness also requires TLS, strong rotated credentials, and dedicated least-privilege database roles.

The checked-in `infra/cloudflare/configure-factsport-hyperdrive.sh` reads Hyperdrive ID `895cca...` and verifies the expected resource name, database `factsport_v2`, origin user `factsport_v2_reader`, and host before optionally disabling Hyperdrive caching and setting the origin connection limit to 5. This is a source-level check performed by Actions when the smoke workflow runs; it does not inspect Azure firewall rules or prove effective PostgreSQL table/column privileges. The schedule Worker uses a separate Hyperdrive ID and role and must be audited independently.

No checked-in migration among the inspected v2 files provisions the app-reader, schedule-writer, or ESPN-preview roles and their exact grants. Record the role/grant SQL or an approved infrastructure-as-code source before production cutover. The schedule Worker checks that its role cannot DELETE from matches or UPDATE score columns, but the full allowed-column privilege set still needs database-side verification. The ESPN preview Worker must use a database-enforced SELECT-only identity.

### Cron and staging lifecycle

The schedule-sync config declares Cron `15 3,15 * * *` (UTC) and the Worker code refuses unexpected cron values. The config/source alone does not prove that the Worker is deployed, that the trigger is active in Cloudflare, or that scheduled executions are succeeding. Verify the live Worker script, trigger, latest invocations, and logs through the Cloudflare account before treating automated ingestion as operational.

The full app staging workflow creates a new random access token per deployment and installs it as a Worker secret. The workflow does not implement a time-based expiry or automatic Worker deletion. Staging access therefore remains protected but needs an explicit cleanup/rotation policy.

### Remaining account-level checks

The repository workflows use the masked GitHub secrets `CLOUDFLARE_ID` and `CLOUDFLARE_KEY`; their values must never be printed or copied into files. The GitHub connector cannot read secret contents or inspect Azure firewall configuration. Use a Cloudflare-authenticated staging audit workflow to inspect Worker scripts/settings, routes, Cron triggers, Hyperdrive resources, and R2 public/custom-domain settings. Verify Azure firewall rules and PostgreSQL effective grants separately through authorized read-only administration.

A `Vercel` status context was observed on a v2 commit even though the inspected v2 workflow files deploy only to Cloudflare. Treat it as stale GitHub integration/status metadata unless a live account inspection proves otherwise; remove the obsolete status integration from repository settings if it is no longer used. It is not evidence that the current Cloudflare staging workflows use Vercel.


## 2026-11-06 account-backed staging safety verification

The staging workflow now fails closed if it cannot inspect the runtime Hyperdrive, and it verifies the exact Azure database, reader identity, TLS-required setting, disabled Hyperdrive query cache and origin connection limit of five. It also checks both R2 public-access mechanisms through Cloudflare's account API: managed `r2.dev` access must be disabled and no custom domain may be enabled.

Workflow [42261414894](https://github.com/MketyDigital/Factsport/actions/runs/42261414894) passed these checks, deployed the isolated smoke Worker, and returned `db-smoke: OK` and `r2-smoke: OK`. The R2 bucket remained private; no object was written. The later source update also adds TLS to the Hyperdrive identity guard, which is being re-run separately.
