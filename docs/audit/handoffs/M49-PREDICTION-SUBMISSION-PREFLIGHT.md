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


## Implementation continuation — scoped SQL function added

- Added `db/migrations/0043_factsport_prediction_submission_function.sql`.
- Function: `public.submit_public_prediction(text,text,text,uuid,text,integer,integer)`.
- Uses SECURITY DEFINER with pinned `search_path`, fully-qualified table references, opaque visitor-token hash validation, per-token transaction advisory lock, match row lock, strict `SCHEDULED/PRE_MATCH` plus database-time kickoff check, one-time contact capture, participant reuse, and participant/match idempotency.
- Anonymous predictions are explicitly inserted with `is_eligible_for_prize=false`. Existing browser identity retries can be recognized after kickoff without creating or changing a prediction.
- PUBLIC EXECUTE is revoked; only `factsport_v2_prediction_api` receives EXECUTE. No direct table grants are added.
- Updated `lib/adapters/postgres-client.ts` readiness to require the dedicated role, schema objects and function EXECUTE privilege rather than broad table writes.
- Expanded `tests/prediction-runtime-boundary.test.cjs` and the disposable PostgreSQL workflow to apply 0001–0043, assert no direct table access, inspect SECURITY DEFINER/search_path/ACL, and exercise first submission plus duplicate retry under SET ROLE.
- Source commits for this implementation slice: `e463f0abfcf7f47e3e7ca3b447ee24e02a1115b0`, `1db1b1e9d9a02e06b73bfccda7011557bd1f28e5`, `3d19370116045c7714a06d1d31835a0ea2cbb5b2`, `b13d477aba32edd7c12762d4be0fab7f75b59a0d`, `aaa683989f42a35ca891081858c32bb3520f3303`, `082d638ed1e3ee82edd626d8bcc8a036b03e74e1`.
- **Not yet runtime-verified:** the migration and role behavior are awaiting disposable PostgreSQL CI. No API route, cookie, rate limiter, marketing-consent call, campaign logic, claim flow, settlement or UI is implemented. No staging/production database was touched.
- Next: resolve any SQL/CI findings; add tests for kickoff equality, closed/unknown statuses, different visitor tokens sharing an email, and concurrency; then implement token cookie/API and privacy-safe rate limiting.


## Public API, visitor continuity and optional consent — implementation added

- Added `app/api/prediction/submit/route.ts` with a click-triggered GET session bootstrap and same-origin POST submission. Both are host-gated, no-store, and use only the dedicated Prediction Hyperdrive adapter.
- The GET route issues an opaque 256-bit Secure/HttpOnly/SameSite=Lax cookie only when the visitor opens the submit form. Production uses `.factsport.com` scope for same-browser transition to `predict.factsport.com`; staging remains host-only. The cookie value is never returned to JavaScript.
- Added `get_public_prediction_visitor_state(text)`, which exposes only a boolean for the current cookie hash. The form can therefore omit the email field for a returning browser. A new browser identity must supply email once; the database ignores an email supplied for an already-known visitor.
- Added `lib/prediction/public-submission.ts` for cryptographic token generation, SHA-256 token hashing, HMAC rate keys and strict public-host checks.
- Added a bounded JSON reader (8 KiB), exact Origin/Sec-Fetch-Site checks, UUID/outcome/score/email/display-name validation, no-store responses and sanitized database error mapping.
- Added database-backed privacy-safe counters: 10 requests/minute per visitor and 60/minute per network key. Network and visitor keys are HMAC-SHA256 hashes; raw IPs and raw visitor tokens are not stored. Counters opportunistically prune expired buckets. Thresholds are technical abuse controls, not game eligibility/daily prediction rules, and need staging load/tuning.
- Added versioned `prediction_rule_acceptances` records in the same transaction as a new prediction. The exact visible acceptance wording is stored.
- Added optional `marketingOptIn` handling in the submission function. It creates/updates only a `pending_confirmation` subscription and appends an `opt_in` event; it is unticked by default, separate from prediction acceptance, and never sends email. The exact visible marketing wording/version is stored. A confirmation/unsubscribe delivery flow remains OPEN.
- Added `app/components/PublicPredictionSubmit.tsx` and gated it on `FACTSPORT_PREDICTION_SUBMISSION_READY` plus a scheduled/pre-match page status. The email/rules/optional marketing form opens only after clicking Submit Prediction. Existing legacy `PredictionBoard` remains untouched and development-only; no old campaign/bonus/scoring behavior was replaced.
- Added/expanded `tests/prediction-submission-api.test.cjs` and `tests/prediction-runtime-boundary.test.cjs`. Disposable PostgreSQL workflow now exercises function execution under the dedicated role, duplicate retry, visitor-state lookup, pending marketing consent, rate-limit threshold and no-direct-table-grant assertions.
- Relevant implementation commits: `130093773f1d27c91c02a6eb6b345e3092dacb08`, `63873b0248bce87ed8b96ecd35a228273e9b6a20`, `d1c24e651eb5dfb7e6bfac1ff88cfc1706a99732`, `35351fcc505fab696b15a41837a10d7c2586a853`, `a393204f11d11a30684da48329ec6b38e402d704`, `81c48640cfd7520b32674af9a456d147ef12439f`, `a050f82cfe820f831a86a4680f2c465211167174`, `1e3019476cb7b377d931af4785b6a682f03b7356`, `74fc53e533496088a102f996af6aa43ec6c459ca`.
- Verification remains in progress after multiple test-harness and SQL-expression corrections. The migration chain has not yet passed with the final visitor-state function/rate-limit/consent assertions; the newest native build/typecheck is also running. Do not treat this feature as runtime-verified until the current-head PostgreSQL, isolated, native build and protected staging runs pass.
- No staging or production DB migration, Hyperdrive/login role, secret, cookie domain, feature flag, DNS or public release was activated.

## Remaining acceptance gaps before any enablement

1. Finish current-head disposable PostgreSQL migration and role tests; include a different visitor token using the same email to prove contact reuse does not transfer prediction history.
2. Finish current-head TypeScript/native Worker build and protected Cloudflare staging. Run real browser tests for cookie set/reuse, same-origin rejection, payload limits, rate limits, duplicate retry and kickoff race.
3. Provision the dedicated Prediction login/Hyperdrive and HMAC secret only in isolated staging; apply migration 0043 there after owner approval. Keep `FACTSPORT_PREDICTION_SUBMISSION_READY` unset until complete.
4. Implement marketing confirmation, verified-email delivery, unsubscribe/withdrawal and append-only confirmation/withdrawal evidence before any promotional sends.
5. Implement safe public own-prediction/leaderboard read projections; the new API currently submits but does not read a visitor's prior prediction or public standings.
6. Map legacy campaign/rule versions, bonus markets and daily eligibility before public rollout; do not substitute generic submission behavior for legacy features.
7. Reconcile legacy settlement 3/10-point rules, campaign bonus, VIP and monthly-winner conflicts before any settlement/prize feature is enabled.
8. Add explicit race tests for same visitor/match, same email/different visitor, kickoff equality, live/terminal/unknown status, and rate-limit concurrent calls.


## Additional parity/security refinements

- Rechecked the actual legacy `PredictionBoard`: the no-campaign path defaults `require_score` to true. The new public API and SQL function now require both exact-score values; campaign-specific optional-score behavior remains disabled until campaign rules are mapped.
- Aligned the exact displayed rules/privacy acceptance sentence and marketing opt-in sentence with the versioned text stored in the database.
- Added SQL workflow coverage for a second browser using the same normalized email (one contact, two distinct participants; no prediction-history transfer), live and unknown match statuses, kickoff equality using one database transaction clock, and concurrent same-token submissions on separate PostgreSQL connections.
- Disposable PostgreSQL migration verification passed on commit `b0c2b1c95b127696e92f5351ed2970e1310ea500` (migration chain through 0043 with exact-score requirement and the preceding role/consent/rate-limit checks). A newer run adds the concurrent race test and is still pending.
- Isolated regression passed on `9e0450902d4d9ff4aca6d415827f5f4feb5ec679`; native Vinext build and protected Cloudflare staging passed on `74fc53e533496088a102f996af6aa43ec6c459ca`. Later source refinement requiring exact scores has fresh isolated/native/staging checks in progress.
- The marketing flow intentionally stops at `pending_confirmation`: no marketing email is sent. Confirmation, unsubscribe/withdrawal endpoints, token expiry/replay handling and reliable delivery/outbox are required before any promotional send.


## Latest verification and host-isolation follow-up

- Production API host validation is pinned to exactly `https://factsport.com`; it cannot be enabled on `predict.factsport.com`. Staging accepts only the protected `factsport-v2-staging.*.workers.dev` host pattern. The parent-domain visitor cookie is still scoped to `.factsport.com` only in production.
- Disposable PostgreSQL migration verification passed on `95d8ddfa7f90765641caaa033871e77133f65c06` (run `42582368633`), including two simultaneous submissions on separate PostgreSQL connections using the same visitor token/match; one participant and one prediction remain.
- The same run includes prior assertions for no direct table grants, function ACL/search_path, exact kickoff/status rejection, normalized contact reuse without cross-browser history transfer, duplicate retry, pending marketing consent and rate limiting.
- Isolated regression passed on `4aa20c507bbdbf743b2f1e7c72f04e5cd5733e11` (run `42582325642`); native Vinext build passed on the same commit (run `42582325545`). Protected Cloudflare staging for that commit was still in progress at the time of this note.
- A subsequent CI-only workflow change adds an information_schema assertion that the Prediction API role has zero direct public-schema table grants; its database verification run is pending.
- No isolated Azure database migration, dedicated login/Hyperdrive provisioning, HMAC secret, feature flag activation or production resource change has occurred.
