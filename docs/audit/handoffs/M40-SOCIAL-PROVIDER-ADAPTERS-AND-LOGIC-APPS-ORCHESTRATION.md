# M40 — Social provider adapters and Logic Apps orchestration

Date: 2026-11-09
Branch: refactor/factsport-v2
Status: source implementation committed; CI verification running; all activation flags remain unset.

## Implemented

- Added POST /api/internal/social/deliver. It reloads the claimed post from PostgreSQL, verifies outbox/attempt/lease ownership and expiry, revalidates the public media projection, and takes a provider_started_at lock so only one provider request can start for a delivery attempt.
- Direct Meta adapter:
  - Uses a server-only Page access token in the Authorization header, never in a URL or client bundle.
  - Uses the configured Graph API version (default v26.0).
  - Supports text/link posts and one-image photo posts. The scheduling action rejects more than one image for Meta until multi-photo delivery has a separately tested adapter.
  - Normalizes provider post ID/URL and distinguishes rate-limit retry from server/network ambiguity.
- Direct Telegram adapter:
  - Uses the bot token only server-side.
  - Supports sendMessage, sendPhoto and sendMediaGroup for up to four images.
  - Supports up to five configured destinations; if a later destination fails after an earlier send succeeded, returns unknown_result to prevent duplicate replays.
  - Enforces Telegram text/caption length and 5 MB URL-based image limits before sending.
- Buffer and Make use a shared secure HTTPS Logic Apps/APIM adapter. The URL must have no query-string credentials; a bearer secret is sent in the Authorization header. The request includes channel routing metadata, post content, public media URLs and the stable idempotency key. The adapter must return a provider post ID.
- Added a disabled-by-default Azure Logic Apps recurrence workflow template. It runs sequentially and calls claim -> deliver -> result. HTTP inputs/outputs are marked secure. It is the single intended scheduler; no Cloudflare Cron duplicate was added.
- Added migration 0036 for the provider_started_at lock and column-scoped dispatcher UPDATE grant.
- Added migration 0037 to constrain social channel providers to meta, telegram, buffer and make.
- Provider readiness now requires actual server-side credentials/adapter URL and a high-entropy bearer secret, not just an operator toggle. Media capability additionally requires provider-specific image E2E readiness.

## Safety and failure semantics

- Provider calls are not retried automatically when the response is ambiguous. Network timeout, server error, partial Telegram delivery or missing provider post ID returns unknown_result; the receipt endpoint dead-letters it for manual reconciliation.
- Rate-limited responses return retryable_failure with bounded exponential backoff. Permanent provider validation/permission errors are dead-lettered.
- The provider_started_at field prevents a second call for the same attempt. A process crash after provider handoff results in lease expiry and unknown_result.
- Meta tokens and Telegram bot tokens are Cloudflare secrets. Buffer/Make credentials are held by the secured Logic Apps/APIM connection. Channel settings contain only Page IDs, profile IDs, chat IDs and Make route keys.
- No provider credentials are committed. No channel is enabled by source changes.

## Validation

- The claim/result core and source provenance/social channel admin passed earlier isolated verification on commit 0cff3c6b4e28a27f52a8ef98d5a3fdcd7d85c53c (run 42560209590); that run predates the provider delivery adapter and Logic Apps template.
- Fresh native build, isolated regression and staging workflow are required for the new provider adapter code. Do not treat this handoff as a provider E2E pass.
- Migrations 0036/0037 are inventoried but unapplied. Dispatcher Hyperdrive, role, bearer token, Meta/Telegram credentials, APIM endpoint and Logic Apps workflow are not provisioned.

## Remaining acceptance

1. Complete CI and fix all TypeScript/test failures.
2. Provision the dedicated social dispatcher database login and Hyperdrive; verify effective grants and RLS/role boundaries.
3. Configure secure Cloudflare secrets and provider readiness flags only in staging.
4. Configure the Logic Apps/APIM Buffer/Make adapter using managed identity or an authenticated APIM boundary; do not use a signed query-string Logic Apps URL.
5. Run private test-destination E2E for Meta text/image, Telegram text/photo/media-group/multi-destination, Buffer and Make. Verify returned post IDs and provider links.
6. Exercise concurrent claims, duplicate deliver requests, duplicate callbacks, 429 backoff, 5xx/timeout unknown-result, partial Telegram send, stale media, expired leases and manual reconciliation.
7. Only after all checks, enable the Logic Apps workflow and individual channel/provider readiness flags.

## Safety

No production resources, secrets, DNS, database migrations, social accounts, public posts or live Logic Apps workflows were changed.
