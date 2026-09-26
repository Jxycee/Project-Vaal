import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { DEFAULT_REDIRECT, safeRedirect } from '@/lib/safeRedirect'

// ---------------------------------------------------------------------------
// Protected path prefixes.
// These correspond to routes inside src/app/(dashboard)/ which share the
// authenticated dashboard shell layout (sidebar, bottom nav).
//
// NOTE on route structure:
//   /builds          → PROTECTED (build finder, own builds, shared build viewer — Task 4:
//                      "no user that is signed out should even be able to see a public
//                      build" is a product decision, not an oversight. See the 2026-09-22
//                      Task 4 plan's AMENDMENT section.)
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
const PROTECTED_PREFIXES = ['/dashboard', '/characters', '/settings', '/tree', '/campaign', '/wiki', '/data/wiki/', '/builds']

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

// supabase.auth.getUser() round-trips to Supabase's auth server on EVERY
// request this middleware matches (i.e. every page navigation) — there is
// no timeout on that call by default, so a stalled connection (observed on
// mobile: extreme lag switching pages, sometimes appearing to not load at
// all) leaves the request hanging indefinitely with zero user-visible
// feedback, since nothing downstream (not even a page's own loading.tsx)
// gets a chance to render until this resolves.
//
// On timeout, this resolves as if there is no session — the same safe,
// fail-closed outcome as an actually-expired/invalid session: an
// unauthenticated result on a protected path still redirects to /login
// (never silently grants access), and on a public path the request simply
// proceeds treated as signed-out. A real session is not revoked by this —
// only THIS request's redirect decision falls back conservatively; the next
// request gets a fresh, un-timed-out attempt. 4s is a starting point: long
// enough that a normal slow mobile connection shouldn't spuriously bounce a
// signed-in user to /login, short enough that a truly stalled connection
// gives up and lets the browser show something instead of hanging forever.
const AUTH_TIMEOUT_MS = 4000

// Only the `user` shape is used at any call site (the SDK's own success/
// error discriminated union isn't preserved through the timeout branch —
// there is no real error/session to report on a timeout, just "no user").
function withAuthTimeout<U>(
  promise: Promise<{ data: { user: U } }>,
  timedOutUser: U
): Promise<{ data: { user: U } }> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ data: { user: timedOutUser } }), AUTH_TIMEOUT_MS)
    promise.then(
      (result) => {
        clearTimeout(timer)
        resolve(result)
      },
      () => {
        // A rejected getUser() call is the same fail-closed outcome as a
        // timeout — resolve immediately rather than waiting out the timer.
        clearTimeout(timer)
        resolve({ data: { user: timedOutUser } })
      }
    )
  })
}

function isAuthPage(pathname: string): boolean {
  return pathname === '/login' || pathname === '/signup'
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
  } = await withAuthTimeout(supabase.auth.getUser(), null)

  // Project Vaal: propagate the email this call just validated to Server
  // Components via a request header, so AppShell (src/components/layout/
  // app-shell.tsx, rendered on every page) can read it synchronously
  // instead of paying for a SECOND supabase.auth.getUser() round-trip on
  // every single navigation just to display it. Must use the
  // `request: { headers }` form of NextResponse.next — confirmed against
  // node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
  // ("Setting headers"): that form makes the header available upstream to
  // Server Components' headers(); passing `headers` directly instead (no
  // `request` wrapper) would instead send it to the BROWSER as a visible
  // response header, leaking the user's email client-side for no reason —
  // never do that with this header.
  //
  // This does not move any trust boundary: the value is always exactly
  // what THIS call just validated (or '' when there is no session) — a
  // client cannot inject or override it, since `requestHeaders` is built
  // fresh from `request.headers` and this one key is unconditionally
  // overwritten below, on every request this middleware matches.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-vaal-user-email', user?.email ?? '')
  const responseWithUserHeader = NextResponse.next({ request: { headers: requestHeaders } })
  // `responseWithUserHeader` is a distinct NextResponse instance and starts
  // with none of the cookies `supabaseResponse` may have accumulated above
  // (set during setAll, e.g. a refreshed session token) — carry them over
  // rather than dropping them.
  for (const cookie of supabaseResponse.cookies.getAll()) {
    responseWithUserHeader.cookies.set(cookie)
  }
  supabaseResponse = responseWithUserHeader

  // Redirect unauthenticated users away from protected routes
  if (isProtectedPath(request.nextUrl.pathname) && !user) {
    const redirectUrl = new URL('/login', request.url)
    // Preserve the intended destination so we can redirect back after login
    redirectUrl.searchParams.set(
      'redirect',
      request.nextUrl.pathname + request.nextUrl.search
    )
    return uncacheable(NextResponse.redirect(redirectUrl))
  }

  // Redirect authenticated users away from auth pages
  // (prevents flicker on /login when already signed in).
  //
  // Honour the `?redirect=` the unauthenticated branch above preserved: if
  // one request transiently sees no user and bounces to /login, and the next
  // hop sees the user again, sending them to /dashboard would strand them
  // there and silently drop the page they asked for (observed in e2e,
  // 2026-09-23). The target is attacker-controllable, so it goes through the
  // shared validator — never `new URL()` a raw param here, or `/\evil.com`
  // resolves off-origin. A target that is itself /login or /signup falls
  // back to the default rather than bouncing back into this branch.
  if (user && isAuthPage(request.nextUrl.pathname)) {
    let target = safeRedirect(request.nextUrl.searchParams.get('redirect'))
    if (isAuthPage(new URL(target, request.url).pathname)) target = DEFAULT_REDIRECT
    return uncacheable(NextResponse.redirect(new URL(target, request.url)))
  }

  return supabaseResponse
}

// A redirect here depends on who is asking, so no browser may keep it.
// next.config.ts sets Cache-Control on /data/wiki/** by PATH, and Next applies
// those header rules before this proxy runs, so without this override the
// 307 to /login inherited `private, max-age=3600`: after a session expired on
// a wiki page, the browser replayed that redirect for an hour — signing back
// in only made it loop (cached 307 -> /login -> back -> cached 307) until the
// fetch gave up. Headers set here win over next.config's
// (node_modules/next/dist/server/lib/router-utils/resolve-routes.js, the
// middleware-headers merge). Confirmed on production 2026-09-26.
function uncacheable(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-store')
  return response
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
