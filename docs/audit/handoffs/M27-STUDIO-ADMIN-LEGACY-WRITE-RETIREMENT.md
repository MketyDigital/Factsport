# M27 — Studio admin legacy-write retirement

Date: 2026-11-07
Branch: refactor/factsport-v2

## Change

The legacy `/admin/studio` page queried the Supabase `global_studio` table directly, authenticated using a hardcoded email allowlist and wrote through `getSupabaseAdmin()`. Its server action updated global studio title/audio/video/active settings. This path did not implement the new room-level authorization, revocable invite ledger, or broadcast audit model.

The original studio page, client and action were archived verbatim under `docs/audit/legacy-source/` for migration evidence.

The active V2 studio admin surface is now fail-closed:
- The page explains that the Media broadcast database roles and Stream token issuer are not provisioned.
- The action exports return a stable `V2_BROADCAST_ADMIN_NOT_PROVISIONED` error and perform no writes.
- The former Supabase-backed client controls have been removed.
- No global_studio read/write, email allowlist, profile metadata role, Stream secret, token or invite issuance remains in the active studio feature files.
- The global and match room model, listener/caller/host/moderator separation, guest invite ledger and audit events are defined in migration 0019 (M26).

## Important separation

Public listening is a Media capability and must not be gated by Prediction VIP or payment status. “VIP Guest” is a broadcast invite label only. Prediction entitlements do not grant host/moderator privileges.

## Next implementation gates

1. Provision the dedicated Media broadcast admin and token issuer roles with separate bounded Hyperdrive connections.
2. Add a server-only adapter using only the token issuer's minimal privileges.
3. Add a distinct Media admin authorization capability, not the legacy global email allowlist.
4. Implement transactional room-scoped invite hash lookup, expiry, revocation and optional use count.
5. Issue short-lived StreamIO tokens with server-selected room, identity and role; never accept role/room privilege from client input.
6. Implement participant state, call-in, mic grant/revoke, shutdown and append-only audit.
7. Add integration tests against the actual database grants and Stream token provider in a private staging room.
8. Only then replace the read-only readiness page with the complete broadcast control workspace.

## Validation

Static source regression was added. GitHub Actions validation is running for the latest branch commit; no database migration, provider token, room, production setting or live broadcast was changed.


## M33 broadcast admin implementation update

The dedicated Media broadcast admin UI and server mutations are now implemented in source under the Entra-backed `broadcast` capability and separate `FACTSPORT_BROADCAST_ADMIN_HYPERDRIVE`. It supports studio settings, inactive match-room creation, room shutdown/settings, hashed invite creation/revocation and room host/moderator/caller role grants. Migration `0028_factsport_broadcast_admin_audit_and_role_history.sql` fixes role re-grant history and adds audit actions. Activation and call-ins are deliberately rejected until the separate Stream token issuer exists; invite redemption and participant controls are not yet active. See `M33-BROADCAST-ADMIN-CONTROL-PLANE.md`.
