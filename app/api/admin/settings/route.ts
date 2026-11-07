import { legacyRouteDisabled } from '@/app/lib/v2/legacy-route-disabled';

export const runtime = 'edge';

// Legacy admin settings/user APIs are not V2 admin surfaces.
// Their source is archived; V2 uses dedicated Media/Prediction permissions and stores.
export async function GET() { return legacyRouteDisabled('/api/admin/settings', 'shared'); }
export async function POST() { return legacyRouteDisabled('/api/admin/settings', 'shared'); }
