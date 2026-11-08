export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createEntraAuthorization, entraCookieNames, entraCookieOptions } from '@/lib/auth/entra-external';

export async function GET(request: Request) {
  try {
    const result = await createEntraAuthorization(new URL(request.url));
    const response = NextResponse.redirect(result.authorizationUrl, 302);
    response.cookies.set(entraCookieNames.state, result.stateCookie, entraCookieOptions.state);
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    return response;
  } catch (error) {
    console.error('Entra login could not start', error);
    return NextResponse.json({ error: 'Factsport sign-in is not configured or temporarily unavailable.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
