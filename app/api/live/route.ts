import { legacyRouteDisabled } from '@/app/lib/v2/legacy-route-disabled';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Original Supabase-backed implementation is preserved under docs/audit/legacy-source.
// V2 replacement is not active; fail closed rather than touching legacy databases.
export async function GET() { return legacyRouteDisabled('/api/live', 'media'); }
export async function POST() { return legacyRouteDisabled('/api/live', 'media'); }
