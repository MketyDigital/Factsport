'use server';

import { revalidatePath } from 'next/cache';
import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';
import { isFactsportBroadcastTokenIssuerReady, withFactsportBroadcastAdminPostgres } from '@/lib/adapters/postgres-client';

type Result = { success: true; data?: Record<string, unknown> } | { success: false; error: string; code?: string };
const unavailable = (): Result => ({
  success: false,
  error: 'The dedicated Factsport broadcast administrator database binding is not provisioned.',
  code: 'V2_BROADCAST_ADMIN_NOT_PROVISIONED',
});

function safeMediaUrl(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new Error('Broadcast media URL must be text.');
  const trimmed = value.trim();
  if (trimmed === 'streamio') return trimmed;
  const url = new URL(trimmed);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Broadcast media URLs must be HTTP(S) and cannot contain credentials.');
  }
  return url.toString();
}

function uuid(value: unknown) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function updateStudioSettings(input: {
  title: string; audioUrl?: string; videoUrl?: string;
  isActive: boolean; publicListeningEnabled: boolean; callinEnabled: boolean;
}): Promise<Result> {
  const authorization = await authorizeMediaEditorialAction('broadcast');
  if (!authorization.ok) return { success: false, error: authorization.error, code: 'MEDIA_BROADCAST_FORBIDDEN' };
  try {
    const title = typeof input?.title === 'string' ? input.title.trim().slice(0, 160) : '';
    if (!title) return { success: false, error: 'Studio title is required.' };
    const audioUrl = safeMediaUrl(input.audioUrl);
    const videoUrl = safeMediaUrl(input.videoUrl);
    const isActive = input.isActive === true;
    const callinEnabled = input.callinEnabled === true;
    if ((isActive || callinEnabled) && !isFactsportBroadcastTokenIssuerReady()) return { success: false, error: 'The Stream token issuer is not provisioned. Public studio activation and call-ins remain disabled.' };
    const publicListeningEnabled = input.publicListeningEnabled === true;
    await withFactsportBroadcastAdminPostgres(async sql => sql.begin(async tx => {
      const rooms = await tx`
        SELECT id, is_active FROM public.media_broadcast_rooms
        WHERE scope_key='global-goal-rush' AND scope_type='global'
        FOR UPDATE
      `;
      if (!rooms.length) throw new Error('Global Goal Rush room is not provisioned.');
      await tx`
        UPDATE public.media_broadcast_rooms SET
          is_active=${isActive}, public_listening_enabled=${publicListeningEnabled},
          callin_enabled=${callinEnabled}, updated_by=${authorization.user.domainUserId}::uuid,
          updated_at=now()
        WHERE id=${rooms[0].id}::uuid
      `;
      await tx`
        UPDATE public.media_studio_settings SET
          title=${title}, audio_url=${audioUrl}, video_url=${videoUrl},
          is_active=${isActive}, updated_by=${authorization.user.domainUserId}::uuid,
          updated_at=now()
        WHERE singleton=true AND room_id=${rooms[0].id}::uuid
      `;
      await tx`
        INSERT INTO public.media_broadcast_audit_events (room_id, actor_user_id, actor_kind, action, details)
        VALUES (${rooms[0].id}::uuid, ${authorization.user.domainUserId}::uuid, 'admin', ${rooms[0].is_active ? 'room_shutdown' : 'settings_updated'},
          ${JSON.stringify({ title, hasAudioUrl: Boolean(audioUrl), hasVideoUrl: Boolean(videoUrl), isActive, publicListeningEnabled, callinEnabled })}::jsonb)
      `;
    }));
    revalidatePath('/admin/studio');
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Broadcast settings update failed', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unable to update broadcast settings.' };
  }
}

export async function updateBroadcastRoom(input: {
  roomId: string; isActive: boolean; publicListeningEnabled: boolean; callinEnabled: boolean;
}): Promise<Result> {
  const authorization = await authorizeMediaEditorialAction('broadcast');
  if (!authorization.ok) return { success: false, error: authorization.error, code: 'MEDIA_BROADCAST_FORBIDDEN' };
  if (!uuid(input?.roomId)) return { success: false, error: 'Invalid broadcast room.' };
  try {
    await withFactsportBroadcastAdminPostgres(async sql => sql.begin(async tx => {
      const rooms = await tx`SELECT id, scope_type, scope_key, is_active FROM public.media_broadcast_rooms WHERE id=${input.roomId}::uuid FOR UPDATE`;
      if (!rooms.length) throw new Error('Broadcast room not found.');
      const active = input.isActive === true;
      const callinEnabled = input.callinEnabled === true;
      if ((active || callinEnabled) && !isFactsportBroadcastTokenIssuerReady()) throw new Error('The Stream token issuer is not provisioned. Room activation and call-ins remain disabled.');
      await tx`
        UPDATE public.media_broadcast_rooms SET
          is_active=${active}, public_listening_enabled=${input.publicListeningEnabled === true},
          callin_enabled=${callinEnabled},
          updated_by=${authorization.user.domainUserId}::uuid, updated_at=now()
        WHERE id=${input.roomId}::uuid
      `;
      if (rooms[0].scope_type === 'global') {
        await tx`UPDATE public.media_studio_settings SET is_active=${active}, updated_by=${authorization.user.domainUserId}::uuid, updated_at=now() WHERE room_id=${input.roomId}::uuid`;
      }
      await tx`
        INSERT INTO public.media_broadcast_audit_events (room_id, actor_user_id, actor_kind, action, details)
        VALUES (${input.roomId}::uuid, ${authorization.user.domainUserId}::uuid, 'admin',
          ${active ? 'room_activated' : (rooms[0].is_active ? 'room_shutdown' : 'settings_updated')},
          ${JSON.stringify({ publicListeningEnabled: input.publicListeningEnabled === true, callinEnabled })}::jsonb)
      `;
    }));
    revalidatePath('/admin/studio'); revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Broadcast room update failed', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unable to update broadcast room.' };
  }
}


export async function createMatchBroadcastRoom(matchId: string): Promise<Result> {
  const authorization = await authorizeMediaEditorialAction('broadcast');
  if (!authorization.ok) return { success: false, error: authorization.error, code: 'MEDIA_BROADCAST_FORBIDDEN' };
  if (!uuid(matchId)) return { success: false, error: 'Enter a valid canonical Factsport match UUID.' };
  try {
    const room = await withFactsportBroadcastAdminPostgres(async sql => sql.begin(async tx => {
      const scopeKey = 'match:' + matchId;
      const roomName = 'match-' + matchId.replace(/-/g, '');
      const rows = await tx`
        INSERT INTO public.media_broadcast_rooms
          (scope_key, room_name, scope_type, match_id, is_active, public_listening_enabled, callin_enabled, created_by, updated_by)
        VALUES (
          ${scopeKey}, ${roomName}, 'match', ${matchId}::uuid, false, true, false,
          ${authorization.user.domainUserId}::uuid, ${authorization.user.domainUserId}::uuid
        )
        ON CONFLICT (match_id) WHERE scope_type='match' DO NOTHING
        RETURNING id, room_name
      `;
      if (!rows.length) throw new Error('A broadcast room already exists for this match.');
      await tx`
        INSERT INTO public.media_broadcast_audit_events (room_id, actor_user_id, actor_kind, action, details)
        VALUES (${rows[0].id}::uuid, ${authorization.user.domainUserId}::uuid, 'admin', 'room_created',
          ${JSON.stringify({ scopeKey, matchId })}::jsonb)
      `;
      return rows[0];
    }));
    revalidatePath('/admin/studio');
    return { success: true, data: { id: room.id, roomName: room.room_name } };
  } catch (error) {
    console.error('Match broadcast room creation failed', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unable to create match room.' };
  }
}

export async function createBroadcastInvite(input: {
  roomId: string; label?: string; expiresInHours?: number; maxUses?: number | null;
}): Promise<Result> {
  const authorization = await authorizeMediaEditorialAction('broadcast');
  if (!authorization.ok) return { success: false, error: authorization.error, code: 'MEDIA_BROADCAST_FORBIDDEN' };
  if (!uuid(input?.roomId)) return { success: false, error: 'Invalid broadcast room.' };
  const expiresInHours = Number.isInteger(input.expiresInHours) ? Math.max(1, Math.min(input.expiresInHours!, 24 * 30)) : 24;
  const maxUses = input.maxUses === null || input.maxUses === undefined ? null :
    Number.isInteger(input.maxUses) && input.maxUses! > 0 ? Math.min(input.maxUses!, 1000) : -1;
  if (maxUses === -1) return { success: false, error: 'Invite use limit must be a positive whole number or unlimited.' };
  try {
    const bytes = new Uint8Array(32); crypto.getRandomValues(bytes);
    let binary = ''; for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    const token = btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    // Persist only a one-way SHA-256 token hash; the raw invite token is returned once.
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    let hex = ''; const digestBytes = new Uint8Array(digest); for (let i = 0; i < digestBytes.length; i += 1) hex += digestBytes[i].toString(16).padStart(2, '0');
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();
    const invite = await withFactsportBroadcastAdminPostgres(async sql => sql.begin(async tx => {
      const rooms = await tx`SELECT id, scope_type, match_id FROM public.media_broadcast_rooms WHERE id=${input.roomId}::uuid FOR SHARE`;
      if (!rooms.length) throw new Error('Broadcast room not found.');
      const rows = await tx`
        INSERT INTO public.media_broadcast_invites
          (room_id, token_hash, invited_label, max_uses, expires_at, created_by)
        VALUES (
          ${input.roomId}::uuid, ${hex}, ${typeof input.label === 'string' ? input.label.trim().slice(0, 100) || 'VIP Guest' : 'VIP Guest'},
          ${maxUses}, ${expiresAt}::timestamptz, ${authorization.user.domainUserId}::uuid
        ) RETURNING id, expires_at, max_uses
      `;
      await tx`
        INSERT INTO public.media_broadcast_audit_events (room_id, actor_user_id, actor_kind, action, details)
        VALUES (${input.roomId}::uuid, ${authorization.user.domainUserId}::uuid, 'admin', 'invite_created',
          ${JSON.stringify({ inviteId: rows[0].id, expiresAt, maxUses })}::jsonb)
      `;
      return { ...rows[0], scope_type: rooms[0].scope_type, match_id: rooms[0].match_id };
    }));
    revalidatePath('/admin/studio');
    return { success: true, data: {
      id: invite.id, token, expiresAt: invite.expires_at, maxUses: invite.max_uses,
      invitePath: invite.scope_type === 'global' ? '/live' : '/match/' + String(invite.match_id),
    } };
  } catch (error) {
    console.error('Broadcast invite creation failed', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unable to create broadcast invite.' };
  }
}


export async function createBroadcastInviteForRoomKey(roomKey: string): Promise<Result> {
  const authorization = await authorizeMediaEditorialAction('broadcast');
  if (!authorization.ok) return { success: false, error: authorization.error, code: 'MEDIA_BROADCAST_FORBIDDEN' };
  if (typeof roomKey !== 'string' || !roomKey.trim() || roomKey.length > 160) {
    return { success: false, error: 'Invalid broadcast room key.' };
  }
  try {
    const rooms = await withFactsportBroadcastAdminPostgres(async sql => sql`
      SELECT id, scope_type, match_id
      FROM public.media_broadcast_rooms
      WHERE scope_key=${roomKey.trim()}
         OR (match_id IS NOT NULL AND match_id::text=${roomKey.trim()})
      LIMIT 1
    `);
    if (!rooms.length) return { success: false, error: 'Broadcast room not found.' };
    const result = await createBroadcastInvite({
      roomId: rooms[0].id as string,
      label: 'VIP Guest',
      expiresInHours: 24,
      maxUses: null,
    });
    if (!result.success) return result;
    return {
      success: true,
      data: {
        ...result.data,
        invitePath: rooms[0].scope_type === 'global' ? '/live' : '/match/' + String(rooms[0].match_id),
      },
    };
  } catch (error) {
    console.error('Broadcast invite link creation failed', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unable to create broadcast invitation.' };
  }
}

export async function revokeBroadcastInvite(inviteId: string): Promise<Result> {
  const authorization = await authorizeMediaEditorialAction('broadcast');
  if (!authorization.ok) return { success: false, error: authorization.error, code: 'MEDIA_BROADCAST_FORBIDDEN' };
  if (!uuid(inviteId)) return { success: false, error: 'Invalid broadcast invite.' };
  try {
    await withFactsportBroadcastAdminPostgres(async sql => sql.begin(async tx => {
      const rows = await tx`UPDATE public.media_broadcast_invites SET revoked_at=now() WHERE id=${inviteId}::uuid AND revoked_at IS NULL RETURNING room_id`;
      if (!rows.length) throw new Error('Invite was not found or is already revoked.');
      await tx`
        INSERT INTO public.media_broadcast_audit_events (room_id, actor_user_id, actor_kind, action, details)
        VALUES (${rows[0].room_id}::uuid, ${authorization.user.domainUserId}::uuid, 'admin', 'invite_revoked',
          ${JSON.stringify({ inviteId })}::jsonb)
      `;
    }));
    revalidatePath('/admin/studio');
    return { success: true };
  } catch (error) {
    console.error('Broadcast invite revocation failed', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unable to revoke broadcast invite.' };
  }
}

export async function grantBroadcastRole(input: { roomId: string; userId: string; role: 'host' | 'moderator' | 'caller' }): Promise<Result> {
  const authorization = await authorizeMediaEditorialAction('broadcast');
  if (!authorization.ok) return { success: false, error: authorization.error, code: 'MEDIA_BROADCAST_FORBIDDEN' };
  if (!uuid(input?.roomId) || !uuid(input?.userId) || !['host', 'moderator', 'caller'].includes(input?.role)) {
    return { success: false, error: 'Choose a valid room, internal user and broadcast role.' };
  }
  try {
    await withFactsportBroadcastAdminPostgres(async sql => sql.begin(async tx => {
      const inserted = await tx`
        INSERT INTO public.media_broadcast_room_roles (room_id, user_id, role_key, granted_by)
        VALUES (${input.roomId}::uuid, ${input.userId}::uuid, ${input.role}, ${authorization.user.domainUserId}::uuid)
        ON CONFLICT (room_id, user_id, role_key) WHERE revoked_at IS NULL DO NOTHING
        RETURNING id
      `;
      if (!inserted.length) throw new Error('This user already has the active broadcast role for this room.');
      await tx`
        INSERT INTO public.media_broadcast_audit_events (room_id, actor_user_id, actor_kind, action, details)
        VALUES (${input.roomId}::uuid, ${authorization.user.domainUserId}::uuid, 'admin', 'role_granted',
          ${JSON.stringify({ targetUserId: input.userId, role: input.role })}::jsonb)
      `;
    }));
    revalidatePath('/admin/studio');
    return { success: true };
  } catch (error) {
    console.error('Broadcast role grant failed', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unable to grant broadcast role.' };
  }
}

export async function revokeBroadcastRole(roleId: string): Promise<Result> {
  const authorization = await authorizeMediaEditorialAction('broadcast');
  if (!authorization.ok) return { success: false, error: authorization.error, code: 'MEDIA_BROADCAST_FORBIDDEN' };
  if (!uuid(roleId)) return { success: false, error: 'Invalid broadcast role grant.' };
  try {
    await withFactsportBroadcastAdminPostgres(async sql => sql.begin(async tx => {
      const rows = await tx`
        UPDATE public.media_broadcast_room_roles SET revoked_at=now()
        WHERE id=${roleId}::uuid AND revoked_at IS NULL RETURNING room_id, user_id, role_key
      `;
      if (!rows.length) throw new Error('Broadcast role was not found or is already revoked.');
      await tx`
        INSERT INTO public.media_broadcast_audit_events (room_id, actor_user_id, actor_kind, action, details)
        VALUES (${rows[0].room_id}::uuid, ${authorization.user.domainUserId}::uuid, 'admin', 'role_revoked',
          ${JSON.stringify({ targetUserId: rows[0].user_id, role: rows[0].role_key })}::jsonb)
      `;
    }));
    revalidatePath('/admin/studio');
    return { success: true };
  } catch (error) {
    console.error('Broadcast role revocation failed', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unable to revoke broadcast role.' };
  }
}
