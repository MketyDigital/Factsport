import { NextResponse } from 'next/server';
import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';
import { isSameOriginRequest } from '@/app/lib/admin/authorization';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';
import {
  createFactsportStreamDirectUpload, deleteFactsportStreamVideo,
  isFactsportStreamVideoReady,
} from '@/lib/media/cloudflare-stream';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const authorization = await authorizeMediaEditorialAction('media');
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, {
    status: authorization.status, headers: { 'Cache-Control': 'private, no-store' },
  });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Same-origin request required.' }, { status: 403 });
  if (!isFactsportStreamVideoReady()) {
    return NextResponse.json({ error: 'Cloudflare Stream VOD is not provisioned for this environment.' }, {
      status: 503, headers: { 'Cache-Control': 'private, no-store' },
    });
  }

  let streamUid = '';
  try {
    const body = await request.json() as { title?: unknown; description?: unknown; maxDurationSeconds?: unknown };
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : '';
    const description = typeof body.description === 'string' ? body.description.trim().slice(0, 3000) : '';
    const maxDurationSeconds = Number(body.maxDurationSeconds ?? 900);
    if (title.length < 3 || !Number.isInteger(maxDurationSeconds) ||
        maxDurationSeconds < 1 || maxDurationSeconds > 900) {
      return NextResponse.json({ error: 'Provide a title and a maximum clip duration between 1 and 900 seconds.' }, { status: 400 });
    }

    const assetId = crypto.randomUUID();
    const directUpload = await createFactsportStreamDirectUpload({
      assetId, title, creatorId: authorization.user.domainUserId, maxDurationSeconds,
    });
    streamUid = directUpload.uid;

    const asset = await withFactsportEditorialPostgres(async sql => sql.begin(async tx => {
      const rows = await tx`
        INSERT INTO public.media_video_assets (
          id, provider, provider_video_id, title, description,
          upload_status, upload_expires_at, uploaded_by
        ) VALUES (
          ${assetId}::uuid, 'cloudflare_stream', ${directUpload.uid},
          ${title}, ${description || null}, 'pending_upload',
          ${directUpload.expiresAt}::timestamptz, ${authorization.user.domainUserId}::uuid
        )
        RETURNING id, title, upload_status, upload_expires_at
      `;
      await tx`
        INSERT INTO public.media_editorial_audit_events (actor_user_id, action, details)
        VALUES (
          ${authorization.user.domainUserId}::uuid, 'media_video_upload_started',
          ${JSON.stringify({ assetId, provider: 'cloudflare_stream', maxDurationSeconds })}::jsonb
        )
      `;
      return rows[0];
    }));
    return NextResponse.json({
      success: true, asset,
      upload: { url: directUpload.uploadURL, expiresAt: directUpload.expiresAt, maxDurationSeconds },
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (streamUid) {
      try { await deleteFactsportStreamVideo(streamUid); } catch (cleanupError) {
        console.error('Cloudflare Stream orphan cleanup failed', cleanupError);
      }
    }
    console.error('Cloudflare Stream direct upload creation failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create the video upload.' }, {
      status: 503, headers: { 'Cache-Control': 'private, no-store' },
    });
  }
}
