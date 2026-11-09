# M49 — Prediction submission preflight and least-privilege design

Date: 2026-11-09
Branch: refactor/factsport-v2
Baseline: 9bebf0367fd35bd07c642c68726e71377a52c4d4
Status: source audit only; no API, migration, role, cookie, database or public feature activated.

## Evidence inspected

- `db/migrations/0001_factsport_core.sql`: `public.matches` has UUID `id`, timestamptz `match_date`, text `status`, default `SCHEDULED`.
- `db/migrations/0003_factsport_public_predictions.sql`: unique normalized email contacts; hashed visitor tokens; participant/contact association; participant/match uniqueness; registered-user/match uniqueness; PENDING/SETTLED/VOID states; outcome and paired-score checks; locked_at; optional marketing consent and claim-conflict audit.
- `lib/match-source-policy.cjs` and `app/lib/matchService.ts`: pre-match states include SCHEDULED/PRE_MATCH and provider TIMED; live and terminal states are distinct. football-data maps FINISHED/AWARDED/POST to FT. Prediction admission must use a strict pre-match allowlist plus authoritative database time, not a terminal-state denylist.
- `docs/audit/AUTH-005-public-anonymous-predictions-single-predict-account.md`: submit-triggered email, no account creation, opaque Secure/HttpOnly visitor cookie, hash at rest, same-origin protection, database kickoff/duplicate enforcement, optional unticked marketing consent and no anonymous prize eligibility.
- `app/api/prediction/settings/route.ts` is private-host settings only, not a public submit endpoint.
- `lib/adapters/postgres-client.ts` has a dedicated Prediction Hyperdrive adapter, but readiness currently expects direct table-level SELECT/INSERT/UPDATE privileges.
- `.github/workflows/v2-db-migration-verify.yml` seeds `factsport_v2_prediction_api` as a NOLOGIN fixture and currently asserts 42 migrations.
- `middleware.ts` bypasses legacy Supabase session refresh on public Media routes; a public anonymous submit route must not depend on Supabase auth.

## Confirmed gaps and target design

1. No public Prediction submit/read API, visitor cookie or rate-limit path exists. The legacy PredictionBoard remains development-only and Supabase-backed.
2. Migration 0003 revokes PUBLIC access, but no Prediction grant migration exists. The adapter's direct table-grant readiness is broader than the target.
3. Prefer a narrowly scoped SECURITY DEFINER submission function owned by a controlled migration/owner role, with fixed safe search_path, fully schema-qualified relations, explicit validation, PUBLIC EXECUTE revoked and EXECUTE granted only to `factsport_v2_prediction_api`. The API role should not receive general access to contact, participant or prediction tables. Return only minimum result fields; never return email or token hash.
4. The function must upsert contact by normalized email, find/create participant by SHA-256 visitor-token hash, lock the match row, enforce strict pre-match status and `match_date > transaction_timestamp()`, and insert the prediction in one transaction. Existing unique constraints remain final duplicate/replay authority.
5. Email is not an identity key. A returning browser reuses its opaque cookie/participant; a different browser sharing the email must not gain the first browser's prediction history.
6. Generate the cookie cryptographically; never accept participant IDs from JSON. Store only a one-way hash. Cookie Domain=.factsport.com is needed only if cross-subdomain continuity is actually required; host-only is safer otherwise. Test SameSite, CSRF, origin and rotation.
7. Rate limits should use bounded privacy-preserving keyed hashes and atomic counters. Never persist raw IPs or trust arbitrary forwarded headers; validate the Cloudflare proxy contract.
8. Validate email syntax/length, outcome, score pair, display name and rules acceptance server-side. Marketing remains separate, optional, unticked, pending confirmation and append-only audited. Declining it cannot block prediction submission.
9. Email appears only after explicit Submit Prediction. Same-browser repeat visits reuse participant/contact and must not ask for email again unless the cookie is missing/invalid.
10. Route is host/environment-gated, same-origin protected, rate-limited, no-store and fails closed if the dedicated Prediction function contract is unavailable.

## Next implementation sequence

1. Add the next free migration with the scoped submission function and EXECUTE-only grant. Extend disposable PostgreSQL CI with positive and negative privilege assertions and update the exact migration count.
2. Replace direct table-grant readiness with function existence/EXECUTE readiness and tests.
3. Add pure token/email/input validation and tests.
4. Implement public API through only `withFactsportPredictionPostgres()`; enforce host/environment, origin/CSRF, payload bounds, cookie issuance and sanitized errors.
5. Add privacy-preserving atomic rate limits and burst/race tests.
6. Add submit-triggered form/API client; do not expose it until staging DB role and browser journeys pass.
7. Keep public read/leaderboard projection separate; never expose emails, token hashes, internal participant IDs or IP data.

## Acceptance tests

- API role can execute only the approved submission function and cannot directly access Prediction tables or unrelated Media tables.
- Concurrent same-participant/same-match requests produce one prediction and deterministic duplicate handling.
- Same email with different visitor tokens does not transfer history.
- Kickoff equality/past and live/terminal/unknown statuses are rejected; only verified pre-match statuses are accepted.
- No email prompt before explicit submit; valid email is collected once and reused through the same cookie.
- Missing/unchecked marketing consent creates no subscription; opt-in creates pending confirmation and append-only evidence; declining consent never blocks a prediction.
- No raw token/hash/email/IP in public responses or logs; no browser DB writes.
- Missing binding/function/grant returns unavailable without shared fallback.
- Legacy score, campaign, bonus, eligibility, VIP and monthly policy remain OPEN until separately reconciled.

## Rollback

Documentation-only audit slice. Future SQL/API changes must be reverted independently; never drop migration-owned data or change production resources as part of rollback.
