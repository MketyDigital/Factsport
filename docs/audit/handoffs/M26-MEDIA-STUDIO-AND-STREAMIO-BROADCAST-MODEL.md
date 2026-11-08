# M26 — Media studio and StreamIO broadcast identity model

Date: 2026-11-07
Branch: refactor/factsport-v2
Status: additive schema implemented; no token issuer, admin controls or StreamIO provider binding activated.

## Legacy behavior preserved

M18 verified the global Goal Rush studio and match-specific broadcast rooms:
- Global room identity is global-goal-rush.
- Global settings include title, audio URL, video URL and active switch; video URL takes precedence in the public global-media selection, while the StreamIO sentinel selects the StreamIO audio studio.
- Match rooms and global studio rooms are distinct scopes.
- Public anonymous listeners, authenticated callers, invited guests, host and moderator actions are separate capabilities.
- Guest invitations were room-bound JWTs with a 24-hour expiry, reusable during their lifetime, but no durable revocation/use ledger was found.
- Stream token lifetime was four hours.
- Legacy “VIP Guest” is a broadcast display label only. It is not a paid Prediction VIP entitlement.
- Host/moderator controls include hand-raise/call-in, participant audio permission grant/revoke, guest invitations and room shutdown.

## V2 schema added in migration 0019

- media_broadcast_rooms stores global and match-scoped room identity. The global-goal-rush room is seeded inactive.
- media_studio_settings stores global title/audio/video/active settings; the studio is inactive by default.
- media_broadcast_room_roles stores explicit host/moderator/caller grants, independent of Prediction.
- media_broadcast_invites stores only SHA-256 token hashes, room scope, expiry, optional use limit, use count and revocation state. NULL max_uses retains legacy reusable-invite behavior while adding revocation and audit.
- media_broadcast_participants records anonymous/authenticated/guest identities and listener/caller/guest/host/moderator role, mic state and join/leave state.
- media_broadcast_audit_events records room lifecycle, invite, participant, call-in and mic permission events.
- public_media_studio_settings exposes only the public studio settings view.
- The schema does not store Stream secret, API key, raw invite token or Prediction VIP/payment status.

## Separate database identities

- factsport_v2_media_broadcast_admin can manage studio settings, rooms, explicit room roles, invites and append audit events.
- factsport_v2_broadcast_token_issuer can read room policy/roles/invites, consume invite use counts, maintain participant state and append audit events. It cannot grant roles or modify studio configuration.
- Neither role receives Prediction, settlement, campaign or prize table access.
- Both roles are migration prerequisites and must be independently provisioned with separate Hyperdrive connections, NOINHERIT, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS and bounded connection limits.

## Remaining implementation gates

1. Build server-only StreamIO token issuance using the token-issuer role and Stream secret Cloudflare binding.
2. Replace legacy email allowlist/user_metadata admin classification with explicit Media broadcast roles.
3. Implement secure anonymous listener identity with short-lived signed session and issuance rate limits.
4. Implement guest invite creation/revocation and one-time/reusable policy UI; preserve legacy 24-hour reusable semantics unless owner explicitly changes them.
5. Enforce invite room scope, expiry, revocation and use count transactionally; never accept a client-supplied role.
6. Implement host/moderator participant admission, call-in requests, mic grant/revoke, room shutdown and append-only audit.
7. Decide Stream token TTL (legacy four hours) and add token expiry/room scope tests.
8. Keep global studio inactive and call-in disabled until private staging room tests pass.
9. Ensure public listener access does not require Prediction login/VIP/payment.
10. Test anonymous listener, authenticated fan, host, moderator, invited guest, expired/revoked/wrong-room invite, reconnect, mic grant/revoke and shutdown.

## Validation boundary

Migration 0019 is source-checked only. It has not been applied; the two broadcast roles and Hyperdrive bindings do not exist; StreamIO secrets have not been created; no tokens, invites or broadcasts were issued. Production studio and rooms remain untouched.


## M33 broadcast admin implementation update

The dedicated Media broadcast admin UI and server mutations are now implemented in source under the Entra-backed `broadcast` capability and separate `FACTSPORT_BROADCAST_ADMIN_HYPERDRIVE`. It supports studio settings, inactive match-room creation, room shutdown/settings, hashed invite creation/revocation and room host/moderator/caller role grants. Migration `0028_factsport_broadcast_admin_audit_and_role_history.sql` fixes role re-grant history and adds audit actions. Activation and call-ins are deliberately rejected until the separate Stream token issuer exists; invite redemption and participant controls are not yet active. See `M33-BROADCAST-ADMIN-CONTROL-PLANE.md`.


## M34 token issuer update

The legacy `/api/stream/token` caller has been migrated to `POST /api/studio/token`. The V2 route preserves `audio_room`, four-hour tokens and 24-hour reusable guest invites while adding room scoping, server-derived roles, invite hashing/revocation/use limits, same-origin POST, rate limits and Entra-linked host/member identity. Anonymous public listening is separate from Prediction VIP. See M34 for required Cloudflare/Stream configuration and uncompleted webhook/participant acceptance.
