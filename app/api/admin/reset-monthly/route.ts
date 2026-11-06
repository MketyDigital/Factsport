export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/app/lib/supabase/admin';
import { authorizeAdminAction, isCronRequest, isSameOriginRequest } from '@/app/lib/admin/authorization';

export async function POST(request: Request) {
  try {
    const cronAuthorized = await isCronRequest(request);
    if (!cronAuthorized) {
      if (!isSameOriginRequest(request)) {
        return NextResponse.json({ error: 'Same-origin request required.' }, { status: 403 });
      }
      const authorization = await authorizeAdminAction();
      if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('profiles')
      .update({ monthly_points: 0, monthly_correct_scores: 0 })
      .gt('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
    return NextResponse.json({ success: true, message: 'New month started. Monthly scores reset.' });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Server error' }, { status: 500 });
  }
}
