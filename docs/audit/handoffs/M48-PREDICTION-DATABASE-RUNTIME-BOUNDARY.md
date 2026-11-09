# M48 — Dedicated Prediction PostgreSQL runtime boundary

Date: 2026-11-09
Branch: refactor/factsport-v2
Baseline: 37e63287d85185c934a98f1da1abe8c6d1fdb862
Source commits: 184519eea565d5b84e75ff771170970c86475b67; 6f083d51a8738fb8c69953e92b51c528951ed551
Status: adapter and static contract tests committed; isolated verification/native build running at handoff. No Prediction API or database grants activated.

## Why this slice was required

M44 confirmed that migration 0003 is schema-only and that no dedicated Prediction writer identity or Hyperdrive exists. The public PredictionBoard remains legacy Supabase-backed and the legacy settlement routes remain fail-closed. Prediction must not borrow the Media editorial writer, public reader, social dispatcher or shared DATABASE_URL.

## Implemented

- Added `withFactsportPredictionPostgres()` to `lib/adapters/postgres-client.ts`.
- It uses only the dedicated `FACTSPORT_PREDICTION_HYPERDRIVE` binding and labels connection errors as the Prediction API identity.
- It has no fallback to `FACTSPORT_HYPERDRIVE`, `FACTSPORT_EDITORIAL_HYPERDRIVE`, Supabase or `DATABASE_URL`.
- Added `isFactsportPredictionPostgresReady()`. It fails closed unless:
  - the dedicated Hyperdrive binding exists;
  - the authenticated database role is exactly `factsport_v2_prediction_api`;
  - matches, contacts, participants and predictions tables exist;
  - the role has SELECT on matches;
  - the role has SELECT/INSERT/UPDATE on prediction_contacts and prediction_participants;
  - the role has SELECT/INSERT on predictions.
- Added `tests/prediction-runtime-boundary.test.cjs` to guard the no-fallback boundary and fail-closed readiness contract.

## Validation

- Workflow triggers are present because the existing verification workflow includes `lib/**` and `tests/**`.
- Isolated verification run [42576199656](https://github.com/MketyDigital/Factsport/actions/runs/42576199656) was in progress during handoff.
- Native Vinext build run [42576199686](https://github.com/MketyDigital/Factsport/actions/runs/42576199686) was in progress during handoff.
- Protected application staging run [42576199616](https://github.com/MketyDigital/Factsport/actions/runs/42576199616) was in progress during handoff.
- Earlier staging runs on prior commits may be cancelled by newer pushes; do not count cancelled runs as passes.
- No database migration was added or applied. No role, Hyperdrive, Cloudflare secret, cookie, API route, public prediction switch, settlement, or production resource was changed.

## Important limitation

This is a connection boundary and readiness probe only. It does not yet provide the role/grants, anonymous visitor cookie, contact reuse/upsert, submission API, campaign snapshots, rate limits, settlement ledger, account claim, marketing confirmation or PredictionBoard replacement. Readiness must remain false until the dedicated role and grants are provisioned and tested.

## Next implementation sequence

1. Provision the `factsport_v2_prediction_api` database login and `FACTSPORT_PREDICTION_HYPERDRIVE` only in isolated staging; do not reuse another service identity.
2. Design and review least-privilege SQL grants or narrowly scoped SECURITY DEFINER submission functions. Do not grant broad access to unrelated Media, VIP, payment, campaign-admin or user tables.
3. Apply/test the prediction schema and grants in disposable PostgreSQL, including role-negative tests and kickoff/duplicate races.
4. Implement an opaque Secure/HttpOnly visitor cookie and server-side API. Existing participant tokens must be reused; repeat visitors must not be asked to re-enter email on every prediction.
5. Ensure first explicit submission collects normalized email once; no email-only account; marketing opt-in remains optional, unticked, pending confirmation and independently withdrawable.
6. Add campaign tables and immutable rule versions only after the legacy campaign fields and bonus markets are mapped.
7. Implement registered account claim without email auto-linking, with deterministic same-match conflict retention.
8. Build the atomic settlement ledger only after scoring, event normalization, terminal statuses and owner-approved monthly rules are specified.
9. Replace the dev-only legacy PredictionBoard with the V2 API-backed component behind a separate readiness flag.
10. Keep anonymous predictions prize-ineligible by default. Do not implement monthly winner selection/reset until the owner resolves the conflicting legacy SQL/API/TypeScript rules.

## Rollback

Revert commits `184519eea565d5b84e75ff771170970c86475b67` and `6f083d51a8738fb8c69953e92b51c528951ed551` if the adapter boundary causes an issue. This code is unused until a Prediction route imports it; reverting it does not require database rollback.
