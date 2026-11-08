-- Broadcast admin audit coverage and revocable role history.
-- Existing role grants remain intact; the active-role uniqueness rule replaces
-- the original all-history UNIQUE constraint so revoked roles can be re-granted.
BEGIN;

ALTER TABLE public.media_broadcast_room_roles
  DROP CONSTRAINT IF EXISTS media_broadcast_room_roles_room_id_user_id_role_key_key;

CREATE UNIQUE INDEX IF NOT EXISTS media_broadcast_room_roles_active_unique
  ON public.media_broadcast_room_roles (room_id, user_id, role_key)
  WHERE revoked_at IS NULL;

ALTER TABLE public.media_broadcast_audit_events
  DROP CONSTRAINT IF EXISTS media_broadcast_audit_events_action_check,
  ADD CONSTRAINT media_broadcast_audit_events_action_check
    CHECK (action IN (
      'room_created', 'room_activated', 'room_shutdown', 'settings_updated',
      'role_granted', 'role_revoked', 'invite_created', 'invite_revoked',
      'guest_admitted', 'participant_joined', 'participant_left',
      'callin_requested', 'mic_granted', 'mic_revoked', 'participant_removed'
    ));

COMMIT;
