# Factsport modernization — master roadmap
Status: M0 discovery in progress | Repository: MketyDigital/Factsport | Branch: refactor/factsport-v2
Updated: 2026-10-30

## Governing decisions
- Preserve original repository and commit history throughout the modernization; repository remains PUBLIC until release and production reactivation. Do not put confidential audit outputs, user data, credentials or Supabase exports in this repo.
- Production is paused. Never deploy or trigger production-writing workflows without approval.
- Football media, live scores, news, fixtures, highlights and match center FIRST; prediction games and VIP SECOND.
- Use **vinext** as the target Cloudflare Workers deployment toolchain. Do not use OpenNext. Run `vinext check` on an upgraded compatible project, then `vinext init` in the isolated branch only after dependency checks; preserve Next.js as verification baseline until parity tests pass.
- Preserve both ESPN and football-data.org pathways, matching/arbitration behavior, match updates, editorial tools, games, prediction settlement and all other existing behaviors unless a change is explicitly approved.
- Replace Supabase methodically with Mkety Core PostgreSQL (authoritative) and Cloudflare supporting services; only use D1 where measured useful. Authentication migration requires its own tested plan.
- GitHub Actions hosted runner allowance and shared Mkety development runners are separate concerns; production is on Cloudflare.
- AdSense readiness means genuine policy-compliant content, navigation and monetization, not disguising prize or wagering mechanics.


## Clean-data reset decision (2026-10-30)
- **Fresh operational data, full system retained:** do not import old matches/events/scores, predictions, rankings, accumulated points, generated stats or operational logs. Recreate their database structures and re-enable all the systems that generate them so new data starts from zero.
- Recreate schema, constraints, functions, triggers, permissions, engines, providers, cron jobs, news tooling and integrations. Bootstrap new fixtures from ESPN/football-data.org safely; no mass social blast.
- Independently decide retention/migration of accounts, paid VIP entitlements, authored news/media and legal obligations; do not accidentally delete or invalidate them. Never delete old Supabase data during audit.
- See `docs/audit/DB-002-clean-reset-policy.md` for class-by-class rules, risks and acceptance gate.

## Evidence labels
- VERIFIED SOURCE: read implementation and record file paths, function names and behavioral evidence.
- INVENTORIED: path exists but implementation not fully reviewed.
- DB VERIFIED: confirmed by Supabase SQL metadata, redacted.
- RUNTIME VERIFIED: reproduced in tests or local preview.
- OPEN: not yet inspected or resolved.

## Milestones and gates
### M0 — baseline, scope, protections
- [x] Create `refactor/factsport-v2` from current main.
- [x] Enumerate tracked tree; initial inventory 162 files; 28 page.tsx, 26 route.ts(x), 5 scripts, 4 workflows (snapshot 2026-10-30).
- [ ] Record immutable baseline commit and verify branch HEAD; configure main protections with maintainer consent.
- [ ] Inventory complete feature surface and dependencies, file by file.
- [ ] Review current schedules: avoid costly/writing jobs running on untrusted code branches.
Gate: feature baseline accepted; no production writes.

### M1 — page / UI / content mapping
- [ ] Inspect 28 page routes, layout/providers, components, navigation, homepage, footer, news, highlights, match center and mobile UI.
- [ ] Record primary user journeys, empty/error/loading states, accessibility/SEO and AdSense eligibility.
Gate: full route-to-feature matrix, editorial-first information architecture.

### M2 — APIs / sports engines / schedules
- [ ] Inspect all 26 API routes, middleware, five scripts and four workflows.
- [ ] Trace football-data.org sync, ESPN fetch/live, ID matchmaker, dual-source arbitration, event/status reconciliation, deduplication, standings, logos and highlights.
- [ ] Trace AI/social/editorial automation and all external dependencies.
- [ ] Document rate limits, failure modes, ownership, retry and fallback, credential scope.
Gate: sequence diagrams, API/cron dependency map and provider fixture corpus.

### M3 — Supabase database and auth inventory
- [ ] Obtain read-only SQL metadata: public tables/columns, constraints/indexes, RLS/policies, public functions, triggers, cron jobs, extension names, approximate counts, storage bucket metadata and auth configuration indicators; never copy private user rows or secrets into PUBLIC repo.
- [ ] Trace each code DB call to table/function and which role can execute it.
- [ ] Plan schema migration, identity/session migration, dual reads or cutover, data verification, rollback.
Gate: signed-off data contract and zero-loss migration approach.

### M4 — executable regression baseline
- [ ] Unit tests: provider normalization, alias resolution, match statuses, timezones, provider disagreements, dedupe.
- [ ] Integration tests: fixtures/results, leaderboards, prediction limit, 3/10-point rules, VIP checklist, campaign bonus, settlement idempotency and monthly resets.
- [ ] E2E: public editorial flows, admin security, logged-in user journeys.
Gate: old baseline behavior reproducible.

### M5 — framework/toolchain modernization
- [ ] Upgrade Next.js/React/TS/Tailwind/lint/test dependencies in small groups; remove deprecated scripts.
- [ ] Run typecheck, build, tests and browser parity after each batch.
- [ ] Capture framework/runtime compatibility exceptions.
Gate: Next.js baseline checks passing.

### M6 — vinext and Cloudflare
- [ ] Run official vinext compatibility check, resolve findings.
- [ ] Run vinext alongside Next.js temporarily; compare routes, RSC, server actions, middleware, cache, image, fonts and cron behavior.
- [ ] Configure Cloudflare Workers, secrets, binding types, preview environments, observability, queue/cron and rollbacks.
Gate: Cloudflare staging parity and performance verified.

### M7 — database/auth/storage migration
- [ ] Migrate to Mkety Core PostgreSQL with isolated Factsport roles/schema, pooled connectivity/Hyperdrive tests.
- [ ] Decide on D1/KV/R2/Durable Objects only for justified use cases.
- [ ] Migrate auth, assets, SQL functions and triggers, RLS replacement, event jobs and audit logs.
- [ ] Validate counts, checksums, access controls, staged cutover and rollback.
Gate: no data loss, auth and settlement parity.

### M8 — media-first redesign
- [ ] Editorial landing page, live coverage, league/team/match pages, original content workflows, search, schema metadata, sitemap and performance.
- [ ] Ensure news/match data provenance, content licensing and affiliate/ad disclosures.
Gate: UX and editorial review.

### M9 — games, community, VIP enhancement
- [ ] Preserve existing prediction engines and documented How-to-Play requirements.
- [ ] Expose transparent rule progress; qualify rewards correctly; protect admin operations.
Gate: score reconciliation and eligibility tests passing.

### M10 — AdSense/compliance/security/performance
- [ ] Audit publisher restrictions against actual VIP/prize mechanics (not text-only concealment).
- [ ] Audit rate limiting, bot protection, authz, secrets, provenance, accessibility, Core Web Vitals, CDN cache and DB loads.
Gate: policy/legal reviews where required and security/quality thresholds met.

### M11 — staging, rollout and final Git-history decision
- [ ] Check release smoke, disaster recovery, backups, cutover, monitoring and incident runbooks.
- [ ] Production approval, then staged rollout on Cloudflare.
- [ ] Only AFTER success decide whether history reset/new private source snapshot is warranted. No history rewrite while work is in flight.
Gate: explicit production go/no-go.

## Every milestone must leave an agent handoff
Write `docs/audit/handoffs/MXX.md` with:
1. Scope and objective
2. Baseline commit and working branch/head
3. Source files inspected and evidence (exact path/function/line where possible)
4. What was changed (commit/PR) and what was NOT changed
5. Features/behaviors preserved, tests run, commands/results
6. DB schema objects and migrations involved (metadata only)
7. Risks/blockers/security notes, unresolved questions
8. Rollback steps, staging verification
9. Next agent's exact first actions and acceptance criteria
10. Status: INVENTORIED / VERIFIED SOURCE / DB VERIFIED / RUNTIME VERIFIED

## Early source-backed findings (2026-10-30)
- `package.json`: Next.js 14.2.35, React 18.3.1, Supabase client/SSR, and `@cloudflare/next-on-pages` deployed as legacy Pages approach.
- `app/lib/matchService.ts`: football-data.org v4 ingestion, league map and status conversion; `getExternalData` supplements match data from ESPN.
- `app/lib/espn.ts`: ESPN scoreboard and event summary helpers.
- `app/api/sync-fd/route.ts`: football-data.org fixture synchronization and ESPN fallback for league standings; updates Supabase `matches` and `standings`.
- `app/api/matchmaker/route.ts`: canonical name aliases, fuzzy ESPN-to-DB matching, ESPN ID assignment; safeguard against duplicate assignment in same run.
- `app/api/live/route.ts`: ESPN live update route; uses module-local `Map` called `kvCache` (NOT persistent Cloudflare KV). Must evaluate correctness across Worker isolates, concurrency and retries.
- `app/api/settle/route.ts`: calls Postgres RPC `settle_match_points`, then marks `matches.points_distributed`; inspect RPC for atomicity and idempotency before altering.
- `app/page.tsx`: existing editorial homepage blends news, highlights, fixtures, leaderboard/competition entry points and legacy ad integration.
- `app/how-to-play/page.tsx`: daily first-five limit, outcome=3, exact score=10, monthly VIP qualification, campaign rules; requires comparison with actual SQL settlement engine.
- `.github/workflows/allInOne.yml`: GitHub scheduled generation for AI pro slips, morning preview, matchday roundups; review runtime/credentials and potential duplicated schedule at 08:00 UTC.
These are verified file reads but NOT yet a complete file-by-file code audit.

## Provider precedence — user-confirmed on 2026-10-30
- **ESPN is authoritative for LIVE scores, match status/clock and rich events when successfully matched.**
- **football-data.org is used when ESPN matchmaker cannot match/synchronize the fixture, and to verify final-time (FT) scores.** Preserve existing scheduled fixture/bootstrap and standings workflows; they must not override ESPN's in-progress coverage.
- Do not reinterpret multi-provider support as equal-priority parallel live providers, or claim present ID collisions without evidence.
- M1/M2 acceptance: source provenance, stable internal `matches.id`, ESPN ID linkage/matchmaker, unmatched fallback, final-score reconciliation, ESPN cup import, retries, conflicts, anti-regression, and DB tests. See `docs/audit/SPORTS-001-fixtures-standings-schedules.md`.
