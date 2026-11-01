# CLOUD-003 — Actual Azure staging commands, costs, database sizing and upgrade triggers
Date: 2026-11-01. Planning + inert source control only. No Azure resources were provisioned from chat. Source refs are official Azure and Microsoft docs.

## Zero-change rules and owner intent
- User wants Entra External ID Basic (first 50,000 monthly active users free; no SMS/paid extras), Azure PostgreSQL B1ms smallest 32GiB server, Azure Logic Apps Consumption, Cloudflare Workers frontend 3s live proxy and R2 media storage. Stage before production.
- Main workforce Azure tenant identities never become Factsport fan accounts. A **separate External ID tenant** must be created using Microsoft Entra admin center with 'External' tenant configuration and existing subscription linked for billing. Microsoft officially documents **portal workflow**, not a dependable generic `az group create` command to create external identity tenants. Don't create a workforce tenant accidentally.
- Automation backend must remain vendor-adaptable: only logic-app triggers, application JobRunner owns idempotent job execution and database writes; alternative Cloudflare Workflows disabled.
- No secrets in git, logs, GET URLs, or pasted chat; don't permit 0.0.0.0/0 broad DB ingress. R2 for images, highlights thumbnails, media, avatars, social images; PostgreSQL stores only URLs/keys and structured text/json/data, with size caps, retention and indexes.
- On the B1ms budget, **all application writes in Azure PG, not auth identity password hashes** (Entra manages credentials); use Hyperdrive pooling cautiously and the worker server-side only.

## Ready-to-use artifacts
- `infra/azure/bootstrap-staging.sh`: Azure Portal Cloud Shell (Bash), dry run default and requires subscription, region, unique server name, explicit APPLY=1 and typed confirmation; RG name must contain factsport+staging. Does **not** alter existing resources or existing servers. Creates new RG, PostgreSQL Flexible Server Standard_B1ms, Burstable, 32GiB Premium_LRS, PostgreSQL 16, 7d LRS backup, no high availability, no public firewall rule, and empty factsport_v2 database. May error on unavailable SKU/region, name collisions or unsupported regional PG version; inspect quota and portal quote first. No schema data migration.
- `infra/azure/logic-app-staging-disabled.json`: ARM deployment template for **disabled** Consumption Logic App with a harmless recurrence trigger + Compose only. It does not call any Factsport endpoint. Must be reviewed and deployed manually after RG exists; do not enable until validated internal endpoints and durable job runner exist.
- `scripts/estimate-azure-cost.cjs`: transparent 30-day illustrative estimator. Entra beyond-free rate is NOT hardcoded because Microsoft public pricing HTML currently returns '$-' placeholder; user should retrieve actual rate in authenticated Azure calculator or Microsoft quote. Passing `ENTRA_OVERAGE_USD_PER_MAU=` with owner-confirmed rate computes overage.

## Portal Cloud Shell walkthrough
1. Open https://portal.azure.com > Cloud Shell > Bash; `az account list -o table`, `az account show -o table`. Choose exact subscription ID. Do not assume current default is Mkety's intended subscription.
2. Review https://azure.microsoft.com/en-us/pricing/details/postgresql/flexible-server/ using the **selected region** and subscription price, including min 32GiB, backup, networking. Confirm B1ms capacity with `az postgres flexible-server list-skus -l <REGION> -o table` (CLI availability subject to extension).
3. Use scripts manually from the verified Factsport development branch (for example `git clone -b refactor/factsport-v2 ...` or GitHub file copy after manual verification).
```bash
export SUBSCRIPTION_ID="<AZURE-SUBSCRIPTION-GUID>"
export AZ_REGION="westeurope"     # example ONLY, choose real best-price/latency region
export PG_SERVER="factsportv2stageunique" # must be globally unique
export RG="rg-factsport-v2-staging"
bash infra/azure/bootstrap-staging.sh   # DRY RUN
# AFTER inspecting account, quota, quote and firewall policy:
APPLY=1 bash infra/azure/bootstrap-staging.sh
```
4. For a non-running workflow scaffold, in same Cloud Shell, after resource group creation:
```bash
az deployment group what-if --resource-group "$RG" \
 --template-file infra/azure/logic-app-staging-disabled.json \
 --parameters workflowName=la-factsport-v2-staging-healthcheck
# AFTER REVIEW and separate owner approval (creates a disabled Logic App resource):
az deployment group create --resource-group "$RG" \
 --template-file infra/azure/logic-app-staging-disabled.json \
 --parameters workflowName=la-factsport-v2-staging-healthcheck
```
5. Entra external tenant is a **separate portal step**: https://entra.microsoft.com > Entra ID > Overview > Manage tenants > Create > External > existing subscription > Factsport Customers Staging > distinct domain/region. Register Factsport Staging Web app; exact OAuth callback URI depends on verified staging hostname, no invented site URL. Set email password and user flow; collect tenant ID/issuer/client ID (no secrets shared). Verify subscribed billing status. Microsoft docs https://learn.microsoft.com/en-us/entra/external-id/customers/quickstart-tenant-setup .
6. Configure Cloudflare secrets and Azure PG restricted ingress/Hyperdrive only after tested addresses. DB admin password from Cloud Shell should be secret and eventually replaced with separate least-privilege Factsport app, job and migration roles.
7. No switch from Supabase to PG or external Workers until schema, data/identity migration, backup restore and staging production parity test.

## Public pricing verified vs outstanding quote
- Azure PG B1ms: published example **US$12.41 compute/month**; min 32GiB at representative US$0.115/GB-month => **US$3.68 storage**, total **US$16.09/month**. This is reference-region example, not selected subscription quote. Microsoft Flexible Server storage provisioned (32GiB) charged regardless of 1GB data use; backups up to 100% provisioned storage included, excess charged. No HA. Sources https://azure.microsoft.com/en-us/pricing/details/postgresql/flexible-server/ and https://github.com/microsoft/azure-skills/blob/main/skills/azure-app-onboard/prepare/references/pricing-guide-services.md
- Azure Logic Apps Consumption official examples: first **4,000 built-in action executions** free, **US$0.000025 per additional built-in action**, **US$0.000125 per Standard connector call**, **US$0.001 per Enterprise connector call**. Triggers/action execution metering and retry can change charges. HTTP built-in vs managed connector category must be verified for each workflow. Sources https://azure.microsoft.com/en-us/pricing/details/logic-apps/ and https://learn.microsoft.com/en-us/azure/logic-apps/plan-manage-costs .
- Entra External ID Basic: first 50,000 **unique authenticating MAU across relevant subscription-linked tenants** free, no SMS/M2M/Go Local extras chosen. Above 50,000 is metered per MAU, but Microsoft official public page at time of audit renders **"$-" with no numeric price**, so no defensible overage $ estimate. Retrieve subscription-specific rate in https://azure.microsoft.com/en-us/pricing/calculator/ or request Microsoft account quote. Formula: `max(0, active_MAU-50,000) * confirmed_overage_USD_per_MAU`. For example 60,000 MAU bills 10,000 units * actual rate; do not substitute a guessed number. Official https://azure.microsoft.com/en-us/pricing/details/microsoft-entra-external-id/ .

## 30-day scenario planning (illustrative, not a billing quote)
`node scripts/estimate-azure-cost.cjs` prints details. Assumes 30 days, counts recurrence triggers conservatively as billable, first 4000 aggregate built-ins free, simple actions; 0 extra paid Enterprise connectors unless explicit:
| Scenario | Cadence and assumptions | Approx Logic Apps | PG | Azure subtotal | Entra |
| Lean | 5m reconciliation, 6 daily flows, no 1m cron | $0.78 | $16.09 | **$16.87** | free under 50k |
| Moderate | 1m DB snapshot job, 5m FT/settlement, 8 daily flows | $2.95 | $16.09 | **$19.04** | free for 10k MAU |
| Busy automation | 1m DB, 2 x 5m, 16 daily workflows + 3k Standard connector calls | $4.67 | $16.09 | **$20.76** | free for 40k MAU |
These estimates **exclude** Cloudflare paid Workers, R2, Hyperdrive extra fees if any, Mkety AI/mail credits, outbound bandwidth, backups beyond quota, observability/log retention, retries, tax, and selected Azure region price differences. No social provider charges included.
Important: if Logic App has repeated HTTP actions or managed connectors, actions multiply. Do not route frontend 3-second polls through Logic Apps. Log actual execution counts monthly and update forecast.

## Data sizing and capacity: users != database upgrade
- Existing Supabase project reportedly stored ~2506 matches, ~366 news, ~292 standings; much below 1GiB for primary tabular records. New 32GiB provisioned Azure allocation offers substantial *capacity* even though not all free to use and required indexes/PG overhead consume space.
- Illustrative **logical payload** (not actual measured DB size): 10,000 users x 2 KiB ~20 MiB, 200,000 chat messages x 0.5 KiB ~98 MiB, 10,000 fixtures x 4 KiB ~39 MiB, 5,000 news items x 8 KiB ~39 MiB. PostgreSQL indexes, JSON, row headers, logs and free-space/rewrite overhead can multiply practical storage by >2x. **Actual row sizes must be measured** before capacity projections.
- 50k Entra MAU does NOT translate into 50k simultaneous PG connections or API writes. Cache public fixtures at edge, use read batching and auth sessions, bound chat polling, apply rate limits; 3s ESPN HTTP requests ideally don't touch DB.
- Upgrade is much likelier from **B1ms compute and CPU credit exhaustion, P95 query latency, request bursts, connection saturation, autovacuum backlog, lock contention** than from storage. Alerts: sustained high CPU/low credits, >70-80% safe connection pool saturation, >75% provisioned storage, >200ms p95 indexed lookups (provisional targets), slow auth/match center or repeated retryable DB errors. Use staging load testing to set thresholds. A Web sports site with 50k MAU may be okay on B1ms if light DB activity, but 500 simultaneously posting fans can overload it; no honest fixed-user upgrade threshold exists.
- Long-term transaction and privacy controls: structured chat and prediction records only in PG; cap message retention, remove expired sessions/job logs, archive old media to R2, audit indexes and vacuum. Do not delete legal/financial or paid entitlement records without approved retention.
- Backups: minimum 7d locally redundant; test restore to **separate staging** database before production. No multi-AZ HA at B1ms means downtime is possible; aim reliable snapshots and rollback, not false 100% uptime promise.
- Database should be normalized portable Postgres SQL; avoid Azure-only stored procedures/extensions. Mkety Core PG host migration later through verified dump/restore or logical replication and application-level reauthentication if issuer changes.

## What implementation has actually occurred
- Developer branch only: guarded Azure DB provisioning shell script, disabled ARM Logic Apps template, cost estimator, documentation. No Azure account access or executed Cloud Shell commands; no Azure resources, Entra external tenant, real job runners, OAuth callback endpoints or DB tables created.
- Do not imply site is currently on Azure or live providers converted. Security-sensitive route integration requires a configured external tenant, live app registration and reliable session/PKCE/JWKS tests.
