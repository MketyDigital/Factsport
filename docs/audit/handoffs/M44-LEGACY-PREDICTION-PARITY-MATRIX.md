# M44 — Legacy Prediction parity and Media/Prediction boundary audit

Date: 2026-11-09
Branch: refactor/factsport-v2
Status: source/documentation audit; no Prediction API, settlement, account, campaign, VIP or production database activation performed.

## Governing evidence reviewed

- `docs/audit/DB-001-inventory-and-settlement.md`
- `docs/audit/DB-002-clean-reset-policy.md`
- `docs/audit/DB-003-functions-and-cron.md`
- `docs/audit/AUTH-005-public-anonymous-predictions-single-predict-account.md`
- `docs/audit/V2-PARITY-REBRAND-ADSENSE-ACCEPTANCE.md`
- `docs/audit/handoffs/M14-LEGACY-PARITY.md` through `M19-LEGACY-ADMIN-WRITES-AUTOMATION-OWNERSHIP.md`
- Current V2 source: migration 0003, PredictionBoard, match page, prediction settings route, legacy route isolation tests, and V2 API tree.

The detailed legacy SQL behavior below is taken from the sanitized, user-supplied database inspection recorded in DB-001/DB-002/DB-003. It is not inferred from the route or guessed from missing repository SQL. Raw private SQL definitions and credentials are not copied into Git.

## 1. Correct two-system ownership

| Capability | Owner | Boundary |
|---|---|---|
| Public fixtures, match pages, editorial/newsroom, highlights, public media video, live studio, SEO, social publishing | Media — `factsport.com` | Public-safe content and media operations only |
| Anonymous free prediction entry embedded as a public feature | Prediction service, surfaced by Media | Media may display the UI; submission, participant identity, eligibility and prediction records stay in Prediction-owned APIs/data |
| Registered accounts and identity claims | Prediction — `predict.factsport.com` | One canonical Factsport user; no email-only account |
| Campaigns, prediction rules, bonus markets and history | Prediction | Rule snapshots and match assignments are private Prediction data |
| Scoring, settlement, eligible counters and monthly competitions | Prediction | Atomic ledger; never triggered by public Media match writes |
| VIP, payment requests/proofs, entitlements and prize eligibility | Prediction | Private storage and admin RBAC; no public Media exposure |
| Provider ingestion and public match freshness | Media operations | Never owns Prediction settlement or prize state |
| Shared platform identity primitives, secrets, telemetry and job execution | Shared infrastructure | Does not merge business-data ownership |

## 2. Legacy behavior confirmed in the audit records

### Settlement and points

The user-supplied `settle_match_points(target_match_id text)` definition recorded in DB-001/DB-003 establishes:

- Ordinary correct outcome awards 3 points.
- Correct exact score adds 10 points; an exact score with a correct outcome therefore yields 13 in the ordinary case.
- Campaign scoring can configure outcome, exact score, first-scorer, red-card and penalty awards.
- The function uses `user_predictions.is_eligible_for_prize` to maintain separate eligible point/score tallies.
- It does not itself select the first five daily predictions.
- Campaign selection uses `matches.campaign_id` when present, otherwise the first active campaign matching `target_leagues`.
- It increments accumulated counters and does not itself guard against an already-settled prediction or serialize concurrent settlement.
- First scorer uses the first `goal` in JSONB event iteration and direct string equality; event ordering, own-goal, penalty and VAR semantics require normalization tests.

The legacy `/api/settle` route selects at most 10 `FT`, `FINISHED` or `ABD` matches with `points_distributed=false`, calls the RPC, then updates the flag separately. A crash or concurrent invocation can repeat increments. The route omits AET/PEN/AWARDED status decisions.

### Prediction eligibility and triggers

DB-003 records the actual trigger inspection:

- `user_predictions.enforce_prediction_security` actively invokes `secure_predictions()`.
- `secure_prediction_insert()` is present in the database but has no trigger attachment in the supplied trigger inventory.
- The current legacy `PredictionBoard` explicitly inserts `is_eligible_for_prize=false`; the normal UI path therefore does not obtain eligibility from the dormant trigger.
- `secure_predictions()` protects kickoff and selected prediction columns, but does not replace ownership, allowed-value, daily-allocation, campaign or concurrency enforcement.
- The dormant `secure_prediction_insert()` intended to use `site_settings.daily_limit` (default 5) and mark only the first configured number eligible, but COUNT+INSERT is not concurrency-safe and uses database `CURRENT_DATE`. Do not attach it unchanged.

### Monthly winner audit and reset

DB-003 and M17 record two materially conflicting audit paths:

- SQL `audit_monthly_winners()`: top three VIP candidates, month filtering without year, total monthly counters, and `points_awarded=10` for exact-score detection.
- SQL settlement exact-score result is normally 13, so the SQL audit's `=10` predicate excludes the normal exact-score result.
- The API audit uses previous calendar month and a different qualification set, including activity weeks, league diversity, outcome mix, scoreline variety, VIP, eligible points and exact-score checks.
- The TypeScript `triggerAuditAction` uses current month, top five, `points_awarded >= 10`, no matching month window in its prediction read, and a different prize schedule.
- The monthly reset function and API reset both clear `monthly_points` and `monthly_correct_scores`, but leave `eligible_monthly_points` and `eligible_monthly_correct_scores` untouched.
- The SQL reset function is SECURITY DEFINER with broad EXECUTE grants in the inspected legacy database. It must not be copied or invoked.

These are unresolved business-rule conflicts. No V2 monthly qualification, reset or prize policy may be called parity-complete until the owner approves one versioned rule set and period/timezone.

### Campaigns, VIP and accounts

- Legacy campaigns include title/type, start/end, VIP requirement, target leagues, active state and JSON rules. Match assignment is by explicit `campaign_id` or automatic first active campaign matching target leagues.
- The PredictionBoard uses campaign `rules.require_score` to allow an outcome-only prediction when exact score is optional. It also supports progressive bonus fields `first_scorer`, `red_card` and `penalty`; first-scorer options depend on roster availability.
- Legacy VIP approval activates a subscription and separately sets `profiles.is_vip=true` with a 30-day expiry. These two writes are not atomic. VIP request flow accepts transaction reference or screenshot and stores proof in a public Supabase bucket; this is not a safe V2 payment-proof model.
- Legacy auth uses Supabase auth/profile triggers; V2 AUTH-005 specifies one canonical Entra-backed Predict account and a controlled same-browser anonymous claim, never email-based auto-linking.
- DB-003 confirms active legacy auth.users triggers for `handle_new_user()` and `handle_verification_update()`. Their behavior must be replaced by explicit V2 identity lifecycle events, not copied as Supabase trigger dependencies.

### Standings function defect

DB-003 confirms `refresh_group_standings_from_matches()` references `public.group_standings`, while the supplied relation check returned NULL for that relation. Preserve the group-standings capability with a real V2 schema and tests; do not copy this broken function unchanged.

### Legacy scheduler inventory

DB-003 records three legacy pg_cron jobs by name and schedule only: `delete-unconfirmed-users`, `cleanup-old-cron-logs`, `daily-socials-cleanup`. Command bodies and exact effects were not shared. Do not infer retention behavior from names or recreate these jobs until their redacted commands and retention policies are reviewed.

## 3. Current V2 implementation comparison

| Capability | V2 evidence | Status |
|---|---|---|
| Anonymous contact deduplication | Migration 0003 `prediction_contacts.email_normalized UNIQUE` | Schema only; API not implemented |
| Opaque anonymous visitor identity | Migration 0003 `prediction_participants.visitor_token_hash UNIQUE` | Schema only; cookie/session not implemented |
| Prediction record and same-participant/match uniqueness | Migration 0003 `predictions`, unique participant/match and registered-user/match indexes | Schema only; submission API not implemented |
| Optional marketing opt-in and consent history | Migration 0003 `marketing_subscriptions` and append-only `marketing_consent_events` | Schema only; no confirmation/unsubscribe runtime |
| Anonymous-to-account claim/conflict records | Migration 0003 claim and conflict tables | Schema only; no Entra claim API |
| Prediction writer identity/Hyperdrive | No dedicated prediction API role or binding in current V2 runtime | Missing |
| Public prediction submit/read API | API tree contains only private Prediction settings; no public prediction submit/read route | Missing |
| Public PredictionBoard | Match page renders legacy Supabase PredictionBoard only in development; it is not rendered in production | Missing; must be replaced before public activation |
| Campaign tables, assignments and immutable rule versions | No V2 campaign schema in migrations 0001–0042; prediction row has only JSONB campaign snapshot | Missing |
| Prediction scoring/settlement ledger | No V2 settlement ledger or idempotent settlement command | Missing |
| Monthly qualification/reset | Legacy routes return 410; V2 admin action is an unavailable stub | Safely disabled; replacement missing |
| VIP/subscription/payment proof/entitlement | No complete V2 Prediction schema/API/admin flow | Missing |
| Group standings | Legacy function points to missing legacy relation; V2 public standings read model exists but group-specific calculation/qualification parity needs review | Partial; separate sports-data work |
| Legacy privileged route isolation | `/api/settle`, `/api/admin/run-audit`, `/api/admin/reset-monthly` and other Supabase side-effect routes fail closed; archived source and tests exist | Implemented safety boundary |

## 4. Critical conclusion

V2 has a sound first Prediction schema slice, but the Prediction product is not yet implemented end-to-end. It must not be described as prediction parity complete.

The legacy PredictionBoard still contains Supabase browser reads/writes and login gating, but the V2 match page hides it outside development. The old settlement, reset and audit routes are explicitly disabled. This is the correct fail-closed state; do not re-enable the legacy component or routes to fill the gap.

The unique normalized contact email in migration 0003 is the correct database foundation for avoiding duplicate email rows when the same visitor returns. The API still needs to reuse the existing opaque visitor cookie/participant and ask for email only on first explicit submission; a new device/cookie may create a new participant but should reuse the existing normalized contact row.

## 5. Next implementation sequence

1. Create and provision a dedicated `factsport_v2_prediction_api` role and Hyperdrive; grant only required match-read and prediction-contact/participant/prediction/consent columns. Never use the editorial writer or public reader as the Prediction writer.
2. Implement the server-side anonymous prediction API and first-party HttpOnly visitor cookie. Enforce same-origin, rate limits, match existence, authoritative kickoff lock, valid outcome/score, uniqueness and idempotent retries in PostgreSQL.
3. Replace the dev-only legacy PredictionBoard with a V2 API-backed component only behind an explicit public-prediction readiness flag. Preserve outcome, optional score, bonus markets and campaign snapshots; do not show login or email during ordinary browsing.
4. Add V2 campaign tables and assignment/rule versioning after mapping every legacy campaign field/rule. Snapshot the selected rule version on every prediction.
5. Implement same-browser claim on Predict after Entra identity is provisioned; never link by email and preserve same-match conflicts.
6. Build the private Predict account, VIP, payment-proof, entitlement and admin workflows separately from public Media.
7. Implement settlement ledger and atomic settlement using the documented scoring evidence; add idempotency, locking, reversals and tests for event normalization and terminal match statuses.
8. Obtain owner approval for one monthly winner qualification/prize/timezone policy before implementing audit/reset. Do not choose between the conflicting legacy SQL/API/TypeScript paths by assumption.
9. Rebuild group standings as a proper provider-first read model; do not port the broken legacy function.
10. Review redacted pg_cron command bodies with the owner and map each retention/scheduler responsibility to Media or Prediction before recreating jobs.

## 6. Safety and owner decisions

- Anonymous free predictions remain prize-ineligible by default until a separately approved eligibility policy exists.
- The legacy daily limit of five is a dormant trigger intent, not verified current behavior. Do not activate it unchanged.
- The 30-day VIP approval duration is a legacy UI behavior; confirm current plan/pricing/extension/refund rules before migrating entitlements.
- Monthly audit criteria, candidate count, period window/timezone and prize schedule conflict across implementations; explicit owner decision is required.
- No old prediction/user/VIP/payment/prize records are copied or deleted under the fresh-data rule without separate retention and contractual review.
- No production database, DNS, Entra tenant, Worker route, cron schedule, provider secret or public prediction switch was changed.
