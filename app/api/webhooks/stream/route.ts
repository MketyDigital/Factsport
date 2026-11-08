export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getFactsportBroadcastRuntimeConfig, withFactsportBroadcastTokenIssuerPostgres } from '@/lib/adapters/postgres-client';

function bytesToHex(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i += 1) result += bytes[i].toString(16).padStart(2, '0');
  return result;
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return mismatch === 0;
}

async function decompressIfGzip(rawBody: ArrayBuffer): Promise<Uint8Array> {
  const bytes = new Uint8Array(rawBody);
  if (bytes.length < 2 || bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes;
  const stream = new Blob([rawBody]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function verifySignature(payload: Uint8Array, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, payload));
  return constantTimeEqual(bytesToHex(digest), signature.toLowerCase());
}


async function removeStreamMember(apiKey: string, apiSecret: string, roomName: string, userId: string) {
  const issuedAt = Math.floor(Date.now() / 1000) - 1;
  const serverToken = await new (await import('jose')).SignJWT({ server: true })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + 5 * 60)
    .sign(new TextEncoder().encode(apiSecret));
  const url = `https://video.stream-io-api.com/api/v2/video/call/audio_room/${encodeURIComponent(roomName)}/members?api_key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: serverToken, 'stream-auth-type': 'jwt', 'Content-Type': 'application/json' },
    body: JSON.stringify({ remove_members: [userId] }),
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    console.error('Stream rejected revoked participant removal', { status: response.status });
    throw new Error('Unable to remove a revoked participant from the Stream room.');
  }
}

function streamUserId(event: any): string | null {
  const value = event?.participant?.user_id || event?.participant?.user?.id ||
    event?.user?.id || event?.user_id;
  return typeof value === 'string' && value.length > 0 && value.length <= 160 ? value : null;
}

async function audit(tx: any, roomId: string, action: string, participantId: string | null, details: Record<string, unknown>) {
  await tx`
    INSERT INTO public.media_broadcast_audit_events (room_id, actor_kind, action, participant_id, details)
    VALUES (${roomId}::uuid, 'system', ${action}, ${participantId}::uuid, ${JSON.stringify(details)}::jsonb)
  `;
}

export async function POST(request: Request) {
  const config = getFactsportBroadcastRuntimeConfig();
  if (!config) return NextResponse.json({ error: 'Broadcast webhook receiver is not configured.' }, { status: 503 });

  const apiKey = request.headers.get('x-api-key') || '';
  const signature = request.headers.get('x-signature') || '';
  const webhookId = request.headers.get('x-webhook-id') || '';
  if (apiKey !== config.apiKey || !signature || !webhookId || webhookId.length > 160) {
    return NextResponse.json({ error: 'Invalid Stream webhook headers.' }, { status: 401 });
  }

  try {
    const rawBody = await request.arrayBuffer();
    if (rawBody.byteLength > 1_000_000) return NextResponse.json({ error: 'Webhook payload is too large.' }, { status: 413 });
    const payload = await decompressIfGzip(rawBody);
    if (!await verifySignature(payload, signature, config.apiSecret)) {
      return NextResponse.json({ error: 'Invalid Stream webhook signature.' }, { status: 401 });
    }
    const event = JSON.parse(new TextDecoder().decode(payload));
    const eventType = typeof event?.type === 'string' ? event.type : '';
    if (!eventType || eventType.length > 160) return NextResponse.json({ error: 'Invalid Stream event payload.' }, { status: 400 });
    const callCid = typeof event.call_cid === 'string' ? event.call_cid : '';
    const callId = callCid.includes(':') ? callCid.slice(callCid.indexOf(':') + 1) : '';
    const incomingUserId = streamUserId(event);

    const result = await withFactsportBroadcastTokenIssuerPostgres(async sql => sql.begin(async tx => {
      const inserted = await tx`
        INSERT INTO public.media_broadcast_webhook_events (webhook_id, event_type, call_cid, stream_user_id)
        VALUES (${webhookId}, ${eventType}, ${callCid || null}, ${incomingUserId})
        ON CONFLICT (webhook_id) DO NOTHING
        RETURNING webhook_id
      `;
      if (!inserted.length) {
        const previous = await tx`SELECT processed_at FROM public.media_broadcast_webhook_events WHERE webhook_id=${webhookId}`;
        if (previous[0]?.processed_at) return { duplicate: true };
      }

      const rooms = callId ? await tx`
        SELECT id, room_name FROM public.media_broadcast_rooms WHERE room_name=${callId} LIMIT 1
      ` : [];
      if (!rooms.length) {
        await tx`UPDATE public.media_broadcast_webhook_events SET processed_at=now() WHERE webhook_id=${webhookId}`;
        return { duplicate: false, ignored: true };
      }
      const roomId = rooms[0].id as string;

      if (eventType === 'call.session_participant_joined' && incomingUserId) {
        const identities = await tx`
          SELECT identity_kind, user_id, role_key, invite_id, expires_at, revoked_at
          FROM public.media_broadcast_token_identities
          WHERE room_id=${roomId}::uuid AND stream_user_id=${incomingUserId}
          LIMIT 1
        `;
        const identity = identities[0];
        if (!identity || identity.revoked_at || new Date(identity.expires_at).valueOf() <= Date.now()) {
          await audit(tx, roomId, 'participant_removed', null, { streamUserId: incomingUserId, reason: 'missing_or_revoked_token_identity' });
          return { duplicate: false, ignored: true, removeUserId: incomingUserId, roomName: rooms[0].room_name as string };
        }
        const participants = await tx`
          INSERT INTO public.media_broadcast_participants
            (room_id, stream_user_id, user_id, identity_kind, role_key, joined_at, last_seen_at, left_at)
          VALUES (
            ${roomId}::uuid, ${incomingUserId}, ${identity.user_id}::uuid,
            ${identity.identity_kind}, ${identity.role_key}, now(), now(), NULL
          )
          ON CONFLICT (room_id, stream_user_id) DO UPDATE SET
            user_id=EXCLUDED.user_id, identity_kind=EXCLUDED.identity_kind,
            role_key=EXCLUDED.role_key, joined_at=now(), last_seen_at=now(), left_at=NULL
          RETURNING id
        `;
        await audit(tx, roomId, 'participant_joined', participants[0].id as string, {
          streamUserId: incomingUserId, identityKind: identity.identity_kind, role: identity.role_key,
        });
      } else if (eventType === 'call.session_participant_left' && incomingUserId) {
        const participants = await tx`
          UPDATE public.media_broadcast_participants
          SET left_at=now(), last_seen_at=now()
          WHERE room_id=${roomId}::uuid AND stream_user_id=${incomingUserId} AND left_at IS NULL
          RETURNING id
        `;
        if (participants.length) await audit(tx, roomId, 'participant_left', participants[0].id as string, { streamUserId: incomingUserId });
      } else if (eventType === 'call.permission_request' && incomingUserId) {
        const participants = await tx`
          SELECT id, role_key FROM public.media_broadcast_participants
          WHERE room_id=${roomId}::uuid AND stream_user_id=${incomingUserId} AND left_at IS NULL
          LIMIT 1
        `;
        if (participants.length && participants[0].role_key === 'caller') {
          await audit(tx, roomId, 'callin_requested', participants[0].id as string, { streamUserId: incomingUserId });
        }
      } else if (eventType === 'call.permissions_updated' && incomingUserId) {
        const permissions = Array.isArray(event.own_capability) ? event.own_capability :
          Array.isArray(event.permissions) ? event.permissions : [];
        const micEnabled = permissions.includes('send-audio');
        const participants = await tx`
          UPDATE public.media_broadcast_participants
          SET mic_enabled=${micEnabled}
          WHERE room_id=${roomId}::uuid AND stream_user_id=${incomingUserId}
          RETURNING id
        `;
        if (participants.length) await audit(tx, roomId, micEnabled ? 'mic_granted' : 'mic_revoked', participants[0].id as string, { streamUserId: incomingUserId });
      } else if (eventType === 'call.user_muted' && incomingUserId) {
        const participants = await tx`
          UPDATE public.media_broadcast_participants SET mic_enabled=false
          WHERE room_id=${roomId}::uuid AND stream_user_id=${incomingUserId}
          RETURNING id
        `;
        if (participants.length) await audit(tx, roomId, 'mic_revoked', participants[0].id as string, { streamUserId: incomingUserId, source: 'stream_user_muted' });
      } else if (eventType === 'call.member_removed' && Array.isArray(event.members)) {
        for (const memberId of event.members) {
          if (typeof memberId !== 'string' || memberId.length > 160) continue;
          const participants = await tx`
            UPDATE public.media_broadcast_participants
            SET left_at=now(), last_seen_at=now(), mic_enabled=false
            WHERE room_id=${roomId}::uuid AND stream_user_id=${memberId} AND left_at IS NULL
            RETURNING id
          `;
          if (participants.length) await audit(tx, roomId, 'participant_removed', participants[0].id as string, { streamUserId: memberId });
        }
      } else if (eventType === 'call.session_ended') {
        const participants = await tx`
          UPDATE public.media_broadcast_participants
          SET left_at=now(), last_seen_at=now(), mic_enabled=false
          WHERE room_id=${roomId}::uuid AND left_at IS NULL
          RETURNING id, stream_user_id
        `;
        for (const participant of participants) {
          await audit(tx, roomId, 'participant_left', participant.id as string, { streamUserId: participant.stream_user_id, reason: 'session_ended' });
        }
      } else if (eventType === 'call.live_started') {
        await audit(tx, roomId, 'broadcast_live_started', null, {});
      } else if (eventType === 'call.ended') {
        await audit(tx, roomId, 'broadcast_live_stopped', null, {});
      } else if (eventType === 'call.recording_started') {
        await audit(tx, roomId, 'recording_started', null, {});
      } else if (eventType === 'call.recording_stopped') {
        await audit(tx, roomId, 'recording_stopped', null, {});
      }

      if (!('removeUserId' in result) || !result.removeUserId) {
        await tx`
          UPDATE public.media_broadcast_webhook_events
          SET processed_at=now()
          WHERE webhook_id=${webhookId}
        `;
      }
      return { ...result, webhookId };
    }));

    if ('removeUserId' in result && result.removeUserId && result.roomName) {
      await removeStreamMember(config.apiKey, config.apiSecret, result.roomName, result.removeUserId);
      await withFactsportBroadcastTokenIssuerPostgres(async sql => sql`
        UPDATE public.media_broadcast_webhook_events SET processed_at=now() WHERE webhook_id=${webhookId}
      `);
    }

    return NextResponse.json({ success: true, ...result }, {
      headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch (error) {
    console.error('Stream webhook processing failed', error);
    return NextResponse.json({ error: 'Stream webhook processing is temporarily unavailable.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
