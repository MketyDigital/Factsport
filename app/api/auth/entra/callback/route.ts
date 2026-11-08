export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { completeEntraCallback, entraCookieNames, entraCookieOptions } from '@/lib/auth/entra-external';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get('error');
  if (error) {
    const response = NextResponse.redirect(new URL('/media-login?error=identity-provider-error', url.origin));
    response.cookies.set(entraCookieNames.state, '', { ...entraCookieOptions.state, maxAge: 0 });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }

  try {
    const result = await completeEntraCallback({
      requestUrl: url,
      code: url.searchParams.get('code') || '',
      state: url.searchParams.get('state') || '',
      stateCookie: request.headers.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith(entraCookieNames.state + '='))?.slice(entraCookieNames.state.length + 1),
    });
    const response = NextResponse.redirect(new URL(result.returnTo, url.origin));
    response.cookies.set(entraCookieNames.session, result.session, {
      ...entraCookieOptions.session,
      maxAge: Math.max(0, result.expiresAt - Math.floor(Date.now() / 1000)),
    });
    response.cookies.set(entraCookieNames.state, '', { ...entraCookieOptions.state, maxAge: 0 });
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    return response;
  } catch (error) {
    console.error('Entra callback rejected', error);
    const response = NextResponse.redirect(new URL('/media-login?error=identity-callback-failed', url.origin));
    response.cookies.set(entraCookieNames.state, '', { ...entraCookieOptions.state, maxAge: 0 });
    response.cookies.set(entraCookieNames.session, '', { ...entraCookieOptions.session, maxAge: 0 });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }
}
