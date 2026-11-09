import { NextResponse } from 'next/server';
import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';
import { isSameOriginRequest } from '@/app/lib/admin/authorization';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';
import {
  deleteFactsportStreamVideo, getFactsportStreamPlaybackHost, getFactsportStreamVideo,
  isFactsportStreamVideoReady,
} from '@/lib/media/cloudflare-stream';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: { params: { id: string } }) {
  const authorization = await authorizeMediaEditorialAction('media');
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, {
    status: authorization.status, headers: { 'Cache-Control': 'private, no-store' },
  });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Same-origin request required.' }, { status: 403 });
  if (!isFactsportStreamVideoReady()) return NextResponse.json({ error: 'Cloudflare Stream VOD is not provisioned.' }, { status: 503 });
  const assetId = context.params?.id || '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assetId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    const existing = await withFactsportEditorialPostgres(async sql => {
      const rows = await sql`
        SELECT id, provider_video_id, upload_status, rights_status, upload_expires_at
        FROM public.media_video_assets WHERE id=${assetId}::uuid LIMIT 1
      `;
      return rows[0] || null;
    });
    if (!existing) return NextResponse.json({ error: 'Video asset not found.' }, { status: 404 });
    const result = await getFactsportStreamVideo(existing.provider_video_id);
    const providerState = String(result.status?.state || '').toLowerCase();
    const ready = result.readyToStream === true && typeof result.playback?.hls === 'string';
    const failed = providerState === 'error';
    const expiredUnuploaded = !ready && !failed && providerState === 'pendingupload' &&
      existing.upload_status === 'pending_upload' && existing.upload_expires_at &&
      new Date(existing.upload_expires_at).valueOf() <= Date.now();
    const uploadStatus = ready ? 'ready' : failed || expiredUnuploaded ? 'failed' :
      providerState === 'pendingupload' ? 'pending_upload' : 'processing';
    const playbackHost = ready ? getFactsportStreamPlaybackHost(result.playback.hls) : null;
    const duration = Number(result.duration);
    const width = Number(result.input?.width);
    const height = Number(result.input?.height);
    const size = Number(result.size);
    const asset = await withFactsportEditorialPostgres(async sql => sql.begin(async tx => {
      const rows = await tx`
        UPDATE public.media_video_assets
        SET upload_status=${uploadStatus},
            duration_seconds=${Number.isFinite(duration) && duration > 0 ? duration : null},
            width=${Number.isInteger(width) && width > 0 ? width : null},
            height=${Number.isInteger(height) && height > 0 ? height : null},
            size_bytes=${Number.isSafeInteger(size) && size >= 0 ? size : null},
            thumbnail_url=${typeof result.thumbnail === 'string' ? result.thumbnail : null},
            playback_host=${playbackHost},
            ready_at=CASE WHEN ${ready} THEN COALESCE(ready_at, now()) ELSE ready_at END,
            updated_at=now()
        WHERE id=${assetId}::uuid
        RETURNING id, title, upload_status, duration_seconds, width, height,
                  size_bytes, rights_status, rights_reviewed_at, is_public, updated_at
      `;
      if (existing.upload_status !== uploadStatus && (ready || failed || expiredUnuploaded)) {
        await tx`
          INSERT INTO public.media_editorial_audit_events (actor_user_id, action, details)
          VALUES (
            ${authorization.user.domainUserId}::uuid,
            ${ready ? 'media_video_uploaded' : 'media_video_upload_failed'},
            ${JSON.stringify({ assetId, providerStatus: result.status?.state || null })}::jsonb
          )
        `;
      }
      return rows[0];
    }));
    if (expiredUnuploaded) {
      try {
        await deleteFactsportStreamVideo(existing.provider_video_id);
      } catch (cleanupError) {
        console.error('Expired unuploaded Stream video cleanup failed', cleanupError);
      }
    }
    return NextResponse.json({ success: true, asset }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Cloudflare Stream video status refresh failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to refresh video processing status.' }, {
      status: 503, headers: { 'Cache-Control': 'private, no-store' },
    });
  }
}
