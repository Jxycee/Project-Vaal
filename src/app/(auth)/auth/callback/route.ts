// =============================================================================
// /auth/callback — server-side auth callback (route handler).
//
// Handles the two ways auth flows return into the app:
//   1. Google OAuth + PKCE email links → ?code=...           → exchangeCodeForSession
//   2. Email confirmation / magic links → ?token_hash=&type= → verifyOtp
//
// On success we forward to the ?redirect= path (sanitised to same-origin),
// otherwise back to /login with an error flag.
//
// NOTE: the plan (§7) originally listed this as page.tsx, but @supabase/ssr's
// code-exchange flow needs a route handler. §7 has been updated to match.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// Same-origin relative paths only — never absolute or protocol-relative
// ("//host"). Guards against open redirects.
function safeRedirect(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw
  return '/dashboard'
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = safeRedirect(searchParams.get('redirect') ?? searchParams.get('next'))

  const supabase = await createClient()

  let ok = false
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    ok = !error
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    ok = !error
  }

  if (!ok) {
    return NextResponse.redirect(`${origin}/login?error=auth`)
  }

  // Behind Vercel's load balancer the request origin can be the internal host,
  // so prefer the forwarded host in production.
  const forwardedHost = request.headers.get('x-forwarded-host')
  const isLocal = process.env.NODE_ENV === 'development'

  if (!isLocal && forwardedHost) {
    return NextResponse.redirect(`https://${forwardedHost}${next}`)
  }
  return NextResponse.redirect(`${origin}${next}`)
}