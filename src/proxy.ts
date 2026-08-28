import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Protected path prefixes.
// These correspond to routes inside src/app/(dashboard)/ which share the
// authenticated dashboard shell layout (sidebar, bottom nav).
//
// NOTE on route structure:
//   /builds          → PUBLIC   (build finder, anonymous planner, shared viewer)
//   /league          → PUBLIC
//   /login /signup   → PUBLIC
//   /dashboard       → PROTECTED
//   /characters      → PROTECTED
//   /settings        → PROTECTED
//   /tree            → PROTECTED (account required — §12; lives at (dashboard)/tree, URL stays /tree)
//   /campaign        → PROTECTED (progress saves per-user; lives at (dashboard)/campaign, URL stays /campaign)
//   /wiki            → PROTECTED (account required — D1; lives at src/app/wiki, own layout/shell)
//   /data/wiki/      → PROTECTED (static wiki data assets — item/skill/mod indexes, detail JSON,
//                      icons — must be gated the same as /wiki itself; see matcher comment below)
//
// NOTE on /data/**: /data/tree/** (vendored passive-tree sprite atlases) is
// deliberately excluded from ever reaching this middleware at all — see the
// matcher config's `data/tree/` exclusion — so it is NOT listed here even
// though /tree the page is protected. Every other /data/** path (currently
// just /data/wiki/**) DOES reach this middleware and must be listed below.
//
// DEFENSE-IN-DEPTH NOTE: this is proxy-level (middleware) protection only.
// Next's own docs (node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md)
// are explicit that Proxy checks are "optimistic" and should not be treated
// as a full session-management or authorization solution — a middleware
// matcher can be misconfigured or bypassed by a routing edge case (see the
// percent-encoding bypass this file was patched for — 2026-08-21 security
// review) with nothing behind it to catch the miss. `AppShell`
// (src/components/layout/app-shell.tsx) reads the user server-side but does
// not itself redirect unauthenticated requests away — it assumes middleware
// already handled that. A genuinely defense-in-depth fix would serve
// /data/wiki/** through a Route Handler that calls its own
// `supabase.auth.getUser()` instead of raw static file serving, so gating
// does not depend solely on this regex being correct. That is a bigger
// change, deliberately deferred — do not assume this matcher is airtight.
// ---------------------------------------------------------------------------
const PROTECTED_PREFIXES = ['/dashboard', '/characters', '/settings', '/tree', '/campaign', '/wiki', '/data/wiki/']

// `request.nextUrl.pathname` is WHATWG-parsed and NOT percent-decoded, so a
// request to e.g. `/data/%77iki/...` (percent-encoded "wiki") does not
// literally start with `/data/wiki/` even though Next's static file resolver
// decodes it and serves the real file underneath `/data/wiki/...` — a
// confirmed auth bypass (2026-08-21 security review) if this only checked the
// raw pathname. Check both the raw and (single-level) decoded form; malformed
// percent-encoding falls back to the raw check rather than throwing.
//
// This check is case-sensitive (`/data/WiKi/...` would not match). Not a
// bypass: Next's static file resolver looks paths up by exact string in a
// case-sensitive Set built from the real on-disk filenames (confirmed on
// this Next version), so a differently-cased request just 404s rather than
// finding the real file some other, unprotected way. Lowercasing here would
// only widen what gets redirected, never narrow it — not worth the cost.
function isProtectedPath(pathname: string): boolean {
  const candidates = [pathname]
  try {
    const decoded = decodeURIComponent(pathname)
    if (decoded !== pathname) candidates.push(decoded)
  } catch {
    // malformed percent-encoding — raw check only
  }
  return candidates.some((p) => PROTECTED_PREFIXES.some((prefix) => p.startsWith(prefix)))
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

  // Redirect authenticated users away from auth pages, and off the
  // signed-out marketing home page, straight to the dashboard.
  // (prevents flicker on /login when already signed in; also fixes the
  // home page — src/app/page.tsx has no auth check of its own and always
  // rendered a generic "Sign in" button regardless of session state, so a
  // returning signed-in user had to click through a dead-end detour every
  // time before landing back on /login's own already-working redirect)
  if (
    user &&
    (request.nextUrl.pathname === '/' ||
      request.nextUrl.pathname === '/login' ||
      request.nextUrl.pathname === '/signup')
  ) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     *   - Next.js internals (_next/static, _next/image)
     *   - Static files outside /data/ (favicon.ico and common image extensions
     *     — app icons, OG images, etc. See the nested `(?!data/)` below for
     *     why this is scoped away from /data/.)
     *   - /data/tree/** — vendored tree JSON + sprite atlases (public/data/tree/...).
     *     These are large, cacheable, unauthenticated static assets fetched
     *     client-side by the tree viewer; without this exclusion every one
     *     of those fetches (data.json + ~6 atlas manifests per page load)
     *     paid for a Supabase auth.getUser() round-trip for no reason, since
     *     .json isn't covered by the extension rule (and .webp atlas images
     *     are covered by the extension rule, but this prefix rule makes the
     *     tree exclusion explicit/self-documenting rather than incidental).
     *
     *     This exclusion is scoped to `data/tree/` specifically (NOT a blanket
     *     `data/` exclusion) so that /data/wiki/** — search indexes, detail
     *     JSON, icons for the gated /wiki pages — still hits this middleware
     *     and gets checked against PROTECTED_PREFIXES below. Do not widen this
     *     back to `data/` without re-gating /data/wiki/** some other way.
     *
     *   - Image-extension files, EXCEPT under /data/: the extension rule below
     *     has a nested `(?!data/)` guard so it only exempts image files
     *     outside of /data/ (e.g. /favicon-32x32.png, /apple-touch-icon.png).
     *     Without that guard, /data/wiki/<version>/icons/**\/*.png (wiki item
     *     and skill icons) would bypass the middleware via this rule even
     *     though the `data/tree/` prefix rule above doesn't cover them — that
     *     would silently defeat the point of gating /data/wiki/** at all.
     *
     *   - That same extension rule additionally requires the path contains no
     *     `%` at all (`(?!.*%)`). This regex runs against the raw, NOT
     *     percent-decoded pathname, so `/%64ata/wiki/.../icon.png` (percent-
     *     encoded "data") would literally NOT start with "data/" and could
     *     otherwise slip past the `(?!data/)` guard above, letting a gated
     *     wiki icon bypass the middleware entirely via this exclusion. Any
     *     percent-encoded path is instead forced through to the middleware,
     *     where `isProtectedPath` below decodes it before checking — that is
     *     the one place in this file allowed to make the real decision.
     *
     * We must match API routes so session cookies are refreshed there too.
     */
    '/((?!_next/static|_next/image|favicon\\.ico|data/tree/|(?!data/)(?!.*%).*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
