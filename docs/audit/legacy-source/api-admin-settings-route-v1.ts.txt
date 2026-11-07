// Archived verbatim from app/api/admin/settings/route.ts before disabling the legacy Supabase-backed admin route in Factsport V2.
// Preserve as migration evidence only. Do not import or execute this file in V2.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/app/lib/supabase/admin';
import { authorizeAdminAction, isSameOriginRequest } from '@/app/lib/admin/authorization';

function safeHttpUrl(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || value.length > 2048) throw new Error('Invalid URL value.');
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP and HTTPS URLs are allowed.');
  return url.toString();
}

export async function POST(request: Request) {
  const authorization = await authorizeAdminAction();
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Same-origin request required.' }, { status: 403 });

  try {
    const body = await request.json() as Record<string, unknown>;
    const code1 = typeof body.code_1xbet === 'string' ? body.code_1xbet.slice(0, 100) : null;
    const code2 = typeof body.code_melbet === 'string' ? body.code_melbet.slice(0, 100) : null;
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('site_settings').update({
      code_1xbet: code1, link_1xbet: safeHttpUrl(body.link_1xbet),
      code_melbet: code2, link_melbet: safeHttpUrl(body.link_melbet),
      default_affiliate_link: safeHttpUrl(body.default_affiliate_link),
      youtube_link: safeHttpUrl(body.youtube_link),
    }).eq('id', 1);
    if (error) throw error;
    return NextResponse.json({ success: true, message: 'Settings saved securely.' });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Server error' }, { status: 400 });
  }
}
