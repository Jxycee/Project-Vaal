'use client'

// =============================================================================
// /login — sign in with email/password or Google.
//
// Auth is Supabase-native (plan §14): email/password + Google. After a
// successful sign-in we send the user to the ?redirect= path the middleware
// preserved, or /dashboard.
//
// Google uses the OAuth code-exchange flow: signInWithOAuth() bounces to
// Google, which returns to /auth/callback (route handler) to set the session.
// The Google button only works once the provider is enabled in Supabase
// (Authentication -> Providers -> Google). Email/password works immediately.
// =============================================================================

import { Suspense, useMemo, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Standard multi-colour Google "G". Inlined so there's no icon dependency
// (lucide doesn't ship brand logos).
function GoogleIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  )
}

// Emblem + its pulsing glow, sized once per call site (the desktop hero
// panel and the mobile header use different sizes). The glow div is
// centered *on this wrapper*, which is sized to exactly the emblem's own
// box — so the glow tracks the emblem regardless of size, instead of a
// fixed top:%/left:% guess against a bigger container.
function EmblemWithGlow({
  size,
  glowSize,
  glowBlur,
  priority = false,
}: {
  size: number
  glowSize: number
  glowBlur: number
  priority?: boolean
}) {
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <div
        aria-hidden="true"
        className="auth-glow absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: glowSize,
          height: glowSize,
          filter: `blur(${glowBlur}px)`,
          background: 'radial-gradient(circle, var(--primary), transparent 70%)',
        }}
      />
      <Image
        src="/brand/vaal-emblem.png"
        alt="Project Vaal"
        width={size}
        height={size}
        priority={priority}
        sizes={`${size}px`}
        className="relative z-10"
        style={{
          filter: 'drop-shadow(0 0 28px color-mix(in oklab, var(--primary) 30%, transparent))',
        }}
      />
    </div>
  )
}

// Only allow same-origin relative redirects — never an absolute or
// protocol-relative ("//host") URL. Guards against open-redirect attacks.
function safeRedirect(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw
  return '/dashboard'
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = safeRedirect(searchParams.get('redirect'))

  const supabase = useMemo(() => createClient(), [])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const busy = loading || googleLoading

  async function handleEmailSignIn(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Re-run server components + middleware so they pick up the new session,
    // then go to the intended destination.
    router.replace(redirectTo)
    router.refresh()
  }

  async function handleGoogleSignIn() {
    setError(null)
    setGoogleLoading(true)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Supabase returns here after Google; the route handler then exchanges
        // the code and forwards to `redirect`.
        redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`,
      },
    })

    // On success the browser is already navigating to Google — nothing else to do.
    if (error) {
      setError(error.message)
      setGoogleLoading(false)
    }
  }

  return (
    <main className="flex min-h-[100dvh] flex-col md:flex-row">
      {/* Desktop brand / atmosphere panel. Same three-layer background as
          the app's global body::before (noise tile + radial vignette +
          app-bg photo), just deepened — an extension of the app's own
          atmosphere, not a new image. Hidden below md; the mobile header
          below replaces it there. */}
      <div
        className="relative hidden overflow-hidden md:flex md:w-[56%] md:flex-col md:items-center md:justify-center"
        style={{
          backgroundImage:
            "url('/background/noise.png'), radial-gradient(130% 90% at 50% 30%, rgba(28,24,18,0.25), rgba(9,8,6,0.9) 78%), url('/background/app-bg.webp')",
          backgroundRepeat: 'repeat, no-repeat, no-repeat',
          backgroundSize: '128px 128px, cover, cover',
          backgroundPosition: 'top left, center, center',
        }}
      >
        <div className="flex flex-col items-center gap-4 px-16 text-center">
          <EmblemWithGlow size={250} glowSize={620} glowBlur={20} priority />
          <h1 className="font-heading text-4xl font-semibold tracking-tight">Project Vaal</h1>
          <Image
            src="/ornaments/divider.png"
            alt=""
            width={1096}
            height={182}
            sizes="220px"
            className="h-auto w-56 opacity-80"
          />
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Path of Exile 2 · Console Companion
          </p>
          <p className="mt-4 max-w-[22rem] text-sm leading-7 text-muted-foreground/90">
            Price checks, passive-tree planning, campaign tracking, and build tools. Built to
            better support players on console.
          </p>
        </div>
      </div>

      {/* Hairline between panels, desktop only */}
      <div className="hidden w-px bg-gradient-to-b from-transparent via-primary/25 to-transparent md:block" />

      {/* Mobile brand header — replaces the desktop panel below md */}
      <div className="flex flex-col items-center gap-2 pb-2 pt-10 md:hidden">
        <EmblemWithGlow size={64} glowSize={160} glowBlur={12} priority />
        <h1 className="font-heading text-lg font-semibold tracking-tight">Project Vaal</h1>
      </div>

      {/* Sign-in form — no hard-bordered card, just a centered stack */}
      <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8">
        <div className="flex w-full max-w-sm flex-col gap-7">
          <div className="flex flex-col gap-2">
            <h2 className="font-heading text-2xl font-semibold tracking-tight">Sign in</h2>
            <p className="text-sm text-muted-foreground">
              Welcome back. Sign in to save builds and track your campaign.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-12 w-full gap-2 rounded-full"
            onClick={handleGoogleSignIn}
            disabled={busy}
          >
            <GoogleIcon />
            {googleLoading ? 'Connecting…' : 'Continue with Google'}
          </Button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmailSignIn} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={busy}
                className="h-12"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={busy}
                className="h-12"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" className="h-12 w-full rounded-full" disabled={busy}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-medium text-foreground underline underline-offset-4">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}

export default function LoginPage() {
  // useSearchParams() requires a Suspense boundary in the App Router.
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[100dvh] items-center justify-center px-4">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  )
}