# Factsport v2 route and API migration matrix

**Updated:** 2026-11-06  
**Branch:** `refactor/factsport-v2`  
**Purpose:** Route-level migration register for the legacy App Router surface. This is an implementation checklist, not proof of parity.

## Current state

The current v2 Cloudflare Worker has these database-backed paths deliberately enabled for staging:
- `GET /api/v2/health`: protected staging dependency probe (Hyperdrive + R2).
- `GET /matches`: server-rendered initial match list and optional team form through the read-only PostgreSQL adapter when `FACTSPORT_MATCHES_BACKEND=postgres`.
- `GET /api/matches`: read-only PostgreSQL load-more API with stable `(match_date,id)` keyset pagination, explicit public match projection and private/no-store staging responses.

All other routes listed below still import or depend on legacy Supabase, old secrets, or external services and must not be treated as production-ready in the vinext Worker. The staging build currently supplies placeholder Supabase build variables; passing the app health/matches tests does not prove the remaining routes.

## Route register

| Legacy route | Current source dependency / behavior | v2 destination | Acceptance requirements |
|---|---|---|---|
| `GET /api/admin/reset-monthly` | Supabase service role; mutates profile monthly counters; mixed CRON key/admin email auth | Admin competition operations + monthly lifecycle job | No public GET/secret query key; server admin role + step-up; transactional ledger/reset; timezone and replay tests |
| `GET /api/admin/run-audit` | Supabase service role; reads profiles/predictions and writes monthly winner drafts | Prize qualification/audit service + durable monthly job | Pure qualification engine, correct 13-point exact score semantics, only qualified candidates ranked, deterministic ties, approval and replay audit |
| `POST /api/admin/settings` | Supabase session + email allowlist; service-role update to site_settings | Settings service + server-side policy | DB-backed role, field allowlist/schema validation, secret separation, audit log, CSRF |
| `POST /api/admin/users` | Supabase session/email list + unsigned vault cookie; service-role profile VIP update | User/admin entitlement service | Signed/session-bound step-up, immutable audit, entitlement ledger, idempotent action and role tests |
| `GET /api/cache/leaders` | Supabase view/table `top_players` | Leaderboard read model | Query contract, cache policy, privacy-safe public projection, deterministic ranking |
| `GET /api/cache/match-widget` | Supabase matches | Match widget read API | Read adapter, canonical match ID, status/score freshness and edge-cache tests |
| `GET /api/cache/standings` | Supabase standings | Standings read API | Season-aware standings schema, provider freshness, deterministic group ordering |
| `GET /api/cron/morning-post` | Supabase campaigns/matches/cron_logs/site_settings; Facebook/Telegram | Editorial scheduler + AI draft + social outbox | Durable run key, approved content, direct FB/TG adapters, secrets, review workflow, no duplicate posting |
| `GET /api/evening-roundup` | Supabase matches/cron_logs/site_settings; Facebook/Telegram | Editorial scheduler + AI draft + social outbox | Provenance, source links, idempotency, approved publishing, job ordering and retries |
| `POST /api/index-url` | Google Indexing API service-account JWT | SEO/indexing adapter + job queue | Server-only service credentials, domain allowlist, quota/rate limit, durable retries and observability |
| `GET/POST /api/live` | Supabase matches; ESPN live fetch; in-memory event dedupe and async side effects | Fast live proxy + durable live event/outbox pipeline | ESPN-first policy, source-health failover, durable dedupe, cache 3s, no duplicate/lost social events |
| `POST /api/logos/sync` | Supabase team_logos + Supabase Storage team-logos | Media/club asset service + R2 | Allowlisted provider URLs, content-type/size validation, private write, immutable object keys and rollback |
| `GET /api/match-data` | Supabase match center details; Referer/Sec-Fetch-Site heuristics and CRON key | Match center read API | Real auth for private data, public data projection, cache based on match state, request rate limiting |
| `GET /api/match/[id]` | Supabase match + external matchService data | Canonical match center service | Stable UUID, provider joins, full details/events/lineups/stats, not-found/error semantics |
| `GET /api/match/pin` | Supabase session + matches | User match-follow service | Authenticated user identity, uniqueness, user-scoped row policy, notification preferences |
| `GET /api/matches/highlights/sync` | Supabase matches; Google/YouTube search | Highlights ingestion + media metadata | Search quota, match identity, rights/provenance, idempotent association, reviewed media display |
| `GET /api/matches` | Legacy Supabase fallback or v2 Postgres when `FACTSPORT_MATCHES_BACKEND=postgres`; 15-row keyset pagination | Public match-list read API | Staging token gate; private/no-store; timestamp+UUID cursor; explicit public DTO projection; bounded league/status filters; production caching only on a safe public projection |
| `GET/POST /api/matchmaker` | Supabase matches + ESPN scoreboard matching | Provider identity reconciliation service | Exact team/kickoff matching, candidate review, unique provider IDs, no score/settlement writes |
| `GET /api/og` | Dynamic Open Graph image | Cloudflare image response/static generation | Stable metadata, bounded input, cache and SEO tests |
| `GET /api/media/[...key]` | New V2 route: PostgreSQL `public_media_assets` rights check + private R2 object read; raster images only. | MediaStore public delivery | Apply 0004-0005; verify R2 binding, rights expiry, content-type/size/ETag/304, cache and denied-object behavior in staging |
| `GET /api/settings` | Legacy fallback now selects only affiliate fields and the featured-match JSON path; PostgreSQL branch reads `public_homepage_settings` only. It no longer selects the entire settings row. | Public configuration read model | Migrate approved affiliate config to typed V2 settings; validate PostgREST JSON projection, cache, rate and schema; no social/provider secrets |
| `GET /api/settle` | Supabase service role + `settle_match_points`; marks points_distributed separately | Transactional settlement job/API | Internal authenticated POST/job runner; single DB transaction + unique ledger; verified FT only; replay/concurrency/correction tests |
| `POST /api/social` | Supabase socials/site_settings/matches; Buffer, Facebook, Make, Telegram; in-memory Set | Social event dispatcher + transactional outbox | Direct FB/TG preserved; Logic Apps adapter for third-party automation; per-channel idempotency; durable delivery states; no secrets in URLs |
| `GET/POST /api/stream/token` | Supabase profile lookup + signed video token | Video entitlement/token service | Server-side session/entitlement check, short TTL, provider-specific signing, rate limiting, no user ID spoofing |
| `GET /api/sync-fd` | Supabase matches/standings; football-data.org + ESPN fallback; CRON key | Fixture, FT verification and standings jobs | football-data primary fixtures; ESPN fills gaps/preferred fast live; verified FT correction; preserve unknown scores; durable job state; standings atomic swap |
| `GET /api/v2/health` | Cloudflare Hyperdrive + R2; staging-only protected probe | Operational health endpoint | Keep private/no-store, no secrets or user data, dependency status only; production health must not expose internals |

## Related server actions and server-only paths

| Source | Current concern | v2 destination |
|---|---|---|
| `app/admin/actions.ts:triggerAuditAction` | Service-role action without independent authenticated admin/role/step-up check | Prize audit command with server-side RBAC, audit trail and replay protection |
| `app/admin/actions.ts:verifyAdminPin` | Static PIN and unsigned 12-hour boolean cookie | Signed/session-bound step-up or IdP MFA, rate limit, expiry and revocation |
| `app/admin/studio/actions.ts:updateStudioSettings` | Service-role write without caller authorization | Studio settings command with RBAC and field validation |
| `app/lib/supabase/server.ts` | Legacy Supabase SSR session client | Provider-neutral session adapter and verified OIDC session |
| `app/lib/supabase/admin.ts` | Supabase service-role factory | Remove from v2 runtime; dedicated narrow server-side DB roles |
| `app/lib/espn.ts`, `app/lib/matchService.ts` | Legacy provider normalization and match data access | Provider ports + shared normalized sports domain |

## Priority migration sequence

1. **Security and identity:** replace all Supabase session/email checks, CRON query secrets and unsigned vault state with provider-neutral authenticated sessions, role-based authorization, step-up and worker credentials.
2. **Sports core:** complete canonical match/competition/provider identity, fixture ingestion, ESPN linking, live proxy, FT verification, standings, highlights, and match center.
3. **Transactional gameplay:** predictions, eligibility, points ledger, settlement, campaigns, VIP and monthly prize audit.
4. **Editorial and media:** CMS/provenance/review, R2 media, AI draft, SEO/indexing.
5. **Community and video:** chat, MOTM, match pin, stream entitlement/token.
6. **Operations:** durable jobs/outbox, social integrations, email, cleanup, observability, alerts, backup/restore.

## Route completion definition

A route is not complete because it compiles or returns HTTP 200. For every route, require:
- typed request/response contract and validation;
- authenticated or intentionally public access policy;
- least-privilege repository/adapter and no legacy Supabase dependency;
- durable transaction/idempotency where it writes;
- cache, rate-limit and abuse behavior;
- provider timeout/retry/error handling;
- unit + database integration + browser/end-to-end tests;
- structured logs, alerts and operational owner;
- documented rollback and data retention behavior.


## 2026-11-07 continuation — editorial and homepage API paths

- Added `GET /api/media/[...key]` for rights-cleared raster delivery from private R2. It first resolves the object key through the public media view; arbitrary bucket keys and SVG are not served.
- `GET /api/settings` now has a V2 PostgreSQL branch that returns only the featured-match pointer. The legacy path was narrowed to explicit affiliate fields plus the featured-match JSON projection instead of `select('*')`.
- Homepage featured-match/highlight and standings data are served by server-only adapters, not direct browser database queries. The full standings and highlights API/page surfaces remain open.
- Runtime verification requires applying migrations 0004-0006 to isolated staging; none has been applied to Azure yet.
