import { NextResponse } from 'next/server';

// The legacy Supabase/profile-metadata Stream token handler is archived at
// docs/audit/legacy-source/api-stream-token-route-v1.ts. V2 token issuance will
// use the separate Media broadcast token-issuer role and Stream secret binding.
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

function unavailable() {
  return NextResponse.json({
    error: 'V2 Media broadcast token issuer is not provisioned.',
    code: 'V2_BROADCAST_TOKEN_ISSUER_NOT_PROVISIONED',
  }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET() { return unavailable(); }
export async function POST() { return unavailable(); }
