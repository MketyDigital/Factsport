import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { env } from 'cloudflare:workers'

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const isFactsportStagingWorkerHost =
    /^factsport-v2-staging\.[a-z0-9-]+\.workers\.dev(?::\d+)?$/i.test(hostname);

  // The staging hostname itself is a security boundary. If its environment
  // binding is missing or misconfigured, fail closed instead of falling through
  // to the legacy Supabase application paths.
  if (isFactsportStagingWorkerHost && env.FACTSPORT_ENVIRONMENT !== 'staging') {
    return new NextResponse('Not found', {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  // Factsport v2 staging Worker: fail closed on EVERY matched path, including
  // /api and /admin. The hostname guard above also protects against a missing
  // staging environment binding.
  if (env.FACTSPORT_ENVIRONMENT === 'staging' || isFactsportStagingWorkerHost) {
    const secret = env.FACTSPORT_STAGING_TOKEN;
    const provided = request.headers.get('x-factsport-staging-token') || '';
    if (typeof secret !== 'string' || !secret || !provided ||
        provided.length > 4096 || secret.length > 4096) {
      return new NextResponse('Not found', {
        status: 404,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    const encoder = new TextEncoder();
    const [expectedDigest, providedDigest] = await Promise.all([
      crypto.subtle.digest('SHA-256', encoder.encode(secret)),
      crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    ]);
    const a = new Uint8Array(expectedDigest);
    const b = new Uint8Array(providedDigest);
    let mismatch = 0;
    for (let i = 0; i < a.length; i++) mismatch |= a[i] ^ b[i];
    if (mismatch !== 0) {
      return new NextResponse('Not found', {
        status: 404,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
  }
  const pathname = request.nextUrl.pathname;
  const searchParams = request.nextUrl.search;

  // Health and public match reads are staging-only database probes. The mandatory
  // access-token gate above has already run, so skip legacy Supabase auth.
  if (env.FACTSPORT_ENVIRONMENT === 'staging' && (pathname === '/api/v2/health' || pathname === '/api/matches')) {
    return NextResponse.next();
  }

  // -----------------------------------------------------------------
  // 🛡️ PART 0: MALICIOUS PAYLOAD & THREAT FILTER
  // -----------------------------------------------------------------
  // Instantly blocks automated bots trying common SQLi or Path Traversal attacks in the URL
  const threatPatterns = /(\%27)|(\')|(\-\-)|(\%23)|(#)|(\%3B)|(;)|(\.\.\/)|(\%2e\%2e\%2f)/i;
  if (threatPatterns.test(pathname) || threatPatterns.test(searchParams)) {
    return new NextResponse('Forbidden Request: Malicious payload detected.', { status: 403 });
  }

  // -----------------------------------------------------------------
  // 🔒 PART 1: ENVIRONMENT LOCK (Staging & Dev)
  // -----------------------------------------------------------------
  // We lock the site ONLY if:
  // 1. It is a Cloudflare Pages dev URL
  // 2. AND it is NOT an API route (Cron Jobs need access to /api)
  const isDevDomain = hostname === 'factsport.pages.dev' || hostname.endsWith('.factsport.pages.dev');
  const isApiRoute = pathname.startsWith('/api');

  if (isDevDomain && !isApiRoute) {
    const basicAuth = request.headers.get('authorization');

    if (basicAuth) {
      const authValue = basicAuth.split(' ')[1];
      // Decodes "username:password"
      const [user, pwd] = atob(authValue).split(':');

      // 👇 CREDENTIALS
      if (user === 'admin' && pwd === '<Do Not Access>') {
        // Password correct? Allow proceed
      } else {
        return new NextResponse('Auth Required.', {
          status: 401,
          headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' },
        });
      }
    } else {
      return new NextResponse('Auth Required.', {
        status: 401,
        headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' },
      });
    }
  }

  // -----------------------------------------------------------------
  // 🟢 PART 2: SUPABASE AUTH & ADMIN PROTECTION
  // -----------------------------------------------------------------
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // 1. Update request (name & value only)
          request.cookies.set({
            name,
            value,
          })
          
          // 2. Re-initialize response
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          
          // 3. Update response (apply security options here)
          response.cookies.set({
            name,
            value,
            ...options,
            secure: process.env.NODE_ENV === 'production', // 🛡️ Forces secure cookies in prod
            sameSite: 'lax', // 🛡️ Protects against CSRF
          })
        },
        remove(name: string, options: CookieOptions) {
          // 1. Update request (name & empty value only)
          request.cookies.set({
            name,
            value: '',
          })
          
          // 2. Re-initialize response
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          
          // 3. Update response (apply removal options here)
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // 🛡️ SECURITY CHECK FOR ADMIN ROUTES
  if (pathname.startsWith('/admin')) {
    
    // 1. If not logged in -> Send to Login
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // 2. If logged in but WRONG EMAIL -> Kick them out
    const userEmail = user.email;
    const adminEmails = ['mkposcosunday@gmail.com', 'factsportlive@gmail.com'];

    if (!userEmail || !adminEmails.includes(userEmail)) {
      // Redirect unauthorized users to the dashboard
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}