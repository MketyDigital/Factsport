export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';
import { entraCookieNames, readFactsportEntraSession } from '@/lib/auth/entra-external';
import {
  getFactsportBroadcastRuntimeConfig,
  withFactsportBroadcastTokenIssuerPostgres,
} from '@/lib/adapters/postgres-client';

const ANON_COOKIE = '__Host-factsport_broadcast_anon';
const TOKEN_TTL_SECONDS = 4 * 60 * 60;
const ANON_TTL_SECONDS = 4 * 60 * 60;
const STREAM_API_BASE = 'https://video.stream-io-api.com';

class BroadcastIssueError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

function decodeSecret(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  if (bytes.length !== 32) throw new Error('Broadcast anonymous session secret must be a base64url 32-byte key.');
  return bytes;
}

function randomId(): string {
  return crypto.randomUUID();
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < bytes.length; i += 1) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}

async function anonymousIdentity(roomId: string, cookieValue: string | undefined, secret: Uint8Array) {
  if (cookieValue) {
    try {
      const { payload } = await jwtVerify(cookieValue, secret, { algorithms: ['HS256'], clockTolerance: 5 });
      if (payload.kind === 'anonymous-broadcast' && payload.room_id === roomId &&
          typeof payload.sub === 'string' && payload.sub.length > 0) {
        return { subject: payload.sub, cookie: null as string | null };
      }
    } catch {
      // Invalid or expired cookie is replaced with a fresh anonymous identity.
    }
  }
  const subject = randomId();
  const cookie = await new SignJWT({ kind: 'anonymous-broadcast', room_id: roomId })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime(`${ANON_TTL_SECONDS}s`)
    .sign(secret);
  return { subject, cookie };
}


async function consumeRateLimit(tx: any, bucketHash: string, maxPerMinute: number): Promise<boolean> {
  const rows = await tx`
    INSERT INTO public.media_broadcast_token_rate_limits (bucket_hash, window_started_at, request_count)
    VALUES (${bucketHash}, now(), 1)
    ON CONFLICT (bucket_hash) DO UPDATE SET
      request_count = CASE
        WHEN public.media_broadcast_token_rate_limits.window_started_at <= now() - interval '1 minute' THEN 1
        ELSE public.media_broadcast_token_rate_limits.request_count + 1
      END,
      window_started_at = CASE
        WHEN public.media_broadcast_token_rate_limits.window_started_at <= now() - interval '1 minute' THEN now()
        ELSE public.media_broadcast_token_rate_limits.window_started_at
      END,
      updated_at = now()
    RETURNING request_count
  `;
  return Number(rows[0]?.request_count || 0) <= maxPerMinute;
}

async function streamRequest(apiKey: string, serverToken: string, path: string, body: unknown) {
  const response = await fetch(`${STREAM_API_BASE}${path}${path.includes('?') ? '&' : '?'}api_key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: {
      Authorization: serverToken,
      'stream-auth-type': 'jwt',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    console.error('Stream provider request failed', { path: path.split('?')[0], status: response.status });
    throw new BroadcastIssueError('The Stream broadcast provider could not prepare this room.', 503);
  }
  return response.json();
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  if (request.headers.get('origin') !== requestUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin broadcast token requests are not allowed.' }, {
      status: 403, headers: { 'Cache-Control': 'no-store' },
    });
  }
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return NextResponse.json({ error: 'Expected a JSON request.' }, { status: 415, headers: { 'Cache-Control': 'no-store' } });
  }

  let consumedInviteId: string | null = null;
  let consumedInviteRoomId: string | null = null;
  let consumedGuestStreamUserId: string | null = null;
  try {
    const raw = await request.text();
    if (raw.length > 4096) throw new BroadcastIssueError('Broadcast token request is too large.', 413);
    const body = JSON.parse(raw) as { roomKey?: unknown; inviteToken?: unknown };
    const roomKey = typeof body.roomKey === 'string' ? body.roomKey.trim() : '';
    const inviteToken = typeof body.inviteToken === 'string' ? body.inviteToken.trim() : '';
    if (!roomKey || roomKey.length > 160 || (inviteToken && inviteToken.length > 1024)) {
      throw new BroadcastIssueError('A valid room key is required.', 400);
    }

    const config = getFactsportBroadcastRuntimeConfig();
    if (!config) throw new BroadcastIssueError('The Stream token issuer is not configured.', 503);
    const anonSecret = decodeSecret(config.anonymousSessionSecret);
    const cookieStore = cookies();
    const entraSession = await readFactsportEntraSession(cookieStore.get(entraCookieNames.session)?.value);
    const anonCookieValue = cookieStore.get(ANON_COOKIE)?.value;
    const connectingIp = request.headers.get('cf-connecting-ip') || 'unknown';
    const ipBucketHash = await sha256Hex('ip:' + connectingIp + ':' + config.anonymousSessionSecret);
    const inviteTokenHash = inviteToken ? await sha256Hex(inviteToken) : '';
    const identityExpiresAt = new Date(Date.now() + TOKEN_TTL_SECONDS * 1000).toISOString();
    const ipAllowed = await withFactsportBroadcastTokenIssuerPostgres(async sql => sql.begin(tx => consumeRateLimit(tx, ipBucketHash, 30)));
    if (!ipAllowed) throw new BroadcastIssueError('Too many broadcast token requests from this network. Try again shortly.', 429);
    if (inviteTokenHash) {
      const inviteRateHash = await sha256Hex('invite:' + inviteTokenHash + ':' + config.anonymousSessionSecret);
      const inviteAllowed = await withFactsportBroadcastTokenIssuerPostgres(async sql => sql.begin(tx => consumeRateLimit(tx, inviteRateHash, 6)));
      if (!inviteAllowed) throw new BroadcastIssueError('This guest invitation has reached its request limit. Try again shortly.', 429);
    }
    if (entraSession) {
      const userRateHash = await sha256Hex('user:' + entraSession.internalUserId + ':' + config.anonymousSessionSecret);
      const userAllowed = await withFactsportBroadcastTokenIssuerPostgres(async sql => sql.begin(tx => consumeRateLimit(tx, userRateHash, 12)));
      if (!userAllowed) throw new BroadcastIssueError('Too many broadcast token requests for this account. Try again shortly.', 429);
    }

    const identity = await withFactsportBroadcastTokenIssuerPostgres(async sql => sql.begin(async tx => {

      const rooms = await tx`
        SELECT id, room_name, scope_key, scope_type, match_id, is_active,
               public_listening_enabled, callin_enabled
        FROM public.media_broadcast_rooms
        WHERE scope_key=${roomKey}
           OR (match_id IS NOT NULL AND match_id::text=${roomKey})
        LIMIT 1 FOR SHARE
      `;
      const room = rooms[0];
      if (!room) throw new BroadcastIssueError('Broadcast room not found.', 404);
      if (!room.is_active) throw new BroadcastIssueError('This broadcast is not currently active.', 403);

      if (inviteToken) {
        const tokenHash = inviteTokenHash;
        const invites = await tx`
          SELECT id, invited_label, max_uses, use_count, expires_at, revoked_at
          FROM public.media_broadcast_invites
          WHERE token_hash=${tokenHash} AND room_id=${room.id}::uuid
          LIMIT 1 FOR UPDATE
        `;
        const invite = invites[0];
        if (!invite || invite.revoked_at || new Date(invite.expires_at).valueOf() <= Date.now() ||
            (invite.max_uses !== null && invite.use_count >= invite.max_uses)) {
          throw new BroadcastIssueError('Guest invitation is invalid, expired, revoked or fully used.', 403);
        }
        const consumed = await tx`
          UPDATE public.media_broadcast_invites
          SET use_count=use_count+1, last_used_at=now()
          WHERE id=${invite.id}::uuid AND revoked_at IS NULL
            AND expires_at > now() AND (max_uses IS NULL OR use_count < max_uses)
          RETURNING id
        `;
        if (!consumed.length) throw new BroadcastIssueError('Guest invitation has already been consumed or revoked.', 403);
        const guestUserId = 'factsport-guest-' + randomId();
        await tx`
          INSERT INTO public.media_broadcast_token_identities
            (room_id, stream_user_id, identity_kind, role_key, invite_id, expires_at)
          VALUES (${room.id}::uuid, ${guestUserId}, 'guest', 'guest', ${invite.id}::uuid, ${identityExpiresAt}::timestamptz)
          ON CONFLICT (room_id, stream_user_id) DO UPDATE SET
            identity_kind='guest', role_key='guest', invite_id=EXCLUDED.invite_id,
            issued_at=now(), expires_at=EXCLUDED.expires_at
        `;
        return {
          room, identityKind: 'guest' as const, inviteId: invite.id as string, inviteLabel: invite.invited_label as string, subject: randomId(),
          userId: guestUserId, username: invite.invited_label || 'VIP Guest',
          role: 'guest', streamRole: 'user', canRequestCallIn: false, createCall: false,
        };
      }

      if (entraSession) {
        const grants = await tx`
          SELECT role_key FROM public.media_broadcast_room_roles
          WHERE room_id=${room.id}::uuid AND user_id=${entraSession.internalUserId}::uuid
            AND revoked_at IS NULL
          ORDER BY CASE role_key WHEN 'host' THEN 0 WHEN 'moderator' THEN 1 ELSE 2 END
          LIMIT 1
        `;
        const grant = grants[0]?.role_key as string | undefined;
        if (!room.public_listening_enabled && !grant) throw new BroadcastIssueError('Public listening is disabled for this room.', 403);
        if (grant === 'moderator' && !config.moderatorRoleReady) {
          throw new BroadcastIssueError('The Stream moderator call role is not configured. Contact the Media administrator.', 503);
        }
        const role = grant === 'host' ? 'admin' : grant === 'moderator' ? 'moderator' : 'user';
        const roleKey = grant === 'host' ? 'host' : grant === 'moderator' ? 'moderator' : grant === 'caller' ? 'caller' : 'listener';
        const streamUserId = 'factsport-' + entraSession.internalUserId;
        const tokenIdentity = await tx`
          INSERT INTO public.media_broadcast_token_identities
            (room_id, stream_user_id, identity_kind, user_id, role_key, expires_at)
          VALUES (${room.id}::uuid, ${streamUserId}, 'authenticated', ${entraSession.internalUserId}::uuid, ${roleKey}, ${identityExpiresAt}::timestamptz)
          ON CONFLICT (room_id, stream_user_id) DO UPDATE SET
            identity_kind='authenticated', user_id=EXCLUDED.user_id, role_key=EXCLUDED.role_key,
            invite_id=NULL, issued_at=now(), expires_at=EXCLUDED.expires_at
          RETURNING revoked_at
        `;
        if (tokenIdentity[0]?.revoked_at) throw new BroadcastIssueError('This Factsport account is blocked from this broadcast room.', 403);
        return {
          room, identityKind: 'authenticated' as const, subject: entraSession.internalUserId,
          userId: streamUserId,
          username: 'Factsport Fan', role, streamRole: role,
          canRequestCallIn: grant === 'caller' && room.callin_enabled,
          createCall: grant === 'host',
        };
      }

      if (!room.public_listening_enabled) throw new BroadcastIssueError('Public listening is disabled for this room.', 403);
      const anonymous = await anonymousIdentity(room.id, anonCookieValue, anonSecret);
      const anonymousUserId = 'factsport-anon-' + anonymous.subject.replace(/-/g, '');
      const tokenIdentity = await tx`
        INSERT INTO public.media_broadcast_token_identities
          (room_id, stream_user_id, identity_kind, role_key, expires_at)
        VALUES (${room.id}::uuid, ${anonymousUserId}, 'anonymous', 'listener', ${identityExpiresAt}::timestamptz)
        ON CONFLICT (room_id, stream_user_id) DO UPDATE SET
          identity_kind='anonymous', user_id=NULL, role_key='listener', invite_id=NULL,
          issued_at=now(), expires_at=EXCLUDED.expires_at
        RETURNING revoked_at
      `;
      if (tokenIdentity[0]?.revoked_at) throw new BroadcastIssueError('This anonymous listener session is blocked from the broadcast room.', 403);
      return {
        room, identityKind: 'anonymous' as const, subject: anonymous.subject,
        userId: anonymousUserId,
        username: 'Listener', role: 'anonymous', streamRole: 'user',
        canRequestCallIn: false, createCall: false, anonymousCookie: anonymous.cookie,
      };
    }));

    if (identity.identityKind === 'guest') {
      consumedInviteId = identity.inviteId;
      consumedInviteRoomId = identity.room.id as string;
      consumedGuestStreamUserId = identity.userId;
    }

    const issuedAt = Math.floor(Date.now() / 1000) - 1;
    const serverToken = await new SignJWT({ server: true })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + 5 * 60)
      .sign(new TextEncoder().encode(config.apiSecret));

    const user = {
      id: identity.userId,
      role: 'user',
      name: identity.username,
    };
    await streamRequest(config.apiKey, serverToken, '/api/v2/users', { users: { [user.id]: user } });

    const callPath = `/api/v2/video/call/audio_room/${encodeURIComponent(identity.room.room_name)}`;
    if (identity.createCall) {
      await streamRequest(config.apiKey, serverToken, callPath, { data: { created_by_id: identity.userId } });
    }
    if (identity.streamRole === 'admin' || identity.streamRole === 'moderator') {
      await streamRequest(config.apiKey, serverToken, callPath + '/members', {
        update_members: [{ user_id: identity.userId, role: identity.streamRole }],
      });
    }

    const token = await new SignJWT({ user_id: identity.userId })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + TOKEN_TTL_SECONDS)
      .sign(new TextEncoder().encode(config.apiSecret));

    if (consumedInviteId && identity.identityKind === 'guest') {
      await withFactsportBroadcastTokenIssuerPostgres(async sql => sql`
        INSERT INTO public.media_broadcast_audit_events (room_id, actor_kind, action, details)
        VALUES (${identity.room.id}::uuid, 'participant', 'guest_admitted',
          ${JSON.stringify({ inviteId: consumedInviteId, label: identity.inviteLabel })}::jsonb)
      `);
      consumedInviteId = null;
      consumedInviteRoomId = null;
      consumedGuestStreamUserId = null;
    }

    const response = NextResponse.json({
      token,
      userId: identity.userId,
      username: identity.username,
      image: '',
      role: identity.role,
      apiKey: config.apiKey,
      roomName: identity.room.room_name,
      canRequestCallIn: identity.canRequestCallIn,
    }, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

    if ('anonymousCookie' in identity && identity.anonymousCookie) {
      response.cookies.set(ANON_COOKIE, identity.anonymousCookie, {
        httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: ANON_TTL_SECONDS,
      });
    }
    return response;
  } catch (error) {
    if (consumedInviteId) {
      try {
        await withFactsportBroadcastTokenIssuerPostgres(async sql => sql.begin(async tx => {
          await tx`
            UPDATE public.media_broadcast_invites
            SET use_count=GREATEST(use_count - 1, 0)
            WHERE id=${consumedInviteId}::uuid AND revoked_at IS NULL
          `;
          if (consumedGuestStreamUserId && consumedInviteRoomId) {
            await tx`
              UPDATE public.media_broadcast_token_identities SET revoked_at=now()
              WHERE room_id=${consumedInviteRoomId}::uuid AND stream_user_id=${consumedGuestStreamUserId}
            `;
          }
        }));
      } catch (compensationError) {
        console.error('Broadcast invite redemption compensation failed', compensationError);
      }
    }
    const status = error instanceof BroadcastIssueError ? error.status : 503;
    if (!(error instanceof BroadcastIssueError)) console.error('Broadcast token issuance unavailable', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Broadcast token issuance unavailable.',
    }, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  }
}
