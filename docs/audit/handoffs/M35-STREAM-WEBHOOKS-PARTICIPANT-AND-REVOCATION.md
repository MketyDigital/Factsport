# M35 — Stream webhook verification, participant lifecycle and guest revocation

Date: 2026-11-08
Branch: `refactor/factsport-v2`
Status: source implementation committed; Stream webhook endpoint/configuration and database migrations not yet applied or exercised against a real provider.

## Implemented

- Added `POST /api/webhooks/stream` with raw-body HMAC-SHA256 verification against `X-Signature`, exact `X-Api-Key` validation, gzip detection/decompression before signature verification, and constant-time signature comparison.
- Uses `X-Webhook-Id` as the delivery idempotency key. Unprocessed webhook rows remain retryable; successful processing sets `processed_at`. Duplicate completed deliveries return 2xx without replaying side effects.
- Does not persist raw webhook payloads. The ledger stores webhook ID, event type, call CID, stream user ID and timestamps only.
- Added migration `0030_factsport_broadcast_token_identity_and_webhooks.sql` for room-scoped token identity mappings and webhook receipt ledger, plus required token-issuer grants and audit actions.
- Token issuance now stores each room-scoped Stream identity with identity kind, internal user mapping where applicable, room role, guest invite reference and token expiry. No raw user token or invite token is stored.
- Webhook processing updates `media_broadcast_participants` and audit events for participant join/leave, permission requests, mic permission changes, mute, member removal, session end, live start/end and recording start/stop.
- If a participant joins with a missing, expired or revoked token identity, the webhook blocks that Stream user from the `audio_room`. Provider failures leave the webhook receipt unprocessed so Stream retry can retry the block.
- Revoking a guest invite marks every associated token identity revoked and attempts an immediate Stream `BlockUser` call for each issued guest identity. If immediate provider blocking fails, the UI receives a warning and the webhook blocks any later rejoin.
- Added a live-participant section to `/admin/studio`, showing webhook-backed presence, room, identity class, role, microphone state and timestamps without exposing email addresses. Media admins can block a participant; this revokes the token identity, revokes a guest invite when applicable, calls Stream `BlockUser`, and updates participant presence only after provider blocking succeeds.
- The webhook and token issuer use the separate broadcast token-issuer Hyperdrive/database identity. The broadcast admin can read participant presence and update only `left_at`, `last_seen_at` and `mic_enabled`; it cannot issue tokens.

## External configuration required

- Apply migrations `0028`, `0029` and `0030` in isolated staging after reviewing grants and migration ledger.
- Configure the Stream webhook URL as `https://factsport.com/api/webhooks/stream` only on the intended staging host first; subscribe to the relevant Video events and retain all existing Stream event hooks when updating `event_hooks` because Stream replaces the complete array.
- Stream webhook requests must reach this endpoint over HTTPS with the standard `X-Webhook-Id`, `X-Api-Key` and `X-Signature` headers. Keep gzip compression behavior enabled in tests; the handler supports compressed and uncompressed bodies.
- No Stream webhook URL, event hook configuration, API key/secret, Cloudflare secret, database binding or production setting was changed.

## Remaining acceptance

1. Test real Stream HMAC signatures for compressed and uncompressed payloads, duplicate webhook IDs, invalid signatures, retries, and database outage behavior.
2. Test participant join/leave, call-in request, mic grant/revoke, mute, kick/block, call end, live and recording events against real Stream payloads.
3. Verify revoked/expired guest users are blocked immediately and remain blocked after reconnect; test Stream 404/already-blocked responses and webhook retries.
4. Confirm the configured Stream `audio_room` call type has only intended capabilities for admin, moderator, user and anonymous roles; moderator custom role must be explicitly configured.
5. Decide whether to move webhook event processing to a durable queue if real event volume or Stream's delivery timeout requires faster acknowledgement.
6. Run full staging E2E before enabling the token issuer readiness flag or activating any room.

## Validation

Isolated regression verification passed on commit `a2ada291fdddbe208c7ddfb53b26ffd644bc8694` (run `42494347600`). Native Worker build passed on commit `22c0da6fae921a4f53c3ab7beb333fea5303f132` (run `42494317705`). The latest participant-admin changes are running through CI; no actual Stream webhook, token issuance, participant update, invite revocation or production room activation has been executed.

## Admin participant controls

- `/admin/studio` now shows active webhook-backed participants without email disclosure and exposes a server-authorized Block participant action. It revokes the token identity (and the guest invite if applicable), blocks the Stream user, and only marks the participant left after provider blocking succeeds. The broadcast admin receives read access plus column-scoped updates to participant state/role metadata.
- Host/moderator role revocation demotes the existing Stream member to `user`; if that cannot be confirmed, the fallback blocks the member and revokes the token identity. Explicit role regrant attempts to unblock and restore the assigned Stream role.
