# Login Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin `/login` into the approved split-hero design (brand/atmosphere panel + pill-button form, no hard-bordered card) with zero change to auth behavior.

**Architecture:** Pure presentation change to one client component (`LoginForm` inside `src/app/(auth)/login/page.tsx`) plus a small reusable `EmblemWithGlow` sub-component local to that file, and one new CSS utility (`.auth-glow` + its keyframes) added to `globals.css` so the pulse animation isn't duplicated inline. No new routes, no new dependencies, no schema/auth changes.

**Tech Stack:** Next.js App Router, React 19, Tailwind v4 (CSS-first config, oklch tokens already defined in `globals.css`), shadcn `Button`/`Input`/`Label` components, `next/image`.

**Spec:** [docs/superpowers/specs/2026-09-12-login-page-redesign-design.md](../specs/2026-09-12-login-page-redesign-design.md)

## Global Constraints

- Zero functional change: email/password sign-in, Google OAuth, `safeRedirect`, error handling, and the `/signup` link all keep their exact current behavior and copy (except the one tagline typo fix below). Do not touch `handleEmailSignIn`, `handleGoogleSignIn`, or `safeRedirect`.
- Buttons on this page use `rounded-full` (pill) via a `className` override on the existing shadcn `Button` — **not** a change to `buttonVariants` in `src/components/ui/button.tsx`. That file is not touched by this plan.
- The left panel's background reuses the exact three-layer treatment already in `globals.css`'s `body::before` (noise tile + radial vignette + `app-bg.webp`), just deepened — do not introduce a new background image asset.
- Glow animation shipped values (not user-configurable): 4.5s cycle, peak opacity 0.25, trough 0.1125. Must respect `prefers-reduced-motion: reduce` (freeze at peak opacity, no animation).
- Tagline copy: "Price checks, passive-tree planning, campaign tracking, and build tools. Built to better support players on console." (period, not the mockup's stray `//`).
- This repo has no component-rendering test harness (`vitest` covers pure-function `lib/` modules only — see `src/lib/prices/format.test.ts` for the pattern; there is no `@testing-library/react` or jsdom config). This is a pure-JSX/CSS change with no new pure logic, so there is nothing to unit-test. Verification is `npm run lint`, `npm run type-check`, and a manual browser pass (desktop width, mobile width, reduced-motion) per task — not fabricated component tests.

---

### Task 1: Add the `.auth-glow` pulse utility to `globals.css`

**Files:**
- Modify: `src/app/globals.css` (append inside the existing `@layer components { ... }` block, after the `.vaal-icon` rule)

**Interfaces:**
- Produces: a CSS class `auth-glow` that Task 2 applies to a `div` — no JS API, pure CSS. Consumer sets the element's `width`/`height`/`background`/`filter` itself; `auth-glow` only owns the animation.

- [ ] **Step 1: Add the keyframes and class**

Open `src/app/globals.css` and find the existing block:

```css
/* Tintable icon: masks a cream PNG so currentColor controls its colour. */
@layer components {
  .vaal-icon {
    display: inline-block;
    flex-shrink: 0;
    width: 1.25rem;
    height: 1.25rem;
    background-color: currentColor;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-position: center;
    mask-position: center;
    -webkit-mask-size: contain;
    mask-size: contain;
  }
}
```

Add a second rule inside that same `@layer components` block (after `.vaal-icon`'s closing brace, still inside the layer):

```css
  /* Auth pages: slow ambient pulse behind the brand emblem. 4.5s / 0.25
     peak / 0.1125 trough came from live-tuning the design mockup — see
     docs/superpowers/specs/2026-09-12-login-page-redesign-design.md.
     The element using this class supplies its own size/background/filter;
     this class only owns the animation. */
  @keyframes auth-glow-pulse {
    0%,
    100% {
      opacity: 0.1125;
    }
    50% {
      opacity: 0.25;
    }
  }
  .auth-glow {
    opacity: 0.25;
    animation: auth-glow-pulse 4.5s ease-in-out infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    .auth-glow {
      animation: none;
      opacity: 0.25;
    }
  }
```

The full block should now read:

```css
@layer components {
  .vaal-icon {
    display: inline-block;
    flex-shrink: 0;
    width: 1.25rem;
    height: 1.25rem;
    background-color: currentColor;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-position: center;
    mask-position: center;
    -webkit-mask-size: contain;
    mask-size: contain;
  }

  /* Auth pages: slow ambient pulse behind the brand emblem. 4.5s / 0.25
     peak / 0.1125 trough came from live-tuning the design mockup — see
     docs/superpowers/specs/2026-09-12-login-page-redesign-design.md.
     The element using this class supplies its own size/background/filter;
     this class only owns the animation. */
  @keyframes auth-glow-pulse {
    0%,
    100% {
      opacity: 0.1125;
    }
    50% {
      opacity: 0.25;
    }
  }
  .auth-glow {
    opacity: 0.25;
    animation: auth-glow-pulse 4.5s ease-in-out infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    .auth-glow {
      animation: none;
      opacity: 0.25;
    }
  }
}
```

- [ ] **Step 2: Type-check and lint (no logic changed, just confirming nothing broke)**

Run: `npm run lint && npm run type-check`
Expected: both pass with no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(auth): add auth-glow pulse utility for the login redesign"
```

---

### Task 2: Rewrite `/login`'s layout into the split-hero design

**Files:**
- Modify: `src/app/(auth)/login/page.tsx` (only the JSX returned by `LoginForm`, plus one new local component; every hook, handler, and the `LoginPage`/`Suspense` wrapper stay exactly as they are today)

**Interfaces:**
- Consumes: `auth-glow` class from Task 1; existing `GoogleIcon()`, `safeRedirect()`, `Button`, `Input`, `Label` from `@/components/ui/*`; adds `Image` from `next/image` (not currently imported in this file).
- Produces: no new exports — `LoginForm`/`LoginPage` keep their current signatures. `EmblemWithGlow` is a private helper in this file, not exported (signup gets its own pass later and can extract it then if still wanted).

- [ ] **Step 1: Add the `next/image` import**

At the top of `src/app/(auth)/login/page.tsx`, add:

```tsx
import Image from 'next/image'
```

right after the existing `import Link from 'next/link'` line.

- [ ] **Step 2: Add the `EmblemWithGlow` helper**

Insert this new function directly after the existing `GoogleIcon()` function (before `safeRedirect`):

```tsx
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
```

- [ ] **Step 3: Replace `LoginForm`'s returned JSX**

Find the `return (...)` inside `function LoginForm()` — it currently starts with:

```tsx
  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
```

and ends with:

```tsx
      </div>
    </main>
  )
}
```

Replace that entire `return (...)` block with:

```tsx
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
```

Do not change anything above this `return` (the `useRouter`/`useSearchParams`/`useState` calls, `handleEmailSignIn`, `handleGoogleSignIn`) or the `LoginPage` default export below it.

- [ ] **Step 4: Type-check and lint**

Run: `npm run lint && npm run type-check`
Expected: both pass. Fix any prop/type errors before continuing (e.g. if `EmblemWithGlow`'s props don't match how it's called).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(auth)/login/page.tsx"
git commit -m "feat(auth): split-hero redesign for the login page"
```

---

### Task 3: Manual browser verification

No new pure logic exists to unit-test (see Global Constraints) — this task is the real verification step for this plan and must not be skipped.

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server and open `/login`**

Use the project's dev server preview (`npm run dev`, then open `/login` in the browser tool). Confirm no console errors and no failed network requests for `/brand/vaal-emblem.png`, `/ornaments/divider.png`, `/background/noise.png`, `/background/app-bg.webp`.

- [ ] **Step 2: Desktop width — visual check**

At a desktop viewport (≥1280px wide): confirm the two-column split-hero renders, the glow is visibly pulsing and centered on the emblem, the hairline divider sits between panels, and both buttons render as full pills. Take a screenshot.

- [ ] **Step 3: Mobile width — visual check**

Resize to a mobile viewport (390×844 or similar): confirm the desktop brand panel is hidden, the small mobile brand header (emblem + wordmark) shows above the form, the form is full-width with no horizontal scroll, and both buttons remain full pills at a comfortable tap height. Take a screenshot.

- [ ] **Step 4: Reduced motion**

Emulate `prefers-reduced-motion: reduce` (browser tool's `colorScheme`/emulation, or DevTools rendering panel) and confirm the glow stops animating and holds at a fixed visible opacity instead of disappearing or flashing.

- [ ] **Step 5: Functional smoke test**

Confirm tab order reaches Google button → Email → Password → Sign in → Create one link, in that order, and that typing in Email/Password updates the fields (existing `handleEmailSignIn`/`handleGoogleSignIn` logic is untouched by this plan, so this is a sanity check, not new coverage).

- [ ] **Step 6: Run the full check suite**

Run: `npm run lint && npm run type-check && npm run test`
Expected: all pass (no existing tests exercise this page, so `test` passing just confirms nothing else broke).

- [ ] **Step 7: Final commit (if Step 2-5 caught anything to fix)**

If any visual/behavioral issue was found and fixed during verification:

```bash
git add "src/app/(auth)/login/page.tsx" src/app/globals.css
git commit -m "fix(auth): address login redesign verification findings"
```

If nothing needed fixing, skip this step — Task 1 and Task 2's commits already cover the change.
