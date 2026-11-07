import { NextResponse } from 'next/server';

export function legacyRouteDisabled(route: string, owner: 'media' | 'prediction' | 'shared') {
  return NextResponse.json({
    error: 'Legacy endpoint disabled in Factsport V2.',
    code: 'V2_LEGACY_ROUTE_DISABLED',
    route,
    owner,
    replacementStatus: 'not_provisioned',
  }, {
    status: 410,
    headers: { 'Cache-Control': 'no-store' },
  });
}
