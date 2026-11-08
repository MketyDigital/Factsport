export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';
import { isFactsportBroadcastTokenIssuerReady, withFactsportBroadcastAdminPostgres } from '@/lib/adapters/postgres-client';
import StudioClient from './StudioClient';

export default async function AdminStudioPage() {
  const authorization = await authorizeMediaEditorialAction('broadcast');
  if (!authorization.ok) {
    return <section className="mx-auto max-w-4xl rounded-2xl border border-amber-200 bg-white p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-amber-700">Media · Broadcast control</p>
      <h1 className="mt-2 text-2xl font-black text-slate-900">Live Studio</h1>
      <p className="mt-3 text-sm text-slate-600">{authorization.error}</p>
    </section>;
  }

  try {
    const data = await withFactsportBroadcastAdminPostgres(async sql => {
      const settings = await sql`
        SELECT s.title, s.audio_url, s.video_url, s.is_active,
               r.id AS room_id, r.is_active AS room_active,
               r.public_listening_enabled, r.callin_enabled
        FROM public.media_studio_settings s
        JOIN public.media_broadcast_rooms r ON r.id=s.room_id
        WHERE s.singleton=true
        LIMIT 1
      `;
      const rooms = await sql`
        SELECT id, scope_key, room_name, scope_type, match_id, is_active,
               public_listening_enabled, callin_enabled, updated_at
        FROM public.media_broadcast_rooms
        ORDER BY CASE WHEN scope_type='global' THEN 0 ELSE 1 END, updated_at DESC
        LIMIT 100
      `;
      const invites = await sql`
        SELECT i.id, i.room_id, r.room_name, i.invited_label, i.max_uses,
               i.use_count, i.expires_at, i.revoked_at, i.created_at
        FROM public.media_broadcast_invites i
        JOIN public.media_broadcast_rooms r ON r.id=i.room_id
        ORDER BY i.created_at DESC
        LIMIT 50
      `;
      const roles = await sql`
        SELECT rr.id, rr.room_id, r.room_name, rr.user_id, rr.role_key, rr.created_at
        FROM public.media_broadcast_room_roles rr
        JOIN public.media_broadcast_rooms r ON r.id=rr.room_id
        WHERE rr.revoked_at IS NULL
        ORDER BY rr.created_at DESC
        LIMIT 100
      `;
      return { settings: settings[0] || null, rooms, invites, roles };
    });
    return <StudioClient
      initialSettings={data.settings as any}
      initialRooms={data.rooms as any[]}
      initialInvites={data.invites as any[]}
      initialRoles={data.roles as any[]}
      tokenIssuerReady={isFactsportBroadcastTokenIssuerReady()}
    />;
  } catch (error) {
    console.error('V2 broadcast admin database unavailable', error);
    return <section className="mx-auto max-w-4xl rounded-2xl border border-amber-200 bg-white p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-amber-700">Media · Broadcast control</p>
      <h1 className="mt-2 text-2xl font-black text-slate-900">Live Studio</h1>
      <p className="mt-3 text-sm text-slate-600">The dedicated broadcast administrator database binding is not provisioned. No legacy Supabase studio writer is available.</p>
      <ul className="mt-5 list-disc space-y-2 pl-5 text-sm text-slate-600">
        <li>Global Goal Rush and match-specific rooms remain separate.</li>
        <li>Public listeners do not require Prediction VIP or payment status.</li>
        <li>Host, moderator and caller grants are independent Media roles.</li>
        <li>Invite tokens are stored as hashes; the Stream token issuer remains a separate prerequisite.</li>
      </ul>
    </section>;
  }
}
