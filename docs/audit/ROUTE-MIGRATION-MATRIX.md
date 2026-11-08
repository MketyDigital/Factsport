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
| `GET /api/media/[...key]` | New V2 route: PostgreSQL `public_media_assets` rights check + private R2 object read; raster images only; conditional ETag and 60-second cache TTL so rights revocation is not hidden behind long CDN caching. | MediaStore public delivery | Apply 0004-0005; verify R2 binding, rights expiry, content-type/size/ETag/304, cache and denied-object behavior in staging |
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

| `GET /api/standings/leaders` | New safe route: explicit legacy `tournament_scorers` projection or PostgreSQL `public_competition_player_stats` view; validates league and goals/assists selector. | Competition player stats | Apply 0007; populate through provider ingestion, reconcile player identity/team/season and verify cache/freshness |


## 2026-11-07 competition API update

- Added \`GET /api/standings/leaders?league=...&stat=goals|assists\` with validated parameters and an explicit public response projection. The client toggle no longer queries Supabase directly.
- The full highlights page uses server-only PostgreSQL pagination/count/league readers and the rights-reviewed public highlight view when the match backend flag is enabled.
- Standings recent form is read from completed, scored matches scoped to the current competition season; no abandoned/unscored result is used.


## 2026-11-07 competition read API continuation

- Added `GET /api/competitions/matches?league=...`: allowlisted league, bounded match projection, base-schema PostgreSQL reader under `FACTSPORT_MATCHES_BACKEND`, narrow Supabase fallback.
- Extended `GET /api/cache/standings` with an explicit PostgreSQL competition standings view path under `FACTSPORT_COMPETITIONS_BACKEND`; invalid league codes are rejected and errors are sanitized.
- `LiveStandings` consumes these same-origin APIs and no longer initializes a browser Supabase client.
- These APIs are implementation slices, not proof of current-season data quality or complete route parity. Staging probes and data-provider reconciliation remain required.


## 2026-11-07 match detail API foundation

- `GET /api/match/[id]` now has an independently opt-in `FACTSPORT_MATCH_DETAIL_BACKEND=postgres` branch requiring migration 0008. It resolves canonical or legacy UUID alias and returns the normalized ESPN-enriched public match projection.
- The V2 projection intentionally omits stream/audio/video URLs, VIP pro-analysis, campaign IDs, affiliate URLs and settlement state. Staging responses are private/no-store.
- The main server-rendered `/match/[id]` page is not switched. Legacy ID reconciliation, media playback authorization, VIP RBAC, prediction/campaign parity and child-component service contracts remain blockers.

## 2026-11-07 match-centre playback and VIP route slice — M12

- Added GET /api/match/[id]/playback: validates a UUID, reads the legacy match's schedule/status/media metadata, applies the 15-minute pre-kickoff gate on the server, and returns no media URL fields while locked. After unlock it returns safe HTTP(S)/relative playback sources and preserves the existing streamio mode.
- Added GET /api/match/[id]/analysis: checks the server session and legacy profiles.is_vip value; public/non-VIP responses expose only hasAnalysis, while the analysis payload is returned only to a verified VIP profile.
- SecureMatchPlayer and ProBettingSlipLock consume these same-origin APIs. Regression coverage is in tests/match-media-access.test.cjs.
- Both routes still read legacy Supabase. They are not backed by PostgreSQL and have not been exercised against protected staging. The protected staging workflow currently validates the /matches read path, not /match/[id].
- Before treating these routes as complete, add signed short-lived playback grants or a controlled media proxy where provider capabilities allow, connect VIP checks to the V2 entitlement service, test all media/status branches and failure modes, and migrate the remaining match-centre service dependencies without changing legacy IDs or prediction references.

### M12 hardening follow-up — 2026-11-07

- Playback status handling now fails closed for unknown pre-kickoff statuses: only an explicit known-live status is treated as live; POSTPONED/CANCELLED/CANCELED returns unavailable rather than opening a stream. Time-based unlock remains available at/after the scheduled 15-minute threshold for other statuses.
- Relative media paths are kept same-origin instead of being rewritten to the production domain; protocol-relative paths, backslashes and path traversal are rejected. The existing streamio sentinel is preserved. Match-page metadata uses the same explicit live-status allowlist so an unknown status cannot expose a pre-kickoff stream URL through OpenGraph metadata.
- Final code head `ab3e924f29766f42ad35210ffd75e23892e58896`: isolated verification passed (run 42386252137; 104 engine tests and 5 ingestion tests), native vinext build passed (run 42386252158), and protected staging passed (run 42386252101).
- Staging continues to verify the protected `/matches` PostgreSQL path and infrastructure boundary only. It does not call `/match/[id]` or the new playback/VIP APIs; those remain source/test/build verified, not runtime verified.


## 2026-11-08 Media asset endpoints

| Route | V2 behavior | Acceptance / boundary |
|---|---|---|
| `GET /api/admin/media` | Media-role-protected search and pagination over private `media_assets` metadata; supports bounded query, rights-status filter and 50-row pages. | Requires `FACTSPORT_EDITORIAL_HYPERDRIVE`, editor/media role, private no-store response; test role denial, pagination, wildcard handling and DB outage. |
| `POST /api/admin/media` | Existing authenticated private R2 upload; JPEG/PNG/WebP only, 8 MB limit, signature verification, SHA-256 and pending rights state. | Requires same-origin request, Media role, R2 + editorial writer bindings; test body-size boundary, object/DB compensation and malformed image payloads. |
| `GET /api/admin/media/[id]` | New authenticated private R2 preview by internal asset UUID. | Media role required; raster allowlist, private/no-store, nosniff, sandbox CSP; never expose public bucket URLs or pending media through public delivery. |

The active Media admin login remains blocked on the identity migration: middleware retains a legacy email allowlist and unauthenticated admin layout redirects to the private-host-gated `/login`. Implement Entra External ID and a Media-host session before removing the old guard.

## 2026-11-08 editorial writer and social runtime boundary

- `app/admin/news/actions.ts` provides server-side draft/revision, submit-for-review, independent review approval, publish-approved and archive operations through the dedicated editorial PostgreSQL adapter. Publication records the public-media policy attestation and audit event.
- `app/api/admin/media` and `app/api/admin/media/[id]` provide role-protected media search and private preview; `POST /api/admin/media` stores validated pending images in private R2. `app/admin/news/media-actions.ts` reviews rights and attaches media to a draft revision.
- Social channel/publication configuration and an idempotent outbox are represented by migrations 0009 and 0015–0016, with public-media scope and publisher attestation in 0022–0023.
- **Source/test only:** these paths have not been exercised against the isolated Azure schema. Migrations 0004–0026, editorial writer grants/binding, Entra Media-host sign-in, R2 upload/compensation and non-production social delivery must pass before any route is marked runtime verified.
- Migration 0026 has a deliberate preflight that raises when existing queued/scheduled/publishing/published social rows or published editorial revisions lack the required attestations. Reconcile explicitly; never auto-approve or rewrite rows.


## Media editor enhancements — ordered inline gallery and reusable assets

- The newsroom can search and reuse previously approved, non-expired assets from the private Media library; selected assets retain their rights metadata and are previewed through the authenticated private R2 endpoint.
- Added ordered `inline` placement to revision-scoped media with migration `0027_factsport_revision_inline_media_gallery.sql`. Publication copies approved inline attachments to the article media relation at their chosen order; a new public view exposes only assets attached to published, reviewed articles with valid rights and unexpired usage.
- Public article pages now render the rights-filtered inline gallery with alt text and attribution. Reusing an existing asset no longer resets its global `is_public` flag, so one article revision cannot accidentally unpublish an asset already used by another published story.
- The public article sidebar no longer contains the prize/prediction acquisition message; it now links to neutral fixtures and live-score coverage, keeping private Prediction promotion out of the public newsroom surface.
- These changes are source committed; latest verification for commit `34494850b31ce530f960cfe30f46a95fe97e0927` is running. Do not mark migration 0027 or public gallery runtime complete until it is applied and exercised in isolated staging.
