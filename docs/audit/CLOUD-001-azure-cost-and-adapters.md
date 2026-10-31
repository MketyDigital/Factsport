# CLOUD-001 — Azure minimum-cost and switchable providers plan

Date: 2026-10-31
Status: RESEARCH VERIFIED for public product capabilities, SOURCE VERIFIED for listed Factsport code, PROPOSED architecture, **not provisioned**. Only work in `refactor/factsport-v2`; don't modify main, Cloudflare production, Azure subscriptions, or legacy Supabase.

## Owner architecture decision
- Production web/UI/live proxy: vinext on Cloudflare Workers. Primary FD free-tier fixture sync; ESPN coverage gap/fast live for matched and ESPN-native fixtures; FD delayed unmatched live and FT verification; maintain one centrally governed Factsport system.
- Initial database: **Azure Database for PostgreSQL Flexible Server**, minimum practical managed SKU; future ability to switch to **Mkety Core central PostgreSQL** or another PostgreSQL instance without frontend changes.
- Workflow/orchestration default: **Azure Logic Apps Consumption**, provider-swappable with Cloudflare Workflows/Cron or another scheduler; not direct Azure actions in domain logic.
- AI: **Mkety AI** as the configured AI provider through an adapter. No new Azure OpenAI subscription required.
- Cheapest viable additional resources only where load/security/proven requirement justifies them. Billing forecasts and provider choice are not guarantees.

## Verified Azure product facts and tentative cost
- Azure PostgreSQL Flexible Server Burstable B1ms: 1 vCore, 2 GiB RAM, 32 GiB minimum provisioned storage, with 7-35d automated backups. Source https://learn.microsoft.com/en-gb/azure/postgresql/compute-storage/concepts-compute and https://learn.microsoft.com/en-au/azure/postgresql/flexible-server/concepts-compute-storage
- Azure price pages are region/currency sensitive. One public Microsoft pricing rendering lists ~USD **$12.41/month B1ms COMPUTE**; third-party Microsoft guidance suggests ~USD $3.68/month for 32 GiB in a sample region; thus **~$16/month as an illustrative compute + base-storage estimate, NOT a firm quote**. Add Azure backup above inclusive allowance, network egress, monitoring, support, taxes and exchange effects. Verify actual selected region and subscription quote in Azure Pricing Calculator and portal before any create. Sources: https://azure.microsoft.com/en-us/pricing/details/postgresql/flexible-server/ and https://github.com/microsoft/azure-skills/blob/main/skills/azure-app-onboard/prepare/references/pricing-guide-services.md
- Burstable is appropriate for staging/initial low traffic; it has CPU credit exhaustion risks and Microsoft warns against assuming sustained 24/7 production performance. Start B1ms only behind measured staging load and CPU credit monitoring; increase tier if needed.
- Azure PostgreSQL backup default minimum 7 days, storage charges may continue when the server is stopped; a stopped server auto-starts after 7 days. For 24/7 site don't rely on manual stop/start.
- Configure **one server**, **one Factsport DB**, **minimum storage**, **locally redundant backup**, **no standby high availability**, **no read replica**, **no geo-redundant backup** initially, unless reliability requirements mandate otherwise. Define explicit RPO/RTO and PITR/restore tests before production.
- Azure PostgreSQL external connection must honor TLS and network restrictions. Cloudflare Hyperdrive officially documents support for **Azure Database for PostgreSQL**, including IP allowlisting or private tunnel. Prefer controlled Cloudflare Hyperdrive egress allowlisting/private networking, and least-privilege DB login. **Never publicly open all IPs or commit a password** merely for convenience. Cloudflare docs: https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-database-providers/azure/ and https://developers.cloudflare.com/hyperdrive/configuration/firewall-and-networking-configuration/ . Built-in Azure PgBouncer is **General Purpose/Memory Optimized only** per MS docs, so do not assume built-in PgBouncer on B1ms; Hyperdrive pooling is the relevant first test. Source https://learn.microsoft.com/en-us/azure/postgresql/connectivity/concepts-pgbouncer
- Azure Logic Apps **Consumption** bills by triggers/actions/connectors; Microsoft lists first 4,000 built-in actions/month free in an example pricing table, but total cost depends on operations and connector choices, retries and run history. A 1/min workflow alone has ~43,200 monthly triggers before action counts; do NOT assert near-zero cost. Keep 1/min Cloudflare frontend live polling out of Logic Apps; if needed run only light DB persistence/housekeeping there and compare total action cost. Sources https://azure.microsoft.com/en-us/pricing/details/logic-apps/ , https://learn.microsoft.com/en-us/azure/logic-apps/plan-manage-costs and https://learn.microsoft.com/en-us/azure/connectors/connectors-native-recurrence
- **Consumption vs Standard**: Consumption is pay-per-action and one workflow per resource; Standard has ongoing hosting. Start Consumption and re-evaluate with volume. Use schedule triggers for low-frequency editorial/social/settlement/fixture tasks, not user-facing live proxy traffic.
- Logic Apps offers managed identity for supported Microsoft/Azure operations. For Cloudflare internal job dispatch, use signed short-lived service tokens or scoped authenticated endpoints; don't expose public `?key=` credentials or treat managed identity as automatically authenticating Cloudflare. Source: https://learn.microsoft.com/en-us/azure/logic-apps/authenticate-with-managed-identity

## Switchable architecture, enforceable boundaries
```text
Browser -> Factsport HTTP routes (vinext Workers, stable URLs and response shapes)
                 |
           Domain use cases
                 |---- MatchRepository / NewsRepository / ChatRepository / CompetitionRepository
                 |       -> SqlRepository(Postgres) -> ConnectionProvider(Azure PG / Mkety Core PG)
                 |---- MatchFeed / LiveData -> FootballData + ESPN adapters (explicit precedence)
                 |---- AiProvider -> MketyAI adapter (optional later alternate)
                 |---- JobDispatcher / JobRunner -> AzureLogicApps OR CloudflareCron/Workflows
                 |---- MediaStore -> R2 adapter (optional alternate)
                 |---- SocialPublisher -> Telegram / Facebook / Buffer / Make replacements
                 |---- AuthProvider -> authenticated user/session adapter
```
- Business logic and frontend import stable ports/use-cases, never Azure SDK/Logic Apps payloads or a `supabase.from` query directly. Cloudflare binding names and Azure resource IDs stay in infrastructure/config only.
- **PostgreSQL portability is not magically automatic**: schema migrations must target ordinary PostgreSQL, avoid Azure-only extensions/functions, use owner-tested extensions if needed, version migrations, restore backups and rehearse cutover. Switching host means planned short maintenance/dual-write migration and DNS/config update; not inherently zero downtime.
- **Scheduler portability**: `JobId` + versioned JSON schema -> same application-owned `runJob(jobId, runKey, payload)` entrypoint. Azure Logic Apps and Cloudflare workflows merely trigger it and report status, never own domain calculations or mutate the DB directly. Only one enabled production scheduler **per job**, with a durable lock/idempotency key in DB; migration toggles ownership with backfill/replay rules.
- **AI portability**: `generateEditorialBrief`, `generateMatchAnalysis`, `summarizeResults` return validated structured outputs with provenance, prompt version, sources and editorial review state. Mkety AI adapter requires confirmed protocol, model identity, auth mechanism and quotas; don't invent endpoints. Fail closed and retain editorial approval rather than publish fabricated or unsupported articles.
- **Connection portability**: `DB_PROVIDER=postgres`, `DATABASE_URL`/Hyperdrive binding under server-only secrets, `WORKFLOW_PROVIDER=azure-logic-apps|cloudflare`, `AI_PROVIDER=mkety`. Names are PROPOSED, not runtime configuration currently active; ensure no secrets in public repository.
- Stable contract tests must run against Azure PG and Mkety Core PG staging with same fixtures, transactions, locks, timezone, text IDs, unique/FKs and performance baseline before migration.
- Do not introduce synchronized duplicate DB writes to multiple providers for routine operations; use logical backups/migration jobs and a single authoritative DB.

## Repo audit: every integration to isolate
| Current dependency | Evidence | Proposed adapter | Azure resource? |
|---|---|---|---|
| Supabase SQL/RPC/Auth | app/lib/supabase/*, APIs, app pages and components | repository/auth/transactions ports with Postgres implementation | Azure PG initially, yes |
| Supabase Storage team-logos, socials | scripts/sync-gh.js; app/api/social/route.ts; app/api/logos/sync/route.ts | MediaStore | Prefer Cloudflare R2, no Azure Blob initially |
| Gemini AI | scripts/daily-preview.js, daily-summary.js, generate-pro-slips.js | AiProvider -> Mkety AI | No Azure AI initially |
| Github Actions schedules | .github/workflows/* | JobDispatcher -> Logic Apps | Logic Apps Consumption |
| External cron-job.org DB sync + Cloudflare scheduled Worker | owner-provided external code | JobDispatcher and JobRunner | Logic Apps where economically sensible |
| Direct ESPN edge proxy | user-supplied live Worker + app/utils/liveFetcher.ts | LiveFeedService, edge caching | Stay Cloudflare, no Azure Functions |
| D1 match chat & MOTM | user-supplied Workers + FanZoneChat and MOTMVoteWidget | ChatRepository/MotmRepository | Azure PG as initial DB; Cloudflare DO only if scale demands |
| ESPN/football-data.org | lib/espn.ts; app/api/live, sync-fd, matchmaker; scripts | sports Feed + MatchMapping ports | No Azure sports API service |
| Social distribution: Facebook/Telegram/Buffer/Make | scripts/daily-*; generate-pro-slips; app/lib/socialService.ts; app/api/social | SocialPublisher/Outbox | Logic Apps for dispatch, channels remain external |
| YouTube highlights | app/api/matches/highlights/sync/route.ts | HighlightsProvider | No additional Azure resource |
| Search indexing | app/api/index-url/route.ts | SearchIndexer | No additional Azure resource |
| Video/stream token | app/api/stream/token/route.ts, stream SDK in package | StreamingProvider | Keep current provider until fully audited |
| Secrets & logs | app route env variables, old site_settings.social_config | secrets + operational logging | Azure Key Vault **optional**; prefer current secrets managers for minimum cost, but don't store tokens in public site_settings; Azure Monitor optional with cost budgets |

## Suggested Logic Apps Consumption job catalog (without duplication)
- Every 5m: FD FT verification -> persist/validate -> idempotent settlement -> standings refresh as required; strict ordering with retry/backoff, not two simultaneous calls plus two-second sleep.
- Periodic: free-tier FD fixture ingestion, ESPN cup gap ingestion, matchmaker; cadence must respect request limits and freshness targets.
- Every 1m: old /api/live DB/social snapshots ONLY IF owner decides to transfer its cron from cron-job.org and Logic Apps action costs are acceptable; otherwise trigger via Cloudflare Cron through same JobRunner adapter. Frontend direct ESPN 3-second caching **never** scheduled via Logic Apps.
- Daily: AI pro analysis via Mkety AI, previews, postmatch roundups, editorial review and social publication after approval; deterministic run keys and appropriate retry policies.
- Monthly: VIP winner audit, review/approval and rollover after auditable settlement. No double writes.
- Other existing jobs to map before enabling: deleting unconfirmed auth accounts, cron log retention, social media retention, logo/highlight sync, search indexing, campaign expiry, moderation, and any unknown external triggers. Do not assume comprehensive mapping until dashboard review.
- Consumption resource may be one Logic App per job; deploy by infrastructure-as-code/ARM/Bicep and a single centrally maintained job catalog, not a chaotic collection of unowned flows.
- AI workflows should call Mkety AI **via application AiProvider**, never encode model prompts and business rules in Logic App expressions.

## Low-cost Azure resource decision table
**Required if approved**: one PostgreSQL Flexible Server B1ms (verify quotas/region), one resource group, appropriate Logic Apps Consumption jobs, an Azure billing budget/alerts.
**Optional**: Azure Key Vault for shared secret management (metered), Log Analytics if extended diagnostic retention justified, storage account if future durable integration logs or Logic Apps dependencies require it, network/private access service if security needs exceed inexpensive public/TLS allowlisting.
**Avoid by default**: Azure VM, AKS, App Service, Azure Functions, Service Bus, Event Hubs, Azure Cache for Redis, Cosmos DB, Azure OpenAI, Azure Blob Storage, duplicate DB replicas, dedicated NAT/VNet gateways and Logic Apps Standard hosting. Revisit only on measured need or unavoidable compliance.
**Risk**: direct browser-to-Azure database forbidden. All DB access server-side; separate read-only/app/job/admin roles and backup restore tests.

## Azure setup checklist (not executed)
1. Owner chooses billing subscription and cheapest acceptable latency-supported Azure region; get actual B1ms + 32 GiB + backup + transfer quote, set monthly Azure budget and alerts before provisioning.
2. Create resource group, B1ms Flexible Server, PG version supported by repo target, 32 GiB, backup 7d local redundancy, no HA, TLS required, restricted firewall/Hyperdrive ingress. Don't expose credentials.
3. Create empty `factsport_v2` database and minimal app/worker/migration roles, run reviewed schema migrations on **new Azure server only**. No old operational dataset import, no writes to legacy Supabase.
4. Test Hyperdrive connectivity, query concurrency, CPU credits, SSL, failover and backup restore to isolated staging. Azure's region and Cloudflare edge latency affects UX; cache fast live proxy separately from PG.
5. Create **one** Consumption Logic App job in DISABLED/TEST mode to validate authenticated dispatch of a harmless `healthcheck` job. Instrument cost/latency/errors.
6. Register Mkety AI adapter only after its endpoint/protocol/auth/SLA are documented, test on synthetic sports sample; never send private auth/profile data by default.
7. Move remaining automations incrementally behind feature flags. Ensure exactly one production owner/job and graceful rollback to Cloudflare adapter; disable/retire external jobs only after parity and owner approval.

## Owner input required for provisioning
- Azure subscription/region, billing currency, hard monthly Azure cap, and whether this is staging-only or live from day one; explicit approval to create billable resources.
- Mkety AI API contract (base URL/protocol, auth and model IDs through **private** channel, limits and intended content types). No token/personal emails in GitHub.
- Whether Logic Apps must literally run *every 1-minute live DB job* or only low-frequency automations while Cloudflare Cron handles cost-sensitive high-frequency ticks.
- RPO/RTO, approved chat/MOTM retention, existing auth/VIP migration choice.
- No Azure resource management connector currently available in this session; no Azure resources have been provisioned.

## External sources reviewed 2026-10-31
- Microsoft Flexible Server compute: https://learn.microsoft.com/en-gb/azure/postgresql/compute-storage/concepts-compute
- Burstable cautions: https://learn.microsoft.com/en-au/azure/postgresql/flexible-server/concepts-compute-storage
- Flexible pricing: https://azure.microsoft.com/en-us/pricing/details/postgresql/flexible-server/
- Microsoft pricing reference: https://github.com/microsoft/azure-skills/blob/main/skills/azure-app-onboard/prepare/references/pricing-guide-services.md
- Azure Logic Apps pricing: https://azure.microsoft.com/en-us/pricing/details/logic-apps/
- Logic Apps schedule: https://learn.microsoft.com/en-us/azure/connectors/connectors-native-recurrence
- Hyperdrive with Azure PG: https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-database-providers/azure/
- Hyperdrive firewall: https://developers.cloudflare.com/hyperdrive/configuration/firewall-and-networking-configuration/
- Built-in PgBouncer tier restrictions: https://learn.microsoft.com/en-us/azure/postgresql/connectivity/concepts-pgbouncer
