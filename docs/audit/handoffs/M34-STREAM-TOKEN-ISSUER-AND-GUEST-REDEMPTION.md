# M34 — Stream token issuer, room-scoped guest redemption and listener policy

Date: 2026-11-08
Branch: `refactor/factsport-v2`
Status: source implementation committed; CI validation running; Stream secrets, token-issuer Hyperdrive and live provider verification not provisioned.

## Implemented

- Added a separate `FACTSPORT_BROADCAST_TOKEN_HYPERDRIVE` connection and a server-only Stream runtime configuration. It requires the explicit `FACTSPORT_BROADCAST_TOKEN_ISSUER_READY=true` flag, Stream API key/secret, and a 32-byte base64url anonymous-session secret.
- Added `POST /api/studio/token`. It accepts only a room key and optional guest invite token, checks same-origin JSON requests, resolves the global or match-specific room from PostgreSQL, and derives identity and role server-side.
- Preserved the legacy `audio_room` call type and four-hour client user token. The server API token is short-lived (five minutes). Stream API credentials never reach the browser; only the public API key and user token do.
- The issuer upserts the Stream user, creates the call only for a Factsport-assigned host, and applies the room-specific host/moderator call-member role. Moderator tokens fail closed until the Stream moderator role has been configured and `FACTSPORT_STREAM_MODERATOR_ROLE_READY=true`.
- Anonymous listeners receive a stable four-hour room-scoped anonymous cookie identity. They do not need Prediction VIP, payment or a private Prediction account.
- Guest invite redemption checks token hash, room scope, expiry, revocation and use limit under a row lock; use count increments atomically. If Stream provider setup fails, the use count is compensated. A successful admission is audited.
- Default guest invites preserve the legacy 24-hour reusable behavior. Raw invite tokens are generated once and stored only as SHA-256 hashes. Guest links use URL fragments (not query strings); the browser removes the fragment before sending the token in a same-origin POST body.
- Added hashed rate-limit buckets: 30 requests/minute per source IP, 6/minute per invite and 12/minute per authenticated account. Raw IPs and invite tokens are not stored. Migration `0029_factsport_broadcast_token_rate_limits.sql` grants the token-issuer role only the rate-limit table access it needs.
- Updated `GlobalMediaProvider` to call the V2 token route and use the database room name. Updated the Media room UI so call-in requests are shown only when the server grants caller eligibility; anonymous listeners no longer get redirected into the private Prediction login. Host and moderator controls are separated, with recording and go-live reserved to host.
- Studio activation and call-ins remain disabled until the token issuer binding and secrets are actually configured. The Studio admin control plane's readiness gate now uses this runtime configuration.

## External configuration required

- Provision `factsport_v2_broadcast_token_issuer` and `FACTSPORT_BROADCAST_TOKEN_HYPERDRIVE`; apply migrations 0019, 0028 and 0029 in isolated staging.
- Set server-only `STREAM_API_KEY`, `STREAM_API_SECRET`, `FACTSPORT_BROADCAST_ANON_SECRET`, and `FACTSPORT_BROADCAST_TOKEN_ISSUER_READY=true` as Cloudflare bindings/secrets. The anonymous secret must decode to exactly 32 bytes.
- Configure the Stream `audio_room` call type and moderator role/permissions; only then set `FACTSPORT_STREAM_MODERATOR_ROLE_READY=true`.
- No actual Stream API key/secret, tenant secret, Cloudflare binding ID or DNS value was invented or changed.

## Remaining acceptance

1. Run a real staging Stream sign-in and token issuance for anonymous listener, Entra listener, host, moderator, caller and guest.
2. Test wrong-room, expired, revoked, exhausted, replayed and concurrently redeemed guest invites; verify compensation after provider failure.
3. Add Stream webhooks with signature verification to maintain `media_broadcast_participants`, attendance, call-in requests, mic grants/revocations, participant removal and room lifecycle audit.
4. Test reconnect, host loss, moderator removal, mic permissions, recording/go-live permissions and rate-limit behavior.
5. Verify no Prediction VIP/payment entitlement is used for public listening or guest access.
6. Only after staging E2E, enable the token-issuer readiness flag and then activate rooms/call-ins. No production activation is authorized by this code change.

## Validation

CI is running on the current branch after the token issuer and Studio UI changes. No real Stream request, database migration, provider webhook or production room activation has been performed.