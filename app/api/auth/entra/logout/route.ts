export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { entraCookieNames, entraCookieOptions } from '@/lib/auth/entra-external';

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get('origin');
  try {
    if (!origin || new URL(origin).origin !== requestUrl.origin) {
      return NextResponse.json({ error: 'Same-origin sign-out required.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid sign-out origin.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }
  const response = NextResponse.redirect(new URL('/media-login', requestUrl.origin), 303);
  response.cookies.set(entraCookieNames.session, '', { ...entraCookieOptions.session, maxAge: 0 });
  response.cookies.set(entraCookieNames.state, '', { ...entraCookieOptions.state, maxAge: 0 });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}