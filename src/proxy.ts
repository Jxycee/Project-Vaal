import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Protected path prefixes.
// These correspond to routes inside src/app/(dashboard)/ which share the
// authenticated dashboard shell layout (sidebar, bottom nav).
//
// NOTE on route structure:
//   /builds          → PUBLIC   (build finder, anonymous planner, shared viewer)
//   /wiki            → PUBLIC
//   /league          → PUBLIC
//   /login /signup   → PUBLIC
//   /dashboard       → PROTECTED
//   /characters      → PROTECTED
//   /settings        → PROTECTED
//   /tree            → PROTECTED (account required — §12; lives at (dashboard)/tree, URL stays /tree)
// ---------------------------------------------------------------------------
const PROTECTED_PREFIXES = ['/dashboard', '/characters', '/settings', '/tree']

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export async function proxy(request: NextRequest) {
  // We must return a response and keep cookies in sync.
  // Follow the pattern from @supabase/ssr docs exactly — do not reorder.
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
          // Write cookies to the outgoing request first so downstream
          // server components can read the refreshed session.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Always call getUser() here, even on public routes.
  // This refreshes the session token if it has expired. Skipping this
  // will cause users to appear logged out after token expiry.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Redirect unauthenticated users away from protected routes
  if (isProtectedPath(request.nextUrl.pathname) && !user) {
    const redirectUrl = new URL('/login', request.url)
    // Preserve the intended destination so we can redirect back after login
    redirectUrl.searchParams.set(
      'redirect',
      request.nextUrl.pathname + request.nextUrl.search
    )
    return NextResponse.redirect(redirectUrl)
  }

  // Redirect authenticated users away from auth pages
  // (prevents flicker on /login when already signed in)
  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     *   - Next.js internals (_next/static, _next/image)
     *   - Static files (favicon.ico and common image extensions)
     *
     * We must match API routes so session cookies are refreshed there too.
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}