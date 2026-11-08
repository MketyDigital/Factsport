'use client';

import { useState, useTransition } from 'react';
import {
  blockBroadcastParticipant, createBroadcastInvite, createMatchBroadcastRoom, grantBroadcastRole, revokeBroadcastInvite,
  revokeBroadcastRole, updateBroadcastRoom, updateStudioSettings,
} from './actions';

type Settings = {
  title: string; audio_url: string | null; video_url: string | null; is_active: boolean;
  room_id: string; room_active: boolean; public_listening_enabled: boolean; callin_enabled: boolean;
};
type Room = {
  id: string; scope_key: string; room_name: string; scope_type: string; match_id: string | null;
  is_active: boolean; public_listening_enabled: boolean; callin_enabled: boolean; updated_at: string;
};
type Invite = {
  id: string; room_id: string; room_name: string; invited_label: string; max_uses: number | null;
  use_count: number; expires_at: string; revoked_at: string | null; created_at: string;
};
type Role = { id: string; room_id: string; room_name: string; user_id: string; role_key: string; created_at: string };
type Participant = { id: string; room_id: string; room_name: string; stream_user_id: string; identity_kind: string; role_key: string; mic_enabled: boolean; joined_at: string; last_seen_at: string; display_label: string };

export default function StudioClient({ initialSettings, initialRooms, initialInvites, initialRoles, initialParticipants, tokenIssuerReady }: {
  initialSettings: Settings | null; initialRooms: Room[]; initialInvites: Invite[]; initialRoles: Role[]; initialParticipants: Participant[]; tokenIssuerReady: boolean;
}) {
  const [settings, setSettings] = useState<Settings | null>(initialSettings);
  const [rooms] = useState(initialRooms);
  const [invites, setInvites] = useState(initialInvites);
  const [roles, setRoles] = useState(initialRoles);
  const [participants] = useState(initialParticipants);
  const [inviteRoomId, setInviteRoomId] = useState(initialSettings?.room_id || initialRooms[0]?.id || '');
  const [inviteLabel, setInviteLabel] = useState('VIP Guest');
  const [inviteHours, setInviteHours] = useState(24);
  const [inviteMaxUses, setInviteMaxUses] = useState('');
  const [newMatchId, setNewMatchId] = useState('');
  const [roleRoomId, setRoleRoomId] = useState(initialSettings?.room_id || initialRooms[0]?.id || '');
  const [roleUserId, setRoleUserId] = useState('');
  const [roleKey, setRoleKey] = useState<'host' | 'moderator' | 'caller'>('moderator');
  const [newToken, setNewToken] = useState('');
  const [newInviteLink, setNewInviteLink] = useState('');
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();

  function refresh() { window.location.reload(); }

  if (!settings) return <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Global studio settings are not initialized.</p>;

  return <section className="space-y-6">
    <header className="border-b border-slate-200 pb-5">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-blue-700">Media system / Broadcast control</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight">Live Studio</h1>
      <p className="mt-2 text-sm text-slate-500">Manage Global Goal Rush, match rooms, room grants and guest invitation records. Stream token issuance and participant controls remain independently gated.</p>
    </header>

    <form className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5" onSubmit={event => {
      event.preventDefault();
      startTransition(async () => {
        const result = await updateStudioSettings({
          title: settings.title, audioUrl: settings.audio_url || undefined, videoUrl: settings.video_url || undefined,
          isActive: settings.is_active, publicListeningEnabled: settings.public_listening_enabled, callinEnabled: settings.callin_enabled,
        });
        setMessage(result.success ? 'Global studio settings saved.' : result.error); if (result.success) refresh();
      });
    }}>
      <div><p className="text-xs font-black uppercase tracking-wide text-blue-700">Global Goal Rush</p><h2 className="mt-1 text-xl font-black">Studio settings</h2></div>
      <label className="block text-xs font-bold text-slate-600">Studio title
        <input value={settings.title} onChange={event => setSettings({ ...settings, title: event.target.value })} maxLength={160} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm" />
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs font-bold text-slate-600">Audio URL or StreamIO
          <input value={settings.audio_url || ''} onChange={event => setSettings({ ...settings, audio_url: event.target.value || null })} placeholder="https://… or streamio" className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm" />
        </label>
        <label className="text-xs font-bold text-slate-600">Video URL or StreamIO
          <input value={settings.video_url || ''} onChange={event => setSettings({ ...settings, video_url: event.target.value || null })} placeholder="https://… or streamio" className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm" />
        </label>
      </div>
      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={settings.is_active} disabled={!tokenIssuerReady} /> Activate public studio</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={settings.public_listening_enabled} onChange={event => setSettings({ ...settings, public_listening_enabled: event.target.checked })} /> Allow public listening</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={settings.callin_enabled} disabled={!tokenIssuerReady} /> Enable call-in requests</label>
      </div>
      <p className="text-xs text-amber-700">{tokenIssuerReady ? 'Token issuer configured. Complete private-room tests before enabling the studio or call-ins.' : 'Keep the studio inactive and call-ins disabled until the Stream token issuer and its dedicated database binding are provisioned.'}</p>
      <button disabled={pending} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{pending ? 'Saving…' : 'Save studio settings'}</button>
      <button type="button" disabled={pending || !settings.is_active} onClick={() => startTransition(async () => {
        const result = await updateBroadcastRoom({
          roomId: settings.room_id, isActive: false,
          publicListeningEnabled: settings.public_listening_enabled, callinEnabled: false,
        });
        setMessage(result.success ? 'Global studio shut down.' : result.error); if (result.success) refresh();
      })} className="ml-2 rounded-xl border border-red-200 px-5 py-3 text-sm font-bold text-red-700 disabled:opacity-50">Shutdown active studio</button>
    </form>

    <form className="rounded-2xl border border-slate-200 bg-white p-5" onSubmit={event => {
      event.preventDefault();
      startTransition(async () => {
        const result = await createMatchBroadcastRoom(newMatchId);
        setMessage(result.success ? 'Inactive match room created.' : result.error);
        if (result.success) refresh();
      });
    }}>
      <h2 className="text-lg font-black">Create match-specific room</h2>
      <p className="mt-1 text-xs text-slate-500">Uses the canonical Factsport match UUID. New rooms always start inactive with call-ins disabled.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input value={newMatchId} onChange={event => setNewMatchId(event.target.value)} placeholder="Canonical match UUID" className="min-w-0 flex-1 rounded-lg border border-slate-200 p-2 text-sm" />
        <button disabled={pending || !newMatchId} className="rounded-lg bg-slate-950 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Create inactive room</button>
      </div>
    </form>

    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
      <div><h2 className="text-xl font-black">Broadcast rooms</h2><p className="mt-1 text-xs text-slate-500">Global and match-specific rooms have separate active/listener/call-in controls.</p></div>
      {rooms.map(room => <div key={room.id} className="rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="font-bold text-slate-900">{room.room_name}</p><p className="text-xs text-slate-500">{room.scope_type} · {room.scope_key}</p>{room.match_id && <p className="text-[11px] text-slate-400">Match: {room.match_id}</p>}</div>
          <span className={room.is_active ? 'rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700' : 'rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600'}>{room.is_active ? 'Active' : 'Inactive'}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs">
          <label className="flex items-center gap-2"><input type="checkbox" checked={room.public_listening_enabled} onChange={event => {
            const next = { ...room, public_listening_enabled: event.target.checked };
            startTransition(async () => { const result = await updateBroadcastRoom({ roomId: room.id, isActive: room.is_active, publicListeningEnabled: next.public_listening_enabled, callinEnabled: room.callin_enabled }); setMessage(result.success ? 'Room updated.' : result.error); if (result.success) refresh(); });
          }} /> Public listening</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={room.callin_enabled} disabled={!tokenIssuerReady} onChange={event => {
            const next = { ...room, callin_enabled: event.target.checked };
            startTransition(async () => { const result = await updateBroadcastRoom({ roomId: room.id, isActive: room.is_active, publicListeningEnabled: room.public_listening_enabled, callinEnabled: next.callin_enabled }); setMessage(result.success ? 'Room updated.' : result.error); if (result.success) refresh(); });
          }} /> Call-in enabled</label>
          <button disabled={pending} onClick={() => startTransition(async () => {
            const result = await updateBroadcastRoom({ roomId: room.id, isActive: !room.is_active, publicListeningEnabled: room.public_listening_enabled, callinEnabled: room.callin_enabled });
            setMessage(result.success ? 'Room state updated.' : result.error); if (result.success) refresh();
          })} className="rounded-lg border border-slate-300 px-3 py-1.5 font-bold">{room.is_active ? 'Shut down room' : 'Activate room'}</button>
        </div>
      </div>)}
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="text-xl font-black">Live participants</h2><p className="mt-1 text-xs text-slate-500">Presence is reconciled from signed Stream webhooks. Blocking revokes the room identity and attempts to block the Stream user.</p></div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{participants.length} active</span>
      </div>
      {participants.length === 0 ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No active participants have been reported by Stream.</p> :
        <div className="mt-4 space-y-2">{participants.map(participant => <div key={participant.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">{participant.display_label} · {participant.room_name}</p>
            <p className="text-[11px] text-slate-500">{participant.identity_kind} · {participant.role_key} · {participant.mic_enabled ? 'Microphone enabled' : 'Listen only'}</p>
            <p className="text-[11px] text-slate-400">Joined {new Date(participant.joined_at).toLocaleString()} · Last seen {new Date(participant.last_seen_at).toLocaleString()}</p>
          </div>
          <button disabled={pending} onClick={() => startTransition(async () => {
            const result = await blockBroadcastParticipant({ roomId: participant.room_id, streamUserId: participant.stream_user_id });
            setMessage(result.success ? String(result.data?.warning || 'Participant blocked and room access revoked.') : result.error);
            if (result.success) refresh();
          })} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">Block participant</button>
        </div>)}</div>}
    </section>

    <section className="grid gap-5 xl:grid-cols-2">
      <form className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5" onSubmit={event => {
        event.preventDefault();
        startTransition(async () => {
          const result = await createBroadcastInvite({ roomId: inviteRoomId, label: inviteLabel, expiresInHours: inviteHours, maxUses: inviteMaxUses ? Number(inviteMaxUses) : null });
          if (result.success && result.data) {
            setNewToken(String(result.data.token || ''));
            const invitePath = String(result.data.invitePath || '');
            setNewInviteLink(invitePath ? window.location.origin + invitePath + '#guest=' + encodeURIComponent(String(result.data.token || '')) : '');
            setInvites(current => [{
              id: String(result.data?.id || ''), room_id: inviteRoomId,
              room_name: rooms.find(room => room.id === inviteRoomId)?.room_name || 'Broadcast room',
              invited_label: inviteLabel, max_uses: result.data?.maxUses as number | null,
              use_count: 0, expires_at: String(result.data?.expiresAt || ''),
              revoked_at: null, created_at: new Date().toISOString(),
            }, ...current].slice(0, 50));
            setMessage('Invite token created and stored as a hash. Guest redemption is not enabled until the token issuer is provisioned.');
          } else setMessage(result.success ? 'Invite created without a token response.' : result.error);
        });
      }}>
        <h2 className="text-lg font-black">Guest invitations</h2>
        <label className="block text-xs font-bold text-slate-600">Room
          <select value={inviteRoomId} onChange={event => setInviteRoomId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm">{rooms.map(room => <option key={room.id} value={room.id}>{room.room_name}</option>)}</select>
        </label>
        <label className="block text-xs font-bold text-slate-600">Guest label
          <input value={inviteLabel} onChange={event => setInviteLabel(event.target.value)} maxLength={100} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-bold text-slate-600">Expiry (hours)
            <input type="number" min={1} max={720} value={inviteHours} onChange={event => setInviteHours(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm" />
          </label>
          <label className="text-xs font-bold text-slate-600">Max uses (blank = reusable)
            <input type="number" min={1} max={1000} value={inviteMaxUses} onChange={event => setInviteMaxUses(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm" />
          </label>
        </div>
        <button disabled={pending || !inviteRoomId} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{pending ? 'Creating…' : 'Create invitation token'}</button>
        <p className="text-xs text-amber-700">Legacy reusable invite behavior (24 hours) is retained by default. The token issuer must be provisioned before guests can redeem invitations.</p>
        {newToken && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-bold text-amber-900">Copy this invitation link now. The raw token is not stored in plaintext.</p>
          {newInviteLink && <><code className="mt-2 block break-all text-xs">{newInviteLink}</code><button type="button" onClick={() => navigator.clipboard?.writeText(newInviteLink)} className="mt-2 rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-bold">Copy guest link</button></>}
          <details className="mt-2"><summary className="cursor-pointer text-[11px] font-bold text-amber-900">Show raw token</summary><code className="mt-2 block break-all text-xs">{newToken}</code></details>
        </div>}
      </form>

      <form className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5" onSubmit={event => {
        event.preventDefault();
        startTransition(async () => {
          const result = await grantBroadcastRole({ roomId: roleRoomId, userId: roleUserId, role: roleKey });
          setMessage(result.success ? String(result.data?.warning || 'Broadcast role granted.') : result.error); if (result.success) refresh();
        });
      }}>
        <h2 className="text-lg font-black">Room role grants</h2>
        <label className="block text-xs font-bold text-slate-600">Room
          <select value={roleRoomId} onChange={event => setRoleRoomId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm">{rooms.map(room => <option key={room.id} value={room.id}>{room.room_name}</option>)}</select>
        </label>
        <label className="block text-xs font-bold text-slate-600">Factsport internal user UUID
          <input value={roleUserId} onChange={event => setRoleUserId(event.target.value)} placeholder="Internal app_users UUID" className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm" />
        </label>
        <label className="block text-xs font-bold text-slate-600">Broadcast role
          <select value={roleKey} onChange={event => setRoleKey(event.target.value as typeof roleKey)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm"><option value="host">Host</option><option value="moderator">Moderator</option><option value="caller">Caller</option></select>
        </label>
        <button disabled={pending || !roleRoomId || !roleUserId} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Grant room role</button>
      </form>
    </section>

    <section className="grid gap-5 xl:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-black">Invite ledger</h2>
        <div className="mt-3 space-y-2">{invites.map(invite => <div key={invite.id} className="rounded-lg border border-slate-100 p-3">
          <div className="flex items-center justify-between gap-2"><p className="text-sm font-bold">{invite.invited_label} · {invite.room_name}</p><span className="text-[10px] font-bold uppercase text-slate-500">{invite.revoked_at ? 'Revoked' : new Date(invite.expires_at).valueOf() < Date.now() ? 'Expired' : 'Active'}</span></div>
          <p className="mt-1 text-[11px] text-slate-500">Uses {invite.use_count}/{invite.max_uses ?? 'unlimited'} · Expires {new Date(invite.expires_at).toLocaleString()}</p>
          {!invite.revoked_at && new Date(invite.expires_at).valueOf() > Date.now() && <button disabled={pending} onClick={() => startTransition(async () => { const result = await revokeBroadcastInvite(invite.id); setMessage(result.success ? String(result.data?.warning || 'Invite revoked.') : result.error); if (result.success) refresh(); })} className="mt-2 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700">Revoke invite</button>}
        </div>)}</div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-black">Active room roles</h2>
        <div className="mt-3 space-y-2">{roles.map(role => <div key={role.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 p-3">
          <div><p className="text-sm font-bold">{role.role_key} · {role.room_name}</p><p className="text-[11px] text-slate-500">{role.user_id}</p></div>
          <button disabled={pending} onClick={() => startTransition(async () => { const result = await revokeBroadcastRole(role.id); setMessage(result.success ? String(result.data?.warning || 'Role revoked.') : result.error); if (result.success) refresh(); })} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700">Revoke</button>
        </div>)}</div>
      </div>
    </section>
    {message && <p role="status" className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">{message}</p>}
  </section>;
}
