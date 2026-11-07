# M17 — Legacy Settlement, VIP, Admin and Content Ownership Audit

Date: 2026-11-07
Source audited: legacy `main`
Destination: `refactor/factsport-v2`
Status: source audit only; no production changes and no database migrations applied.

## 1. Mandatory V2 product boundary

Factsport V2 is one platform with two separately governed product systems:

- **Media system — `factsport.com`:** public editorial/media, football data and match-centre experience, public fixtures/results/live scores, competitions/standings, highlights/video, public newsroom/CMS, and public audience features.
- **Prediction system — `predict.factsport.com`:** member identity and accounts, prediction entry, VIP and premium entitlements, campaigns/rules, scoring/settlement, monthly competitions/prizes, payment and proof review, prediction leaderboards, and prediction administration.

Shared platform capabilities (identity primitives where deliberately shared, provider ingestion, observability, infrastructure) do not erase the product boundary. Private prediction records, payment proofs, VIP analysis and admin controls must never leak into public media APIs or public editorial pages. A public match page may display an explicitly approved public prediction entry point, but the prediction workflow and its private state belong to the prediction system.

## 2. Newly verified legacy findings and ownership

| Legacy feature/workflow | Correct V2 owner | Migration requirement |
|---|---|---|
| `/api/settle` and `settle_match_points` RPC | Prediction system | Rebuild settlement as a single atomic, idempotent transaction with concurrency protection and durable settlement ledger. |
| Manual match settlement in admin match editor | Prediction system admin operation | Do not keep a privileged client-side RPC call in the media match editor. Use an authorized prediction-admin command. |
| `profiles.monthly_points`, `monthly_correct_scores` reset | Prediction system | Reset only derived monthly counters in a transaction; define period/timezone and preserve lifetime points and eligibility counters. |
| `eligible_monthly_points`, `eligible_monthly_correct_scores` | Prediction system | Define one authoritative ledger/counter model and reconcile how counters are incremented, reversed and reset. |
| `monthly_winners` and monthly audit qualification | Prediction system | One canonical qualification engine, versioned rules, explicit month window, immutable audit report, review/approval state and idempotent reruns. |
| VIP subscription request, payment method, transaction reference and proof image | Prediction system | Server-owned request creation, private proof storage, MIME/size validation, signed short-lived review URLs, retention policy and duplicate/pending-request protection. |
| VIP approval/rejection and expiry | Prediction system | Atomic authorized server action: subscription state + entitlement grant/revoke + expiry + audit event in one transaction. |
| Campaigns, campaign rules, target leagues, match assignment and expiry cron | Prediction system | Campaign lifecycle, eligibility, rule snapshot at prediction time, timezone-aware expiry and auditable assignment. |
| PredictionBoard main outcome, exact score, bonus markets, lineup candidate options and kickoff lock | Prediction system | Preserve campaign-dependent score optionality, bonus scoring and lineup candidates; enforce lock and one-prediction rules server-side. |
| Public fixtures, match results, score/status, league/competition metadata | Media system | Public match read model and provider ingestion remain in media domain; expose only public-safe fields. |
| Admin newsroom article creation/edit/delete and bot ingestion | Media system | Move editorial writes to authenticated CMS APIs with roles, review/publish workflow, revisions, source provenance and media rights checks. |
| Match metadata, team/venue/competition, public display state | Media system | Media match operations stay in media admin; remove prediction-only and private fields from its DTO and controls. |
| Match media URLs / public live studio programming | Media system, with restricted publishing | Media publishing controls require server authorization, validated provider references and public/private media policy. Do not expose private StreamIO credentials/tokens. |
| Affiliate links, bookmaker codes, VIP promotion/payment settings | Prediction system/private commercial configuration | Never surface on public Factsport media pages by default; maintain explicit separation from AdSense-first public media policy. |
| Social daily preview/roundup, public matchday schedule and editorial distribution | Media system | Keep media-owned. Social credentials and automation configuration must be private server-side secrets/settings. |
| Cron locks/logs, provider ingestion and public match freshness | Media platform operations | Keep only media ingestion jobs here; prediction settlement, monthly audit/reset and campaign expiry belong to prediction jobs. |

## 3. Specific source findings

### 3.1 Settlement

Legacy `app/api/settle/route.ts`:
- Uses `GET` with CRON_KEY in the query string.
- Selects up to 10 matches with statuses `FT`, `FINISHED`, `ABD` and `points_distributed=false`.
- Calls `settle_match_points(target_match_id)`, then separately updates `matches.points_distributed=true`.
- A crash between RPC and flag update can cause a retry; concurrent invocations can select the same match. Correctness depends on unseen RPC internals.
- Admin match editor also calls the RPC from the browser and separately updates the flag.
- The legacy repository tree contains no SQL migration/function source for `settle_match_points`; function body, triggers and counter side-effects remain unverified and are a hard migration blocker. Do not infer its scoring logic from the route.

V2 must make settlement atomic and idempotent, with unique settlement identity per match/prediction, explicit supported terminal statuses (including reviewed AET/PEN/AWARDED policy), ledger entries, counter updates and audit logs in one transaction. No browser direct RPC.

### 3.2 Monthly reset and winner audit

Legacy `app/api/admin/reset-monthly/route.ts`:
- Uses POST, but accepts CRON_KEY in URL query or a bearer token whose email matches a hardcoded allowlist.
- Service-role updates all profiles setting only `monthly_points=0` and `monthly_correct_scores=0`.
- It does not reset `eligible_monthly_points` or `eligible_monthly_correct_scores`; those are distinct fields and their lifecycle is not explained by this route.
- It has no explicit period lock, transaction or durable reset-run record.

Legacy `app/api/admin/run-audit/route.ts`:
- Uses GET and CRON_KEY query authentication.
- Audits previous calendar month by prediction `created_at`, but ranks the top 15 using current eligible counters, not a month-scoped aggregation.
- Checks at least 3 active weeks, exact scores across 4 leagues, home/away/draw mix, scoreline variety, at most one 0-0, VIP, at least 100 eligible points and at least 4 eligible correct scores.
- Drafts up to 3 passing users, but pushes a draft row before checking qualification and increments rank only for passers. It uses fixed `$500/$300/$200` labels.
- Deletes prior unapproved drafts for the month and inserts replacements without a transaction or run lock.

Legacy `app/admin/actions.ts::triggerAuditAction` is not equivalent:
- Uses current month rather than previous month.
- Reads settings for `target_exact_scores` and `min_points_floor` (fallback 4 and 100).
- Selects top 5, reads predictions with `points_awarded >= 10` without a month window or prize-eligibility filter, and applies a different week calculation.
- Uses a different prize schedule (`$500 Cash`, `$200 Cash`, `Free VIP`) and rank handling.
- Does not visibly authenticate/authorize the caller before creating a service-role client and writing drafts.

These are conflicting business rules, not two valid implementations to carry forward. Product owner must approve one canonical monthly competition policy before migration. Keep the current V2 prediction migration/schema from being treated as parity-complete until this is resolved.

### 3.3 VIP/payment workflow

Legacy `app/vip/upgrade/page.tsx`:
- Reads public site settings for gateway/crypto details and support contacts.
- Requires login before submitting; accepts either a transaction reference or screenshot.
- Compresses screenshots client-side, uploads to public Supabase Storage bucket `payment_proofs`, then inserts a pending `subscriptions` row.
- Checks for an existing pending request client-side only; concurrent submissions and direct API writes need server enforcement.
- Stores plan `monthly`, amount `5`, payment method, transaction reference and proof URL. The page contains a hardcoded crypto-address fallback.
- A public proof URL is not suitable for private payment evidence in V2.

Legacy `ApproveButton`:
- Browser directly updates subscription status to active, then separately updates profile `is_vip=true` and expiry to now + 30 days.
- These are two independent writes; partial success can leave inconsistent subscription/entitlement state.
- Rejection is also a direct browser write.
- No visible server-side admin authorization in this component.

V2 requirement: payment request and entitlement are separate states. A verified payment review must grant an explicit entitlement with start/end, source, approver and audit trail. Approval/rejection must be server-authorized and atomic; no client can grant VIP by changing a profile boolean. Proof objects are private, access-controlled, malware/type/size checked and retention-managed. Gateway/crypto configuration is prediction-private and must not appear in public media settings.

### 3.4 Admin and newsroom

- `app/admin/studio/actions.ts::updateStudioSettings` creates a service-role Supabase client and writes `global_studio` without an explicit caller authentication/authorization check inside the action. This is a critical legacy authorization defect.
- `app/admin/actions.ts::triggerAuditAction` similarly performs privileged service-role reads/writes without visible caller authorization.
- `app/admin/news/page.tsx` performs browser-side direct reads, inserts, updates and deletes on `news`; it also invokes a bot using a public environment variable for a cron key. V2 editorial writes must be server-authorized and cron secrets must never be exposed in client bundles or query strings.
- `app/admin/matches/page.tsx` uses browser-side direct writes to matches, includes public match fields mixed with affiliate URLs, livestream/audio/video URLs, `pro_analysis`, campaign assignment and settlement. Split media match management from prediction campaign/settlement administration; do not port this mixed form as-is.
- `app/api/admin/users/route.ts` has a hardcoded email allowlist plus a 12-hour vault cookie. V2 needs role/permission-based authorization, short-lived session-bound step-up, throttling and auditable privileged actions.
- `app/api/admin/settings/route.ts` protects writes with a hardcoded email allowlist, but mixes affiliate links/codes and YouTube settings. Separate public media configuration from prediction-private commercial configuration.

## 4. Explicit non-parity / unresolved evidence

1. The legacy repo does not contain SQL definitions for `settle_match_points`, counter triggers, prediction scoring triggers, or monthly reset functions. These must be obtained from the actual database schema/export or authoritative SQL source before implementing equivalent behaviour.
2. The legacy reset route only resets two counters. The lifecycle of eligible counters, lifetime points and monthly leaderboard snapshots remains unresolved.
3. Two monthly audit implementations disagree on month window, source predictions, league threshold, ranking, prize labels and qualification logic. Owner approval is required.
4. Payment gateway checkout/verification, webhook reconciliation, refunds/chargebacks and proof storage policies are not fully verified from the inspected page.
5. Hardcoded admin allowlists, public cron key exposure, query-string cron secrets, service-role actions without local authorization, and public payment proof URLs are security defects. V2 must fix rather than reproduce them.

## 5. Migration ownership guardrails

- The public media database/API must not expose prediction submissions, private user profiles, VIP entitlements, payment/proof records, prediction scoring ledgers, campaign admin state or premium analysis.
- The prediction system may reference a stable public match identifier and consume a published match/competition feed. It must not own the public fixture/result source of truth.
- Public media pages may link to prediction entry points only through an explicit, reviewed integration contract. Anonymous free prediction is still a prediction-system workflow.
- Separate admin roles and API authorization scopes for media editorial, media match operations, prediction operations, finance/payment review and platform operations.
- Shared identity must be an explicit design decision. A media reader must not become a prediction member merely by visiting Factsport.com; email collection for free prediction is not account login.
- Keep public AdSense-first media policy separate from prediction commercial, affiliate, VIP and payment configuration.

## 6. Next audit sequence

1. Obtain/export legacy SQL definitions and inspect scoring/counter triggers.
2. Inspect remaining subscription/payment settings and any checkout/webhook implementation.
3. Finish media player/provider matrix and distinguish public media publishing from private StreamIO identity/invite flows.
4. Inspect all remaining admin actions and automation routes; assign each to media, prediction or platform operations.
5. Convert the ownership matrix into V2 API/schema acceptance tests before enabling any legacy replacement flag.

No production endpoints, DNS, secrets, migrations or data were changed by this audit.
