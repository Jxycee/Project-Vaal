# Login Page Redesign — Design

**Status:** Direction approved by Jaycee 2026-09-12, iterated live against a mockup canvas
([Project Vaal Login Redesign](https://claude.ai/code/artifact/2c5c4ab7-9627-4927-9752-69ea3f40e948)).

## Context

First page in a full site-wide visual pass (sequence: Login → Dashboard/Home → Prices → Tree →
Campaign → Builds → Wiki). The site's problem isn't its identity — dark charcoal/gold oklch
tokens, Cinzel headings, ornament dividers, the atmospheric noise+vignette body background, the
custom cursor — all of that stays. The problem is componentry: plain boxed cards, native
`<select>`s, flat `<ul>` rows read as dated. This pass is visual/UX only; no functional change.

Competitor research (mobalytics.gg, maxroll.gg, poe.ninja, poe2scout.com, linear.app) confirmed
the negative pattern to avoid — poe.ninja/poe2scout's dense ad-cluttered flat lists — and supplied
one positive structural reference adopted here: Linear's login screen, which uses no hard-bordered
card at all, just a centered stack of full-width pill buttons on an atmospheric background with
generous whitespace.

## Decision

**Split-hero layout.** Desktop: two columns — left is a brand/atmosphere panel (emblem, wordmark,
ornament divider, tagline), right is the sign-in form. Mobile: single column, form only, brand
reduced to a small header (emblem + wordmark) above the form — same functionality, no separate
mobile design, just the brand panel dropped since there's no room for it.

The current login page (email/password fields + "Continue with Google" + link to signup, in
[login/page.tsx](../../../src/app/(auth)/login/page.tsx)) keeps its exact functionality. This is a
reskin of that same form.

## Left panel — brand / atmosphere

Not a foreign image — an extension of the app's own global background. The current body
background ([globals.css](../../../src/app/globals.css) `body::before`) is a layered
noise-tile + radial-vignette + photo already present on every page including the login page today.
The left panel deepens that same treatment (same three layers, tuned darker) rather than
introducing new imagery — an earlier draft used the dashboard's `vaal-ember-bed` flame asset here
and it read as a random fire pit out of context; dropped.

Centered content: the Project Vaal emblem, "Project Vaal" in Cinzel, the ornament divider
(`/ornaments/divider.png`), the uppercase tagline ("Path of Exile 2 · Console Companion"), and one
line of supporting copy about what the app does.

### Pulse glow

A soft radial gold glow sits behind the emblem and pulses slowly — not a static glow, not a
hard-edged shape. Implementation notes:

- The glow lives in a wrapper `div` sized exactly to the emblem's own box, with the glow
  absolutely centered *inside that wrapper* (not positioned by a fixed `top: X%` against the whole
  panel). This is deliberate: a percentage-based position against the panel drifted out of sync
  with the emblem's actual center the moment the emblem's size changed during mockup iteration.
  Anchoring to the emblem's own box means the glow tracks it regardless of size.
- Animated via a CSS `@keyframes` pulse on `opacity` between a trough and peak value, using CSS
  custom properties (`--glow-min` / `--glow-max`) set inline so the two values are easy to tune in
  one place.
- **Shipped defaults (not user-configurable in production):** 4.5s cycle, peak opacity 0.25, trough
  ≈0.11 (peak × 0.45). These came from an interactive tweak dialed in live on the mockup canvas —
  the range-slider tweaks were a design-time tool only, not a feature; ship the chosen values as
  fixed CSS.
- Respect `prefers-reduced-motion: reduce` — freeze the glow at its peak (or a fixed mid) opacity,
  no animation, for users who've asked for reduced motion. Not present in the mockup (the canvas
  format doesn't model it); add it in implementation.

## Right panel — sign-in form

No hard-bordered card (deviates from the current page's `rounded-xl border bg-card p-6` box) —
just a centered stack directly on the page background, generous vertical gap between groups
(heading block, Google button, divider, fields, submit, footer link).

- **Buttons: full pill (`rounded-full`), not the app's default `rounded-md`.** This is a deliberate,
  *scoped* deviation for the auth pages only — borrowed from Linear's treatment — not a global
  restyle of the shared `Button` component. Implement as local classNames on this page (and
  signup, when it gets the same pass), not a change to `button.tsx`'s default variants.
- **Inputs:** soft filled background (`bg-input/25`-equivalent) with a hairline border, no separate
  card chrome around the pair — border brightens to the primary ring color on focus, matching the
  existing focus-ring convention already used elsewhere in the app.
- Google OAuth button keeps the same inline multi-color "G" glyph already in the codebase — no
  change there.
- Copy, field order, and the "Don't have an account? Create one" link are unchanged from the
  current page.

## Mobile

Single column, full width, safe padding. Brand block shrinks to emblem (small) + wordmark inline
above the form — same glow treatment scaled down, same pill buttons and field styling as desktop.
Nothing is hidden or cut for functionality; the only thing dropped from desktop is the large brand
art panel, since there's no room for a second column.

## Non-goals (this spec)

- Signup page — shares the same visual vocabulary but gets its own pass when we reach it in
  sequence; not built here.
- Any change to auth logic, redirect handling, Supabase calls, or the Google OAuth flow — visual
  only.
- A global `Button`/`Input` restyle — the pill/borderless treatment is scoped to the auth pages.
