# M19 — Legacy Admin Writes, Editorial Operations and Automation Ownership

Date: 2026-11-07
Repository: MketyDigital/Factsport
Source audited: legacy `main`
Target: `refactor/factsport-v2`
Status: focused source audit and ownership classification; no production changes, SQL execution, migrations or data writes.

## 1. Scope and relationship to prior handoffs

This handoff continues M15-M18. It closes the source-inspection portion for the legacy admin command surfaces and the principal checked-in scheduled workflows. It does not declare their V2 replacements implemented or production-ready.

Existing evidence remains authoritative:
- M15: account/admin/settlement/automation inventory.
- M16: auth, VIP, campaign and morning automation details.
- M17: two-system ownership, settlement and SQL evidence correction.
- M18: media player, live studio and StreamIO identity.
- DB-001/002/003: sanitized database inspection findings and SQL function/cron evidence.
- FULL-SYSTEM-2026-11-06.md and V2-PARITY-REBRAND-ADSENSE-ACCEPTANCE.md: migration, staging and product acceptance constraints.

## 2. Mandatory ownership boundary

Factsport V2 remains one platform with two independently governed systems:

### Media system — factsport.com
- Public fixtures, results, scores, match metadata and provider ingestion.
- Editorial/newsroom, CMS, article provenance and publication.
- Match video/audio playback, highlights, live centre and public studio.
- Public standings, competitions, social distribution and media automation.
- Media match operations, media broadcast permissions and media retention policy.

### Prediction system — predict.factsport.com
- Registered prediction members and private account administration.
- Prediction entries, campaigns, game rules, prediction history and scoring.
- Settlement, monthly reset, winner qualification, prizes and prediction leaderboards.
- VIP/payment requests, proof review, entitlements and private commercial configuration.
- Prediction-specific administration and scheduled jobs.

Shared platform operations provide identity adapters, observability, secrets, provider infrastructure and job execution. Shared infrastructure does not make media and prediction business data interchangeable.

## 3. Admin command surfaces inspected

### 3.1 Newsroom — Media system

Legacy source: `app/admin/news/page.tsx`.

Verified behaviour:
- Browser-side Supabase client reads paginated news records and match data for logo suggestions.
- Article creation, editing and deletion are direct browser-side writes to `news`.
- Article fields include title, body, image, team logos, category, breaking/headline flags and generated slug.
- The Auto Bot action calls `/api/cron/news?key=${NEXT_PUBLIC_CRON_KEY}`.

Findings:
- The checked legacy repository tree contains no `app/api/cron/news/route.ts` path, despite the UI calling that endpoint. Treat the bot action as an unresolved/missing route in this source snapshot; do not claim it currently works.
- A cron key is referenced through a NEXT_PUBLIC environment variable and placed in a URL. This is not an acceptable V2 secret boundary.
- Direct browser CRUD must be replaced by authenticated CMS commands with explicit Media editorial permissions, field validation, revision history, provenance, human review and publication audit.
- Preserve the editor's existing article fields and workflows while adding V2 rights/provenance requirements. Do not silently discard legacy authored content.

V2 status:
- Editorial schema/read paths and provenance migrations 0004-0005 are committed but unapplied.
- Public news/article PostgreSQL read paths exist behind migration-specific flags.
- CMS create/edit/review/publish/unpublish/rollback commands and RBAC remain open. Read-path work is not CMS parity.

### 3.2 Match Manager — mixed legacy form; must be split

Legacy source: `app/admin/matches/page.tsx`.

Verified:
- Browser reads all match columns using `select('*')`, with search and pagination.
- Browser updates and deletes match rows directly.
- Save payload mixes public fixture fields (teams, league, date, scores, status, logos, venue, stage/group, provider IDs) with media fields (livestream/video/audio URLs, featured flags) and prediction/commercial fields (`booking_code`, `affiliate_link`, `is_bet_of_the_day`, `pro_analysis`, `campaign_id`, `points_distributed`).
- The page invokes `settle_match_points` directly from the browser, then separately updates `points_distributed`.

Ownership:
- Public fixture metadata, provider identity, public score/status correction and media playback metadata belong to Media.
- Campaign assignment, prediction analysis, settlement state, bookmaker/affiliate configuration and prediction-specific flags belong to Prediction/private commercial operations.
- A public Media match API/DTO must never return private analysis, campaign administration state, affiliate/payment data or settlement controls.

Requirements:
- Replace the mixed form with separate Media match operations and Prediction campaign/settlement commands.
- Enforce field ownership so manual edits cannot overwrite provider-owned fields without an explicit audited correction.
- No browser direct RPC or privileged writes.
- Keep settlement in the Prediction system and use the recorded DB-001/DB-003 scoring evidence; implement an atomic idempotent transaction and ledger only after the rule specification and edge cases are approved.
- Verify deletion/retention effects against prediction history and foreign-key behaviour before implementing any cleanup.

### 3.3 Campaign manager — Prediction system

Legacy source: `app/admin/components/AdminCampaignManager.tsx`.

Verified:
- Browser reads campaigns and match league values.
- On page load it detects expired campaigns, marks them inactive and unlinks matches.
- Create/update saves campaign fields including title, type, dates, VIP requirement, target leagues and JSON rules.
- Campaign save first persists the campaign, then separately unlinks existing matches and attaches matching league/date-window matches.
- Toggle and delete actions separately update campaign and match rows.

Risks:
- Multi-step writes are not atomic; partial failures can leave campaign state and match assignment inconsistent.
- Expiry cleanup is coupled to an admin page visit as well as the morning-post automation.
- Campaign rule changes need immutable snapshots for existing predictions; changing a live campaign must not silently rewrite historical scoring rules.

V2 requirement:
- Campaign CRUD and assignment belong behind Prediction RBAC and transactional server commands.
- Use explicit lifecycle states, timezone-aware expiry, immutable rule versions, durable expiry jobs and audit events.
- Keep public Media match reads free of private campaign administration data.

### 3.4 Monthly winner audit and approval — Prediction system

Legacy sources: `app/components/AuditManager.tsx`, `app/admin/actions.ts`, `app/api/admin/run-audit/route.ts`, `.github/workflows/monthly-audit.yml`.

Verified:
- Audit UI reads monthly winner drafts and related profile display information.
- Manual audit calls `triggerAuditAction()`.
- Approval updates `monthly_winners.is_approved/prize_amount` and separately sets `profiles.is_winner=true`.
- Rejection deletes a draft.
- The server action initializes a service-role client without independently checking the caller's authenticated identity, admin role or vault step-up.
- The server action and cron API implement different qualification/ranking/month/prize behaviour; M17 and DB-003 already record the contradictions.
- Cron invokes the GET audit endpoint with CRON_KEY in the query string.

Requirements:
- Do not choose either legacy implementation as canonical by accident.
- Use the existing SQL evidence and M17 conflict table; obtain owner approval for one versioned qualification policy, competition timezone, month window, candidate ranking and prize schedule.
- Store immutable run inputs/results, qualification evidence, rule version, approval actor, prize decision and payment/reversal state.
- Approval must be a server-authorized transactional command; do not separately update a profile badge and winner record.
- Make runs replay-safe and unique by competition period/run identity.

### 3.5 Monthly reset — Prediction system

Legacy sources: `app/api/admin/reset-monthly/route.ts`, `app/admin/components/ResetMonthButton.tsx`, DB-002 and DB-003.

Verified:
- Manual reset sends a bearer session token to the POST endpoint after a two-step browser confirmation.
- The endpoint also accepts CRON_KEY in a query parameter and uses a hardcoded email allowlist for manual admin access.
- The route resets only `monthly_points` and `monthly_correct_scores`.
- DB-003 records the SECURITY DEFINER `reset_monthly_leaderboard()` body as clearing those same two fields, without in-function authorization, period snapshot or audit; anon/authenticated EXECUTE grants were recorded.
- Eligible monthly counters are distinct and are not cleared by that function.

Requirements:
- Keep lifetime points, prize-eligible counters, campaign points and historical audit evidence distinct.
- Do not assume monthly reset means all monthly-looking counters are reset.
- Define period close, winner finalization, eligible-counter lifecycle and timezone before implementation.
- Replace direct RPC/blanket reset with an authorized, period-keyed, idempotent transaction and immutable rollover record.
- No reset function should be publicly executable.

### 3.6 Cleanup — Media data retention, with Prediction impact review

Legacy source: `app/admin/components/CleanupButton.tsx`.

Verified:
- Browser calls `delete_old_matches(months_to_keep: 12)` directly after confirmation.
- DB-003/M17 record the function as SECURITY DEFINER with a hardcoded admin-email check and no retention-parameter bounds check.

Requirements:
- This is not a routine UI convenience to port as-is.
- Match retention is a Media/platform data lifecycle decision, but deleting matches may affect Prediction history, settlement evidence and foreign-key dependants.
- Inspect the recorded function body and FK/cascade inventory before defining a replacement; do not infer all side effects from the function name.
- Use a bounded retention policy, dry-run counts, explicit protected-history rules, privileged scheduled execution and an auditable deletion report.
- No cleanup execution or destructive SQL was performed by this audit.

### 3.7 Global settings and social configuration — currently mixed

Legacy sources: `app/components/PromoSettingsManager.tsx`, `GameRulesManager.tsx`, `SocialSettingsManager.tsx`, `app/api/admin/settings/route.ts`.

Verified:
- Promo settings UI reads the full `site_settings` row and includes affiliate links/codes, payment gateway, crypto network/address, support contact and YouTube channel settings.
- The POST API only destructures and updates affiliate codes/links, default affiliate link and YouTube link; the other UI fields are not included in that API's update payload.
- The same settings surface therefore combines Prediction/private commercial data with Media public channel configuration.
- GameRulesManager directly reads/writes `daily_limit`, `target_exact_scores` and `min_points_floor`; these are Prediction rules.
- SocialSettingsManager directly reads/writes a large `social_config` object containing channel routing, templates and credential fields.
- M17/DB-001 record social credentials/configuration as legacy database material that must be treated as sensitive; do not expose values in public projections or repository notes.

Requirements:
- Split public Media settings (e.g. approved YouTube/public media configuration) from Prediction commercial/payment/affiliate settings and Prediction game rules.
- Store social credentials as secrets, not as a browser-readable JSON settings object. Keep non-secret channel preferences/templates in a narrowly scoped Media configuration model.
- Server-authorize every settings mutation; validate destinations and provider configuration; audit before/after changes.
- Public APIs must return explicit allowlisted projections, never entire settings rows.

## 4. Authentication, admin vault and user directory

Legacy sources: `app/admin/layout.tsx`, `app/admin/actions.ts`, `app/admin/VaultLock.tsx`, `app/admin/users/page.tsx`, `app/api/admin/users/route.ts`.

Verified:
- Admin UI combines a hardcoded email allowlist, profile role check and a 12-hour cookie whose value is the static string `true`.
- PIN verification compares the supplied PIN directly; source shows no rate-limit/lockout/audit workflow.
- The vault cookie is not a signed, user/session-bound step-up assertion.
- User directory uses service-role access and selects all profile columns before sending the full result to the client.
- VIP toggle is an admin API action; it updates a profile boolean, not an explicit entitlement lifecycle.
- The API checks an email allowlist and the static vault cookie but does not replace centralized RBAC, target validation, entitlement state or audit history.

Requirements:
- Replace email allowlists with centralized server-side permissions scoped by product and action.
- Use short-lived session-bound step-up for sensitive operations, with throttling, revocation and actor audit.
- Minimize profile PII, paginate/filter on the server and scope support access.
- VIP/payment review belongs to Prediction; a Media admin must not gain those privileges by virtue of a shared admin shell.
- Every server action/API route must authorize itself, even when its UI is hidden.

## 5. Automation ownership and checked-in schedules

| Legacy job / route | Correct owner | V2 migration constraint |
|---|---|---|
| Football-Data fixture sync and ESPN cup sync (`schedule.yml`, `sync-gh.js`, `fetch-espn-cups.js`) | Media / Platform Operations | Preserve provider maps, aliases, data richness, safe retries and durable job records. |
| ESPN matchmaker (`matchmaker.yml`, `/api/matchmaker`) | Media / Platform Operations | Keep identity reconciliation reviewed; remove query-string cron secret; no staging call to production. |
| Live scoreboard/details refresh (`/api/live`) | Media / Platform Operations | Preserve provider precedence and terminal repair; replace isolate-local dedupe with durable event/outbox idempotency. |
| Goal/lineup/kickoff/score social publication (`/api/social`) | Media | Durable outbox, channel-level outcomes, safe retries and private credentials. |
| Morning matchday social preview (`/api/cron/morning-post`) | Media | Media job only; split out the expired-campaign mutation currently performed at its beginning. |
| Daily editorial preview and matchday roundup (`allInOne.yml`, `daily-preview.js`, `daily-summary.js`) | Media | Preserve fact-grounded content, UTC date-window behaviour where intended, article idempotency, human review and per-channel publication evidence. |
| Pro AI slips / VIP delivery (`allInOne.yml`, `generate-pro-slips.js`) | Prediction / private product | Separate schedule/workflow and private delivery; never mix with public AdSense-first editorial surfaces. |
| Settlement (`/api/settle`) | Prediction | Atomic, idempotent settlement ledger; terminal status and correction policy; no GET query-secret. |
| Monthly winner audit and reset | Prediction | Approved rule version, period lock, review state and idempotent rollover. |
| Campaign expiry and assignment | Prediction | Durable lifecycle job; do not couple to Media morning post or page load. |
| PostgreSQL cron cleanup jobs | Platform Operations / owner review | Three job names/schedules are recorded in DB-003; command bodies were not supplied. Do not infer semantics or retention from names. |

### Schedule observations

- `allInOne.yml` has hourly Pro AI schedule from 02:00-12:00 UTC, daily morning preview at 08:00 UTC and daily roundup at 22:40 UTC. The 08:00 trigger overlaps the hourly schedule. Manual dispatch supports each job and run-all.
- `schedule.yml` runs Football-Data sync every 12 hours and ESPN cup sync in the same workflow.
- `matchmaker.yml` runs at 06:00 and 12:00 UTC.
- `monthly-audit.yml` runs at 00:00 UTC on the first day of each month.
- These are source-defined schedules, not proof of current runner health or actual production side effects.
- Legacy workflows inject service-role credentials into GitHub-hosted scripts or call production HTTP endpoints. Keep them as legacy production dependencies only until a separately approved cutover; never reuse their production secrets or URLs in V2 staging.
- The morning-post route currently expires campaigns and unlinks matches before it performs Media social publishing. That Prediction lifecycle work must move to its own Prediction job.
- The daily summary creates a date-slugged news item if one does not already exist, using finished match scores/events as its factual prompt; social delivery outcomes need separate durable evidence.
- The news editor's Auto Bot endpoint is not present in the checked legacy repository tree.

## 6. Existing database evidence — do not re-audit from zero

This handoff intentionally relies on, rather than replaces, the sanitized records in DB-001/002/003 and the correction in M17.

- `settle_match_points` ordinary monthly outcome/exact-score award and campaign bonus behaviour are recorded in DB-001 and M17.
- `reset_monthly_leaderboard()`, `secure_predictions()`, `protect_profile_stats()`, `secure_prediction_insert()`, `delete_old_matches()`, `is_admin()`, `audit_monthly_winners()` and `refresh_group_standings_from_matches()` have recorded findings in DB-002/003 and M17.
- SQL findings include missing trigger attachment for `secure_prediction_insert()`, the active `secure_predictions()` trigger, broad function EXECUTE grants, unsafe SECURITY DEFINER surfaces and the absent `public.group_standings` dependency.
- Three pg_cron names/schedules are known, but their command bodies and precise effects remain unknown. Do not infer behaviour from names.
- Raw production function definitions, credential-bearing command bodies and private records must remain outside public Git.

## 7. V2 implementation status and priority

### Media-first delivery remains the priority

The owner-approved sequence is to complete the public Factsport media platform first. Free prediction is a supporting feature, not the centre of the modernization.

Existing V2 work includes:
- Editorial/media schema and provenance migrations 0004-0005 (committed, unapplied).
- Homepage/read-model migration 0006 and player statistics migration 0007 (committed, unapplied).
- Public news/article, homepage, highlights and standings opt-in PostgreSQL read paths.
- Migration-specific flags and public DTO boundaries.
- Match identity alias foundation and incremental match-centre access hardening.

Not complete:
- CMS server-side writes, review/publish/rollback and Media RBAC.
- Media match operations and full route/page parity.
- Rights-controlled media upload/ingestion and full player/studio replacement.
- Durable social outbox and channel delivery history.
- Provider freshness, reconciliation and scheduled job proof.
- Browser journeys, accessibility, mobile and performance acceptance.
- Separation of private Prediction admin/commercial functionality from Media admin.

Do not enable read flags before the corresponding migrations are applied in isolated staging and the exact reader grants and route probes pass. No public page is complete solely because its read endpoint returns data.

### Recommended next work

1. Continue the Media-system audit against the page/route/component migration matrices; complete the CMS write/review/publish contract and media match-operation contract.
2. Define the Media RBAC roles and server-side command boundary, then implement one small staging-only CMS vertical slice with audit/revision/provenance tests.
3. Split the mixed legacy Match Manager into Media-owned match fields and Prediction-owned campaign/settlement/commercial commands.
4. Design Media social outbox and provider/job observability; keep social credentials in secret storage.
5. Keep Prediction settlement/VIP/campaign implementation tracked separately against M17 and DB-001/002/003; do not allow it to block the public media page/read-path work unless a shared boundary is affected.
6. Keep all production routes, DNS, secrets, legacy schedules, database permissions and destructive jobs unchanged pending explicit release approval.

## 8. Evidence and limits

This is a repository source audit of selected legacy `main` files and V2 audit records. It is not a live Supabase, Cloudflare, Azure, GitHub Actions, payment-provider or social-platform audit. It does not prove current production workflow execution, cron command semantics, active credentials, or browser-visible behaviour.

No database function was executed, no SQL migration was applied, no production endpoint was called, no secret was read into this document, and no production data, DNS, Worker, route or credential was changed.
