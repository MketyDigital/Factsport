# CLOUD-002 — Revised low-cost provider architecture; Mkety SaaS contracts

Date: 2026-10-31. Evidence: MketyDigital/mksaas/main inspected read-only, Factsport source, owner decisions. **No Azure provisioning, production route integration, billing or database writes.**

## Owner's confirmed choices (override CLOUD-001 where different)
- Azure managed PostgreSQL Flexible Server B1ms, ~US$16–20/month database-only **planning target**, verify exact region/selected subscription pricing; do not promise that exact bill or include Logic Apps/monitoring/network in it. Small managed server first for staging and subsequent production after parity. Upgrade only if CPU credits/latency/connection load require.
- Azure Logic Apps Consumption = primary third-party automation orchestrator. A Cloudflare Workflows implementation may be developed and kept **DISABLED** as a replaceable alternative; exactly one owner per scheduled job. Keep Logic Apps workflow actions infrastructural; application JobRunner retains logic.
- Facebook Graph API and Telegram Bot API **must remain direct**, inside first-party SocialPublisher implementations. Buffer/Make/other third-party distribution can be routed by an Azure Logic Apps adapter initially, replaceable by Cloudflare Workflows. Do NOT route direct FB/TG through Logic Apps by default.
- R2 is default object store behind MediaStore. Others only if owner changes provider.
- Mkety AI = first-party AI provider behind AiProvider. Mkety Mail = first-party transactional Email adapter; neither should expose credentials to browser nor be silently replaced with expensive Azure services.
- Frontend ESPN live remains Cloudflare cached and polled every 3 seconds during live play. Do not move to Azure Logic Apps, DB polling or WebSocket without comparable measured reliability/cost and compatibility. Existing 3s response cache already de-duplicates origin requests within cache scope. Compare Cloudflare Worker paid/free quotas, cache hit ratio and ESPN upstream budget before changing; if necessary use cache and per-match fanout behind unchanged API contract. Latency may be more important than a marginal request saving.
- Don't overarchitect the free-tier optimized legacy; Azure resources only where justified; retain free football-data.org and ESPN interplay, no duplicate expensive infrastructure.

## Mkety API source contract (verified at MketyDigital/mksaas/main)
**AI:**
- `src/app/api/v1/ai/chat/completions/route.ts`: POST `/api/v1/ai/chat/completions`. Bearer key with `ai:chat` scope (validated by `src/features/ai-runtime/server/api-auth.ts`), enterprise AI API entitlement required, body `{model, messages:[{role,content}], max_tokens?, max_completion_tokens?, stream?:false, response_format?}`. `Idempotency-Key` required, length 1..160, optional tenant/project scope header `x-mkety-project-id`. Streaming explicitly returns HTTP 501 currently; for editorial jobs use nonstreaming. Route may return HTTP 402 for commercial quota/cost envelope, 503 for provider unknown, and errors that require reconciliation; DO NOT blindly issue a different idempotency key on timeouts or errors.
- `src/app/api/v1/ai/models/route.ts`: GET `/api/v1/ai/models` with `ai:models:read` scope and enterprise entitlement; returns model aliases with capabilities. Account/model alias and base URL are runtime config, not assumptions.
- `customer-apps/assist/README.md` lists aliases `mkety-fast`, `mkety-smart`, `mkety-reasoning`, `mkety-vision` for customer Assist; availability to Factsport enterprise tenant must be verified by model list. Sources: `https://github.com/MketyDigital/mksaas/blob/main/src/app/api/v1/ai/chat/completions/route.ts`, `.../src/app/api/v1/ai/models/route.ts`, `.../src/features/ai-runtime/server/api-auth.ts`.
- Passive adapter added `lib/adapters/mkety-ai.ts`. Needs test API key, project ID (optional), configured hostname and enabled enterprise AI API entitlement. No key committed. Returns editorial drafts requiring review. Current model API is not a guaranteed always-on public service.
**MAIL:**
- `src/app/api/v1/mail/send/route.ts`: POST `/api/v1/mail/send`, Bearer key with `mail:send` scope, request `{from,to,subject,text?,html?}`; authorized sending domain/mailbox, suppression and send quota enforced. Success HTTP 202 `{ok:true,id,status:'queued'}`, NOT proof of email delivery. Keys checked by `src/features/mail/server/api-auth.ts`.
- Passive adapter `lib/adapters/mkety-mail.ts` requires server-side HTTPS base URL and key. Validate actual account/domain, queue processor, SMTP delivery, bounce/suppression and transactional auth messages before cutover.

## Auth recommendation — lowest maintenance
- The inspected MketyDigital/mksaas `src/shared/lib/auth/providers/zitadel.ts` implements a ZITADEL OIDC adapter. `docs/HANDOFF_MKETY_AUTH_ZITADEL_CLOUDFLARE.md` describes Mkety Auth as owner of internal user/session/roles with ZITADEL substitutable as identity provider, using Authorization Code + PKCE and validated ID tokens. This is **architectural reuse**, not automatically a shared live identity platform. Source handoff documents earlier preview/production readiness blockers; do not assume production federation is ready.
- Recommend **Factsport auth port with stable internal Factsport user ID**, external identity mapping (issuer, sub) and independent entitlements/VIP. Prefer shared Mkety Auth/OIDC where available, otherwise a managed OIDC provider. Account portability is nontrivial: Supabase auth users/profile relationships must be reviewed with owner, not migrated blindly; some VIP obligations may require preservation.
- **ZITADEL Cloud Free** currently lists unlimited stored users but **100 daily active users**, limited admin/management quotas; may not be sufficient for a public sports site, and paid plan starts ~US$100/month. https://zitadel.com/pricing and https://zitadel.com/pricing/detail. Do NOT commit to free ZITADEL cloud as an unlimited-production auth option.
- Alternative for very low scale: existing shared Mkety Auth installation if economics/tenant isolation verified. Avoid running a new standalone ZITADEL server/Keycloak VM solely for Factsport to save small licence fees: more operations, DB load, patching and outages. Authentication anti-bot via Cloudflare Turnstile Free (verify limits); account recovery and verification delivered by Mkety Mail.
- No automatic OIDC-login-to-old-user match by email alone. Require verified linkage, collision controls, revocation/session invalidation, role/admin isolation and recovery tests. Never expose Supabase service credentials.

## Live frontend and costs
- Factsport `app/providers/MatchLiveProvider.tsx` polls the external live-api Cloudflare Worker at 3s intervals while live, 60s otherwise; Cache API about 3 seconds for live. Prefer retaining this design behind same-origin URL and CDN caching. Cloudflare Workers paid lists 10m requests/month included ($5 account minimum), additional requests ~$0.30/million plus CPU beyond allotment; 3s polling for 1 continuously viewing client is roughly 20 req/min, 1,200 req/hour. Actual costs depend on active viewer-minutes, distinct match cache keys and worker execution. https://developers.cloudflare.com/workers/platform/pricing/
- WebSocket/DO is not automatically cheaper: introduces idle session/DO duration, service complexity and failure handling. Revisit only when measured viewer volume/CPU/cache miss rate shows a bottleneck.
- Independent background 1m DB cron, 5m reconciliation/settlement and periodic fixture sync do not drive frontend 3s responsiveness.

## Optional Azure/CF resources
**Use**: Azure PG B1ms + 32GiB + backup, Logic Apps Consumption, Azure budget alert; CF Worker, R2, tested Hyperdrive if pooling/egress warranted. **Existing Mkety AI + Mail** as remote APIs with scoped service keys.
**Do not add now**: Azure OpenAI, Azure Communication Services Email, Azure Functions, Redis, Service Bus, VM, Azure Blob Storage, premium Logic Apps Standard, extra Azure cache or separate dedicated ZITADEL VM.
**Contingent only**: Key Vault for secrets if needed (per-use bill); Azure Monitor/Log Analytics subject to spend caps, Cloudflare Queues/DO for proven throughput or chat fanout.
- Direct social FB/TG adapters can use application DB outbox and rate-limited retry; no extra Azure queue necessary initially.

## Active outstanding verification
- Main auth source and real deployed Mkety Auth/ZITADEL service, permitted relying-party apps, session/identity policy and projected DAU.
- Mkety AI enterprise account and model alias availability, request pricing/credit budget, API hostname, AI content policy and operational readiness.
- Mkety Mail activated sender domain/mailbox and delivery status flow.
- Exact Azure region, subscription quotation, networking, Hyperdrive conditions, and measured PG CPU credits/backups/latency. Owner agrees production follows staging validation; no provisioning until explicit approval in a connected Azure session.
- Port tests and typed integration/contract fixtures; the new adapters are source-backed but build/runtime tests not yet executed.

## Implementation status
- GitHub dev branch only. Files `lib/adapters/mkety-ai.ts`, `lib/adapters/mkety-mail.ts` added. They are not wired to existing Gemini or mail workflows.
- Cloudflare Workflow fallback remains a **documented, DISABLED future implementation plan**, not yet deployed or configured.
- Direct Facebook/Telegram implementations remain operationally separate and are **not** migrated.
