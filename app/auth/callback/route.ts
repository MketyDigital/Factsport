export const runtime = 'edge'; 
export const dynamic = 'force-dynamic';

import { createClient } from '@/app/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { searchParams, origin } = requestUrl;
  const privateHost = (process.env.FACTSPORT_PRIVATE_PRODUCT_HOST || '').trim().toLowerCase();
  if (!privateHost || requestUrl.hostname.toLowerCase() !== privateHost) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  const code = searchParams.get('code');
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth-code-error`);
}