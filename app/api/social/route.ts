import { NextResponse } from 'next/server';

// V2 intentionally does not execute the legacy Supabase-backed social sender.
// Its original source is preserved at docs/audit/legacy-source/api-social-route-v1.ts.
// Match-event routing is being moved to the Media event policy + durable outbox;
// the editorial scheduler is a separate workflow. Fail closed until that dispatcher
// and its isolated provider secrets are provisioned and verified.
export const runtime = 'edge';

export async function POST() {
  return NextResponse.json({
    error: 'Legacy social delivery is disabled in Factsport V2.',
    code: 'V2_SOCIAL_DISPATCHER_NOT_PROVISIONED',
  }, {
    status: 410,
    headers: { 'Cache-Control': 'no-store' },
  });
}
