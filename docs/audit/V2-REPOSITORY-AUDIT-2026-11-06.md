# Factsport v2 repository audit checkpoint — 2026-11-06

**Repository:** `MketyDigital/Factsport`  
**Branch:** `refactor/factsport-v2`  
**Audited HEAD:** `e230fd71b67c47150161e04b178aa3211df99387`  
**Scope:** Git tree inventory, branch comparison, source/configuration review of the migration foundation, CI and staging run evidence, and existing migration/security matrices.  
**Status:** Partial repository audit; not production-ready. This checkpoint deliberately distinguishes source review, GitHub Actions evidence, and external account state.

## 1. Repository inventory

The recursive Git tree at the audited HEAD contains 264 tracked files:
- 138 files under `app/`
- 28 App Router page files
- 27 API route files
- 17 GitHub Actions workflows (4 legacy workflows and 13 v2 workflows)
- 13 files under `lib/`
- 13 Worker files
- 5 test files
- 34 documentation files

No root README and no `package-lock.json` are present. `.npmrc` sets `legacy-peer-deps=true`. CI currently uses `npm install`, so installs are not locked to a committed dependency graph.

## 2. Branch and release state

- V2 is 380 commits ahead of `main` and 2 commits behind it; the histories have diverged.
- No open pull requests or open issues were returned by repository search.
- The repository ruleset named `Protect main` exists but its enforcement is disabled.
- The audited V2 HEAD has a failing external status context named `Vercel` with a Vercel target URL. The inspected V2 build/deploy workflows use Cloudflare. Treat this as stale external status integration until repository settings are reviewed; do not treat it as evidence that V2 deployed to Vercel.
- The branch remains a staging/modernization branch. No production route, DNS, production database, or legacy Supabase resource was changed by this audit.

## 3. Current CI evidence

At HEAD `e230fd71`:
- [Native Vinext build 42285453250](https://github.com/MketyDigital/Factsport/actions/runs/42285453250) passed: engine tests, ingestion tests, score-preview Worker syntax, TypeScript and native Cloudflare build.
- [Protected app staging 42285453251](https://github.com/MketyDigital/Factsport/actions/runs/42285453251) passed: regression suite, TypeScript, native Worker build, protected staging deployment, auth denial, Hyperdrive/R2 health, PostgreSQL-backed `/matches`, cache isolation and keyset pagination.
- The staging log recorded intermittent first-attempt HTTP 503 responses from the matches API, followed by successful retries. The final workflow succeeded, but this transient failure is not root-caused and must not be represented as fully resolved.
- A prior run at commit `91f6d60` failed TypeScript with `app/admin/actions.ts(42,71): TS2339 Property 'league' does not exist on type '{ league: any; }[]'`. Commit `e230fd71` normalizes the relation as object-or-array; current TypeScript/build checks pass.

## 4. Confirmed V2 implementation boundary

The current staging app proves only a narrow vertical slice:
- Protected `GET /api/v2/health` checks Hyperdrive and R2.
- `GET /matches` renders initial match data through the read-only PostgreSQL adapter.
- `GET /api/matches` provides a PostgreSQL-backed read path with a timestamp + UUID cursor and explicit DTO projection.

The app's Cloudflare config binds the runtime reader Hyperdrive `895cca4c06104b8ab9f7c1b72a8ba18f`, not the administrator Hyperdrive. The schedule worker has a separate schedule-writer Hyperdrive. The ESPN parity preview now checks the database as `factsport_v2_reader` and performs zero writes. The administrator Hyperdrive is reserved for controlled setup/audit/hardening.

The current core migration defines only four tables: `matches`, `app_users`, `external_identities`, and `job_runs`. This is not the complete product schema.

The route and page migration matrices explicitly record that most pages and APIs still depend on Supabase, legacy secrets, or external Workers. Passing the current staging smoke test does not prove login, registration, profiles, VIP/payment, predictions, scoring, settlement, CMS, admin, chat, MOTM, social, email, video entitlement, or media migration parity.

## 5. Findings requiring action

### P0 — Release safeguards and legacy database authorization
1. Enable an appropriate `main` protection/ruleset with required CI and review; current `Protect main` enforcement is disabled. The GitHub connection could read the ruleset but could not inspect branch protection details or change repository administration settings.
2. The existing `SEC-001-supabase-rls.md` records critical legacy database policy/grant exposure involving profiles, site settings/social configuration, subscriptions, and user predictions. Treat the legacy production database as a release blocker until authorized containment, schema/API exposure review, and credential rotation are complete. No credentials or private rows were read in this audit.

### P1 — V2 runtime reliability and deterministic CI
1. Root-cause intermittent Hyperdrive/PostgreSQL 503 errors. Capture safe error class/code and connection lifecycle diagnostics; do not hide the problem behind retries.
2. Add a committed lockfile and move workflows to deterministic `npm ci` after resolving the existing peer-dependency policy intentionally.
3. Add lint, route authorization integration tests, browser/e2e page journeys, provider contract fixtures, and settlement replay/concurrency tests. Current CI has only five test files and no browser suite.
4. Verify the registered schedule Cron actually executes and refreshes staging data; workflow registration/source configuration alone is not runtime invocation evidence.
5. Complete a full effective privilege audit for every database role and confirm the live Azure firewall state. The 15 shared Cloudflare ranges are the owner-confirmed intended allowlist; this source audit did not query the live Azure firewall.

### P1 — Full product/data migration
Complete the missing schema and working domain services for identity/session lifecycle, profiles/roles, subscriptions/entitlements, predictions/eligibility, points ledger/settlement, campaigns/prize audit, competitions/standings/provider mappings, editorial/CMS, media metadata, social/email outbox, chat/MOTM, video entitlements, admin audit, and durable jobs. Implement actual adapters and route/page parity, not interfaces alone.

### P2 — Operational and release hygiene
1. Remove or correct the stale external Vercel status integration after repository settings are verified.
2. Add staging token expiry/rotation and cleanup guarantees for temporary Workers.
3. Add preview-only database credentials wherever a preview performs SELECT-only work.
4. Document backup/restore, monitoring, alerts, performance and rollback acceptance.
5. Add a root README with local setup, environment variable inventory (names only), architecture, test commands and staging/release instructions. Never add secret values.

## 6. Non-goals and safety boundary

Do not merge to `main`, enable production routes, change DNS, modify the production Azure firewall/database, run production migrations, reset legacy data, rotate production credentials, approve ESPN links, enable score writing, or turn on production jobs as part of this staging audit. Each requires its own reviewed plan and appropriate owner approval.

## 7. Next execution order

1. Reproduce and isolate the intermittent Hyperdrive 503.
2. Add deterministic dependency installation and expand CI quality gates.
3. Review the full V2 workflow/Worker/adapter/security surface and close configuration/authorization defects.
4. Complete the sports-data and public match-center parity slice (including ESPN link review, live updater, standings and media).
5. Implement identity/admin security and remaining product domains in migration order.
6. Prove staging Cron, failure recovery, backups, load and browser journeys.
7. Only then prepare a separate production cutover proposal.

**Conclusion:** V2 has a working, protected Cloudflare staging foundation and green native build, but it is not a complete Factsport replacement and is not approved for production cutover.


## Continuation update — 2026-11-09

The audit snapshot has been continued through M35–M40. New source-level implementation covers Stream webhook-backed participant presence and moderation; rights-cleared social image attachments and provider capability gating; append-only revision-scoped editorial source provenance; non-secret social channel configuration; durable social claim/deliver/result APIs; direct Meta/Telegram adapters; and a disabled Logic Apps recurrence template. The CI migration inventory now covers 0001–0037. This does not mean migrations 0027–0037 have been applied or that CMS/social/Studio staging E2E has passed. See ROADMAP and the M35–M40 handoffs for exact status and remaining acceptance gates.
