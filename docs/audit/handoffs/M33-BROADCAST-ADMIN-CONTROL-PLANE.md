# M33 — Media broadcast administration control plane

Date: 2026-11-08
Branch: `refactor/factsport-v2`
Status: source implementation committed; CI checks in progress; database roles/migrations and Stream token issuer are not provisioned.

## Implemented

- Added `broadcast` capability to Media authorization; only the Factsport `media_admin` membership can enter broadcast administration.
- Added a separate `FACTSPORT_BROADCAST_ADMIN_HYPERDRIVE` adapter. Broadcast actions do not reuse the editorial writer, public reader or Prediction connections.
- Replaced the placeholder studio page with a server-loaded admin workspace for Global Goal Rush settings, global/match-specific room list, room listener flags, invitation ledger and room role grants.
- Implemented transactional global studio settings updates, inactive match-room creation from canonical match UUID, room shutdown/settings changes, invite creation/revocation and host/moderator/caller role grants/revocations.
- Invite secrets are generated randomly and stored only as SHA-256 hashes. The raw token is returned once to the administrator; no plaintext token is stored in PostgreSQL.
- Added migration 0028 to preserve revoked broadcast-role history while allowing a new active grant, and to expand the broadcast audit action set for settings and role operations.
- Admin controls do not expose Prediction VIP/payment fields or legacy Supabase studio writers.

## Safety gates

- Global studio activation and call-in controls remain disabled in the UI and rejected by server actions until the Stream token issuer is implemented and tested.
- Newly created match rooms are always inactive with call-ins disabled.
- Guest invitation records can be created/revoked, but guest redemption is explicitly unavailable until the separate token issuer validates room scope, expiry, revocation and use count transactionally.
- Public listening must remain independent of Prediction VIP and payment entitlements.
- The emergency shutdown control remains available for a room that is already active.
- No Stream API key/secret, provider token, room participant or production broadcast has been changed or issued.

## Remaining work

1. Provision `factsport_v2_media_broadcast_admin` and its dedicated Hyperdrive; apply migrations 0019 and 0028 in isolated staging.
2. Implement the distinct `factsport_v2_broadcast_token_issuer` adapter and StreamIO server token issuer using the approved provider SDK and Cloudflare secrets.
3. Implement anonymous listener identity, guest token redemption, invitation consumption/revocation checks and rate limits.
4. Implement participant presence, call-in request, host/moderator admission, mic grant/revoke and room shutdown with append-only audit.
5. Add private-room E2E for anonymous listener, authenticated caller, host, moderator, guest, expired/revoked/wrong-room invite and reconnect.
6. Only then allow studio activation and call-ins.

## Validation

- Engine regression suite, TypeScript check and native Cloudflare Worker build passed on source commit `348a46a6740be0694b5764bc16cf2dca38090ada` (native build run `42492012094`).
- Latest changes after that commit (including emergency shutdown UI and audit refinements) are under CI; no passing result is claimed for those until their run completes.
- No broadcast database migrations were applied, no Hyperdrive or Stream credentials were provisioned, and no guest token was redeemed.


## M34 follow-up

The replacement Stream token issuer and room-scoped guest redemption are now implemented in source. It uses the separate token-issuer Hyperdrive, server-only Stream secrets, four-hour client tokens, anonymous listener sessions, 24-hour reusable hashed guest invites, room-scoped host/moderator/caller grants, and privacy-preserving rate limits. See `M34-STREAM-TOKEN-ISSUER-AND-GUEST-REDEMPTION.md`. Real provider configuration and E2E remain mandatory; studio activation stays fail-closed until those bindings/secrets are present.


## Role lifecycle hardening

- Revoking a host or moderator demotes the existing Stream call member to `user`; if demotion cannot be confirmed, the system attempts a fail-closed room block and marks the token identity revoked. Regranting a role unblocks the Stream user (when previously blocked) and applies the new room role. Caller revocation removes the Factsport caller grant and changes the token identity to listener. The admin UI surfaces provider warnings rather than claiming the Stream operation succeeded.
