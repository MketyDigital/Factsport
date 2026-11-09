export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';
import { isFactsportMediaVideoSchemaReady } from '@/lib/media/readiness';

export async function GET(_request: Request, context: { params: { id: string } }) {
  const authorization = await authorizeMediaEditorialAction('read');
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, {
      status: authorization.status, headers: { 'Cache-Control': 'private, no-store' },
    });
  }
  const articleId = context.params?.id || '';
  if (!/^[0-9a-f-]{36}$/i.test(articleId)) {
    return NextResponse.json({ error: 'Article not found.' }, {
      status: 404, headers: { 'Cache-Control': 'private, no-store' },
    });
  }
  try {
    const revisions = await withFactsportEditorialPostgres(async sql => {
      const rows = await sql`
        SELECT r.id, r.revision_number, r.workflow_status, r.change_note, r.review_comment,
               r.created_at, r.snapshot,
               COALESCE(revision_media.items, '[]'::jsonb) AS revision_media,
               COALESCE(revision_sources.items, '[]'::jsonb) AS revision_sources
        FROM public.editorial_article_revisions r
        LEFT JOIN LATERAL (
          SELECT jsonb_agg(jsonb_build_object(
            'placement', rm.placement, 'position', rm.position, 'remove_media', rm.remove_media,
            'media_id', m.id, 'object_key', m.object_key, 'content_type', m.content_type,
            'width', m.width, 'height', m.height, 'rights_status', m.rights_status,
            'alt_text', m.alt_text, 'attribution_text', m.attribution_text
          ) ORDER BY rm.placement, rm.position) AS items
          FROM public.editorial_article_revision_media rm
          LEFT JOIN public.media_assets m ON m.id=rm.media_id
          WHERE rm.revision_id=r.id
        ) revision_media ON true
        LEFT JOIN LATERAL (
          SELECT jsonb_agg(jsonb_build_object(
            'id', src.id, 'source_title', src.source_title, 'publisher', src.publisher,
            'canonical_url', src.canonical_url, 'attribution_text', src.attribution_text,
            'rights_reference', src.rights_reference, 'accessed_at', src.accessed_at
          ) ORDER BY src.created_at DESC) AS items
          FROM public.editorial_article_sources src
          WHERE src.revision_id=r.id
        ) revision_sources ON true
        WHERE r.article_id=${articleId}::uuid
        ORDER BY r.revision_number DESC
        LIMIT 50
      `;
      if (!isFactsportMediaVideoSchemaReady() || rows.length === 0) {
        return rows.map(row => ({ ...row, revision_videos: [] }));
      }
      const revisionIds = rows.map(row => row.id);
      const videoRows = await sql`
        SELECT rv.revision_id,
          jsonb_agg(jsonb_build_object(
            'position', rv.position, 'video_id', rv.video_id, 'remove_video', rv.remove_video,
            'title', v.title, 'upload_status', v.upload_status, 'rights_status', v.rights_status,
            'rights_reference', v.rights_reference, 'attribution_text', v.attribution_text,
            'usage_expires_at', v.usage_expires_at, 'duration_seconds', v.duration_seconds
          ) ORDER BY rv.position) AS items
        FROM public.editorial_article_revision_videos rv
        LEFT JOIN public.media_video_assets v ON v.id=rv.video_id
        WHERE rv.revision_id = ANY(${revisionIds}::uuid[])
        GROUP BY rv.revision_id
      `;
      const videosByRevision = new Map(videoRows.map(row => [String(row.revision_id), row.items || []]));
      return rows.map(row => ({ ...row, revision_videos: videosByRevision.get(String(row.id)) || [] }));
    });
    return NextResponse.json({ success: true, revisions }, {
      headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch (error) {
    console.error('Editorial revision history unavailable', error);
    return NextResponse.json({ error: 'Revision history is not connected.' }, {
      status: 503, headers: { 'Cache-Control': 'private, no-store' },
    });
  }
}
