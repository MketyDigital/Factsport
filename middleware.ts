import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // -----------------------------------------------------------------
  // 🔒 PART 1: STAGING ENVIRONMENT LOCK (Vercel Only)
  // -----------------------------------------------------------------
  const hostname = request.headers.get('host') || '';

  // Only lock the site if the domain contains "vercel.app"
  if (hostname.includes('vercel.app')) {
    const basicAuth = request.headers.get('authorization');

    if (basicAuth) {
      const authValue = basicAuth.split(' ')[1];
      // Decodes "username:password"
      const [user, pwd] = atob(authValue).split(':');

      // 👇 CREDENTIALS FOR YOUR DEV SITE
      // Username is 'admin', Password is '<Do Not Access>'
      if (user === 'admin' && pwd === '<Do Not Access>') {
        // Password correct? Allow code to proceed to Part 2
      } else {
        return new NextResponse('Auth Required.', {
          status: 401,
          headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' },
        });
      }
    } else {
      // No password provided? Show login prompt
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
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
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
  if (request.nextUrl.pathname.startsWith('/admin')) {
    
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