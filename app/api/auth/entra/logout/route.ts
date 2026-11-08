export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { entraCookieNames, entraCookieOptions } from '@/lib/auth/entra-external';

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL('/media-login', request.url));
  response.cookies.set(entraCookieNames.session, '', { ...entraCookieOptions.session, maxAge: 0 });
  response.cookies.set(entraCookieNames.state, '', { ...entraCookieOptions.state, maxAge: 0 });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}