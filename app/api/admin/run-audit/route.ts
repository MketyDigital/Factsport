export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { getSupabaseAdmin } from '@/app/lib/supabase/admin';
import { isCronRequest } from '@/app/lib/admin/authorization';
import { runMonthlyPrizeAudit } from '@/app/lib/admin/monthly-prize-audit';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  if (!(await isCronRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runMonthlyPrizeAudit(getSupabaseAdmin());
    return NextResponse.json({
      success: true,
      message: `Audit for ${result.monthYear} complete. Saved ${result.drafted} qualified drafts.`,
      ...result,
    });
  } catch (error) {
    console.error('Monthly prize audit failed:', error);
    return NextResponse.json({
      error: 'Monthly prize audit failed. Check the protected workflow logs.'
    }, { status: 500 });
  }
}
