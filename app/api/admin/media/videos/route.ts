import { NextResponse } from 'next/server';
import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  const authorization = await authorizeMediaEditorialAction('media');
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, {
    status: authorization.status, headers: { 'Cache-Control': 'private, no-store' },
  });
  try {
    const videos = await withFactsportEditorialPostgres(sql => sql`
      SELECT id, title, description, upload_status, upload_expires_at,
             duration_seconds, width, height, size_bytes, rights_status,
             rights_reference, attribution_text, usage_expires_at,
             rights_reviewed_by, rights_reviewed_at, is_public,
             created_at, updated_at
      FROM public.media_video_assets
      ORDER BY created_at DESC
      LIMIT 100
    `);
    return NextResponse.json({ success: true, videos }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Media video library lookup failed', error);
    return NextResponse.json({ error: 'Video library is unavailable.' }, {
      status: 503, headers: { 'Cache-Control': 'private, no-store' },
    });
  }
}
