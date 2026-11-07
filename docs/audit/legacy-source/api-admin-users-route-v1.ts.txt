// Archived verbatim from app/api/admin/users/route.ts before disabling the legacy Supabase-backed admin route in Factsport V2.
// Preserve as migration evidence only. Do not import or execute this file in V2.
export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/app/lib/supabase/admin';
import { authorizeAdminAction, isSameOriginRequest } from '@/app/lib/admin/authorization';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const authorization = await authorizeAdminAction();
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Same-origin request required.' }, { status: 403 });

  try {
    const body = await request.json() as { userId?: unknown; isVip?: unknown; action?: unknown };
    if (typeof body.userId !== 'string' || !UUID_PATTERN.test(body.userId) ||
        body.action !== 'toggle_vip' || typeof body.isVip !== 'boolean') {
      return NextResponse.json({ error: 'Invalid action or parameters.' }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('profiles').update({ is_vip: body.isVip }).eq('id', body.userId);
    if (error) throw error;
    return NextResponse.json({ success: true, message: 'VIP status updated.' });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}
