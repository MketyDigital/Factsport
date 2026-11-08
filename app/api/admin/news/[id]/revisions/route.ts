export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';

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
    const revisions = await withFactsportEditorialPostgres(async sql => sql`
      SELECT id, revision_number, workflow_status, change_note, review_comment,
             created_at, snapshot
      FROM public.editorial_article_revisions
      WHERE article_id=${articleId}::uuid
      ORDER BY revision_number DESC
      LIMIT 50
    `);
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
