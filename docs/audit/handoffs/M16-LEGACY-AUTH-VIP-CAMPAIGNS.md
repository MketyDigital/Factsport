# M16 — Legacy auth, VIP lifecycle and campaign automation details

**Date:** 2026-11-07  
**Repository:** MketyDigital/Factsport  
**Branch:** refactor/factsport-v2  
**Status:** SOURCE AUDIT IN PROGRESS; no production changes.

This pass extends M15 by reading the registration/login/recovery screens, dashboard calculations, subscription approval control and the actual audit/reset/morning-post route handlers.

## Authentication UX and anti-bot contract

Sources: `app/login/page.tsx`, `app/register/page.tsx`, `app/forgot-password/page.tsx`, `app/auth/callback/route.ts`, `app/auth/update-password/page.tsx`.

Verified:
- Login supports password sign-in and OAuth sign-in, and exposes resend signup confirmation email.
- Registration supports password sign-up and OAuth; registration UI uses Cloudflare Turnstile.
- Login UI also uses Turnstile with success/error/expiry callbacks.
- Forgot-password flow uses Turnstile and calls `resetPasswordForEmail` with redirect to `/auth/callback?next=/auth/update-password`.
- Auth callback exchanges Supabase authorization code and redirects to `next` or dashboard.
- Password update checks confirmation and a six-character minimum before calling `updateUser({ password })`.

V2 parity:
- Preserve OAuth provider list and callback/return flow; verify configured providers and redirect URIs before changing auth.
- Turnstile must be verified server-side on sensitive unauthenticated auth actions; client widget completion alone is not proof.
- Rate-limit login, signup, resend, recovery and callback abuse; avoid account enumeration.
- Validate `next` as a same-origin path and test expired/consumed links and provider errors.
- Preserve email confirmation and resend states; define email delivery templates and retry/abuse policy.

## Profile and dashboard business semantics

Sources: `app/dashboard/page.tsx`, `app/dashboard/settings/page.tsx`, `app/components/DashboardHistory.tsx`.

Verified:
- Profile settings allow a signed-in user to update `profiles.full_name`.
- Dashboard reads profile totals, campaign progress, user predictions/history, past wins and latest monthly winner.
- It displays `points`, `monthly_points`, `monthly_correct_scores`, `eligible_monthly_points` and `eligible_monthly_correct_scores` as distinct counters.
- VIP active state is computed as `is_vip` and either no expiry date or `vip_expires_at` later than current time.
- Campaign progress uses campaign `total_points`, `rules`, `is_vip_required` and active campaign association.
- Monthly prize qualification combines exact-score count, VIP active state and eligible points.

V2 parity:
- Preserve lifetime, current-month, campaign and prize-eligible counters as separate concepts and define reconciliation.
- Derive VIP active from entitlement records with expiry, not a stale boolean.
- Campaign progress must use immutable campaign rule snapshots for historical entries.
- Profile editing must be ownership-scoped; migrate prediction history and historical snapshots without recalculating away outcomes.

## VIP payment approval — exact visible transition

Source: `app/components/ApproveButton.tsx`.

Verified:
- Admin confirmation message says the user receives 30 days of VIP.
- Approval updates selected subscription row to `status = active`.
- It separately updates the user's profile with `is_vip = true` and a calculated `vip_expires_at` 30 days in the future.
- Rejection separately updates subscription `status = rejected`.

V2 parity and correctness:
- Make subscription activation and entitlement grant atomic/idempotent.
- Preserve 30-day grant unless product owner changes plan duration.
- Prevent repeat approval/rejection and record actor, timestamp, reason, proof and transaction reference.
- Define extension policy for already-active VIP, duplicate payments, refunds/revocation and renewal.
- Client confirmation is not authorization; expiry must be computed server-side.

## Monthly audit endpoint and reset behaviour

Sources: `app/api/admin/run-audit/route.ts`, `app/api/admin/reset-monthly/route.ts`, `app/admin/actions.ts`, `.github/workflows/monthly-audit.yml`.

Verified:
- Monthly audit endpoint uses CRON_KEY query parameter and calculates the previous month.
- It reads eligible users, computes qualification report cards, then replaces prior unapproved winner drafts for the target month.
- Audit qualification includes activity, league diversity, prediction mix/variety, VIP, points floor and exact-score-count checks.
- A separate UI server action `triggerAuditAction` exists and uses a different audit calculation path. There are at least two monthly qualification implementations.
- Reset-monthly route supports CRON_KEY automation and admin path and updates profile monthly counters; exact fields and reset policy must be retained from full source during implementation.

V2 parity:
- Resolve differences between the two audit implementations with owner approval before consolidating.
- Persist rule version, target month/timezone, candidate set, evidence and report status.
- Make reset idempotent and transactionally scoped to a target month.
- Separate draft generation, review/approval, prize payment and monthly counter rollover.
- Never erase lifetime points, history, campaign points or unreviewed audit evidence.

## Morning automation and campaign lifecycle

Source: `app/api/cron/morning-post/route.ts`.

Verified:
- Route checks CRON_KEY query parameter and uses service-role access.
- It deactivates expired campaigns and clears expired campaign IDs from matches.
- It uses a date-scoped `cron_logs` insert lock (`today-morning`) to suppress duplicate daily runs; on failures it deletes the lock to permit retry.
- It reads social publishing config from `site_settings.social_config` and drives the morning social workflow.
- This API cron route is distinct from GitHub Actions scripts; both API cron and workflow automation exist.

V2 parity:
- Preserve campaign expiry cleanup and assignment semantics.
- A date lock needs lease/owner/started/finished state, timeout and recoverability; deleting the lock on error may repeat completed external side effects.
- Store per-destination publishing outcomes and idempotency keys before retrying Telegram/Buffer/webhook operations.
- Store social secrets separately from public social config and establish canonical timezone.

## Additional legacy debt discovered

- At least two monthly-audit implementations must be compared field-by-field.
- VIP approval is a client-side multi-write transition with fixed 30-day duration.
- Dashboard distinguishes multiple point counters and campaign-specific qualification; flattening them would break semantics.
- Turnstile appears in login, registration and password recovery; it must be server-verified.
- Admin server actions and API routes must each authorize independently.

## Remaining source audit tasks

- Inspect SQL functions/triggers for settlement, reset, point counters, campaign bonus scoring and leaderboard maintenance.
- Compare both monthly audit implementations and full monthly reset route line-by-line.
- Audit full admin match/news editor write and publish workflows.
- Finish payment initiation/proof upload/subscription request path.
- Finish provider-specific live media, embed and global studio room lifecycle.
- Inspect homepage ads consent, analytics, PWA/offline, install prompt, search, SEO/feed/sitemap and editorial journeys.
- Map every discovered contract to V2 schema, APIs, migration, tests and operational owner.

## Cutover policy

No production route, scheduled job, database migration or feature flag is changed by this audit. V2 remains opt-in until full parity, authorization, data reconciliation, idempotency, monitoring, staging E2E and rollback are verified.
