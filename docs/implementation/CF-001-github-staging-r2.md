# Factsport v2 — GitHub-to-Cloudflare staging automation

**Implemented on `refactor/factsport-v2`, not `main`.**

## What the connection can and cannot do

The connected GitHub app can commit repository files, but does not expose GitHub Secrets/Variables administration or a workflow-dispatch action. ChatGPT cannot read masked GitHub secrets, nor authenticate directly to Cloudflare with an ID disclosed in chat.

GitHub Actions *can* authenticate to Cloudflare through repository secrets. GitHub's `workflow_dispatch` requires the workflow to exist on the default branch; this project intentionally does not touch `main`. Therefore `.github/workflows/v2-cloudflare-staging.yml` uses **push only to `refactor/factsport-v2`**, restricted to the staging workflow/config paths, and only if `vars.FACTSPORT_V2_STAGING_DEPLOY == 'true'`. It does **not** trigger production deployment.

## Required GitHub settings (one-time, secrets never committed)

GitHub repository → Settings → Secrets and variables → Actions:

- Repository **secret** `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account ID (not Hyperdrive ID).
- Repository **secret** `CLOUDFLARE_API_TOKEN`: Cloudflare API token scoped to the correct account with Workers Scripts edit and Workers R2 Storage Write permissions. An **R2 S3 Access Key ID/Secret Access Key is not interchangeable** with the Cloudflare API token used by Wrangler.
- Repository **secret** `FACTSPORT_SMOKE_TOKEN`: random secret with at least 32 bytes entropy, used only to authenticate both staging read-only probe routes. No secret value should appear in logs.
- Repository **variable** `FACTSPORT_V2_STAGING_DEPLOY`: set to the literal `true` only when you authorize creation of the staging R2 bucket and staging Worker. Set back to `false` to disable subsequent deployments.

Once the variable and secrets are present, push or recommit one of the workflow's listed paths on the v2 branch. The CI job is independent of default-branch workflow_dispatch. The workflow will verify the bucket, create it only if it is missing, deploy `factsport-v2-db-smoke` with both bindings, set the worker smoke token, then privately test Hyperdrive and R2 read-only routes. No schema migration, R2 object write, public bucket enablement, production site deployment, social post, or Logic App enablement is performed.

## Resources / binding names

| Resource | Value |
|---|---|
| Existing Hyperdrive | `factsport-v2-postgres`, ID `08cee41a81be4c3980450be9563af5e2` |
| Existing Azure database | `mketypostgres` / `factsport_v2` |
| New R2 staging bucket (created by gated Actions) | `factsport-v2-media-staging` — private |
| Staging smoke Worker | `factsport-v2-db-smoke` |
| Hyperdrive binding | `HYPERDRIVE` |
| R2 binding | `MEDIA_BUCKET` |
| Reserved vinext Factsport app | `factsport-v2-staging` — **not deployed** |

The Worker only exposes `/__internal/db-smoke` and `/__internal/r2-smoke`, both with a private bearer token. R2 probe uses `head` for a sentinel key, never writes media. PostgreSQL probe uses `SELECT` only. The R2 bucket is **not public** and has no public/custom domain.

### Important: network and application readiness

The 15 existing Azure firewall ranges are shared Cloudflare IP ranges, not proof of exclusive Factsport access. TLS and a dedicated least-privilege Postgres role remain necessary before production traffic.

`wrangler.v2-app.target.jsonc` is a **target staging configuration for the eventual vinext migration**, not a runnable Next14 build today. The existing site is still the legacy Next.js 14 / Supabase / Pages stack. Preserve ESPN live polling and current data provider precedence.

The GitHub Actions `DATABASE_URL` secret is not used by this workflow: all Azure database traffic passes through the existing Hyperdrive connection and is performed by the Worker. This avoids opening the Azure firewall to GitHub-hosted runners.

## Validation and rollback

The first CI run is expected to report any missing secret or permission and should not output the secret value. A successful run prints `db-smoke: OK` and `r2-smoke: OK`; `matchesTableReady: false` is normal until SQL migrations are separately applied.

Stop future deploys by setting `FACTSPORT_V2_STAGING_DEPLOY=false`. The R2 bucket and Worker will remain until explicitly deleted; disabling the variable does not delete resources or erase uploaded media. The smoke Worker is safe to delete later after app cutover. If its token is exposed, rotate the GitHub secret and re-deploy. Never run destructive R2 delete operations automatically.
