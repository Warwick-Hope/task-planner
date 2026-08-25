import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — must call getUser() not getSession()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const isAuthRoute = pathname === '/login' || pathname === '/signup'
  const isCallbackRoute = pathname.startsWith('/api/auth/callback')
  // The invite landing page has to render for a logged-out visitor — that is
  // the entire point of the emailed token link. It reads nothing but the
  // get_invitation_by_token RPC, and accepting still requires a session.
  const isInviteRoute = pathname.startsWith('/invite/')

  // Redirect unauthenticated users away from protected routes
  if (!user && !isAuthRoute && !isCallbackRoute && !isInviteRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages
  if (user && isAuthRoute) {
    const next = request.nextUrl.searchParams.get('next')
    // Only same-origin paths — never bounce to an attacker-supplied host
    const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
    const url = request.nextUrl.clone()
    url.pathname = safeNext
    url.search = ''
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files, images, and the three files
     * the PWA install depends on.
     *
     * manifest.webmanifest, sw.js and offline.html must all answer for a visitor
     * with no session: Chrome fetches the manifest and the worker script outside
     * any page context, and a 307 to /login is neither a manifest nor JavaScript,
     * so the install silently fails. They expose nothing — static files with no
     * user data on them.
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
