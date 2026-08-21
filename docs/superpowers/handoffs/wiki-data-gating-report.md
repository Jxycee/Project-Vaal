# Wiki data gating + browse-page client-fetch cleanup

Date: 2026-08-21
Branch/worktree: `feature/wiki-m1` (`C:\Dev\project-vaal\.claude\worktrees\feature+wiki-m1`)

## Context

`/wiki` was already gated behind auth via `src/proxy.ts`'s `PROTECTED_PREFIXES`, but the
underlying static data at `public/data/wiki/<version>/**` (search indexes, per-entity detail
JSON, icon PNGs) was reachable unauthenticated, because the middleware `matcher` had a blanket
`data/` exclusion originally added for the passive tree's public sprite assets
(`public/data/tree/**`).

Product decision (explicit): wiki data must be behind the auth gate; `/wiki` must not be usable
signed-out. The tree's data (`public/data/tree/**`) must stay public exactly as today — separate,
already-settled, unrelated decision.

## Task 1 — Gate `public/data/wiki/**` in `src/proxy.ts`

### Changes

1. **Matcher regex** narrowed the `data/` exclusion to `data/tree/`, so everything else under
   `/data/` (in practice, just `/data/wiki/**`) now reaches the middleware.
2. **A second, non-obvious fix was required**: the matcher's separate image-extension exclusion
   (`.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$`) applies globally by path suffix, independent of the
   `data/` vs `data/tree/` prefix rule. `public/data/wiki/<version>/icons/{items,skills}/*.png`
   exists and would still have bypassed the middleware via this rule alone, silently defeating the
   gating for wiki icons even after fixing the prefix. Fixed by nesting a nested negative lookahead
   `(?!data/)` inside that alternative, so the extension-based exclusion no longer applies to
   anything under `/data/` (it still applies everywhere else — favicons, app icons, OG images,
   etc. — exactly as before). Verified this is real: `public/data/wiki/2026-08-21/icons/items/`
   and `.../icons/skills/` contain PNG files today.
3. Added `/data/wiki` to `PROTECTED_PREFIXES`.
4. Rewrote both comment blocks (the `PROTECTED_PREFIXES` header and the `matcher` inline comment)
   to describe the new behavior, including an explicit warning not to widen the `data/tree/`
   exclusion back to a blanket `data/` exclusion without re-gating `/data/wiki/**` some other way.

Final matcher pattern:
```
/((?!_next/static|_next/image|favicon\.ico|data/tree/|(?!data/).*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)
```

### Manual regex verification

Before editing, and again after, tested the pattern against sample paths with a standalone Node
script (not committed — ran from the scratchpad, deleted after). Confirmed for the final pattern:

| Path | Reaches middleware? | Expected | Result |
|---|---|---|---|
| `/data/tree/foo.webp` | no | no | OK |
| `/data/tree/skills.json` | no | no | OK |
| `/data/wiki/2026-08-21/item-index.json` | yes | yes | OK |
| `/data/wiki/2026-08-21/icons/items/ab-aeterno.png` | yes | yes | OK (the icon-PNG gap above) |
| `/data/wiki/2026-08-21/items/some-slug.json` | yes | yes | OK |
| `/dashboard` | yes | yes | OK |
| `/favicon.ico` | no | no | OK |
| `/_next/static/chunk.js` | no | no | OK |
| `/_next/image?x=1` | no | no | OK |
| `/logo.png` (root-level app asset) | no | no | OK |
| `/icons/apple-touch-icon.png` (non-data image asset) | no | no | OK |
| `/some/page.svg` | no | no | OK |
| `/wiki` | yes | yes | OK |

("Reaches middleware" for a protected prefix means it then gets the redirect-to-`/login` check;
for `/data/tree/**` and other excluded paths it means no auth round-trip at all, same as today.)

I did not spin up a dev server in this sandboxed environment to click through an actual
unauthenticated browser request to `/data/wiki/.../item-index.json` — the regex-level
verification above, plus `isProtectedPath('/data/wiki/2026-08-21/item-index.json')` being a
straightforward `startsWith` check against the now-updated `PROTECTED_PREFIXES` array, is what
stands in for that. This is a gap worth a real click-through (or an e2e test) before merging to
main if one isn't already planned.

## Task 2 — Un-defer the browse-page client-fetch cleanup

### Changes

- **New**: `src/lib/wiki/fetchIndex.ts` — `fetchWikiIndex(kind)`, a plain async function (no React)
  that fetches `/data/wiki/<WIKI_DATA_VERSION>/<kind>-index.json`, validates the response shape at
  the boundary with the existing `isWikiSearchEntry` guard, and throws a typed `WikiIndexFetchError`
  for three distinct failure modes: HTTP error status, a non-JSON response (the case where the
  fetch reaches an unauthenticated context and `src/proxy.ts` redirects to `/login` — `fetch`
  follows redirects by default and resolves 200 with an HTML body, so this is detected via
  `content-type` rather than `res.ok`), and a malformed/invalid JSON body.
- **New**: `src/components/wiki/WikiBrowse.tsx` — a client component wrapper (`'use client'`) that
  calls `fetchWikiIndex` in a `useEffect` (mirroring the existing `useTreeResources`/
  `useClassCentreSprites` pattern in `src/lib/tree/resources.ts` — same `cancelled` flag on
  cleanup, same shape of `.then/.catch`), tracks a small `LoadState` union (`loading` / `error` /
  `ready`), and renders the existing `WikiSearch` once data is ready. Loading and error states
  reuse the token-styled treatment already established: `text-muted-foreground` for the loading
  message (mirrors `(dashboard)/tree/page.tsx`'s "Loading passive tree…" placeholder), and
  `border-destructive/50` / `text-destructive` for the error message.
- **Changed**: `src/app/wiki/items/page.tsx`, `.../skills/page.tsx`, `.../mods/page.tsx` — reduced
  to thin Server Components (heading + `<WikiBrowse kind="..." basePath="..." entityLabel="..." />`).
  Removed the `readFile`/`JSON.parse`/`notFound()` server-side data loading entirely.
- **Unchanged**: `src/components/wiki/WikiSearch.tsx` — kept its existing `entries` prop contract
  and the memoized-Fuse-index fix from earlier this session. `filterEntries`'s signature and
  behavior are untouched, so `WikiSearch.test.ts` passes with zero modifications, as requested.

### Why a separate `WikiBrowse` wrapper rather than folding the fetch into `WikiSearch` itself

Kept `WikiSearch` a pure "given entries, filter/render them" component. This preserves its tested
contract exactly, keeps the fetch/loading/error concern in one small file that's easy to reason
about independently, and matches the instruction to prefer a wrapper when it avoids touching an
already-fixed, already-tested component.

### Test coverage — and the gap

This repo's `vitest.config.ts` runs with `environment: 'node'` and there is no `jsdom`/
`happy-dom`/`@testing-library/react` dependency installed, and the `include` glob only matches
`src/**/*.test.ts` / `scripts/**/*.test.ts` (not `.tsx`). I did not add new dependencies to work
around this (out of scope for this change and not asked for).

Given that constraint, I split the new client behavior so the part that can be meaningfully
unit-tested without a DOM — the fetch call, URL construction, response validation, and all three
error paths — lives in the plain `fetchWikiIndex` function, and wrote
`src/lib/wiki/fetchIndex.test.ts` covering it with a mocked `global.fetch`
(`vi.stubGlobal('fetch', ...)`):

- correct URL built per `kind`, entries resolved on a valid response
- `WikiIndexFetchError` with the HTTP status on a non-ok response
- `WikiIndexFetchError` "Session expired — please sign in again." on a non-JSON (redirect-to-login)
  response
- `WikiIndexFetchError` "Malformed \<kind\> index response" when `entries` is missing
- same, when an individual entry fails `isWikiSearchEntry` shape validation

**Gap**: `WikiBrowse.tsx`'s actual rendered output (the loading skeleton text, the error banner
markup, the loading→ready transition, the `cancelled` cleanup-guard behavior on unmount/kind
change) is not covered by an automated test, because there is no DOM test environment in this
repo to render it in. I verified it by reading the code against the `useTreeResources` precedent
it mirrors, by `tsc --noEmit` (types check), and by `next build` succeeding (Next's build compiles
and type-checks all client components, though it doesn't execute them). If component-level
coverage is wanted, the next step would be adding `jsdom` + `@testing-library/react` as dev
dependencies and widening the vitest `include` glob to `.tsx` — flagging this as a
follow-up rather than doing it unprompted, since it's a testing-infrastructure decision beyond
this task's scope.

### Build output note

`/wiki/items`, `/wiki/skills`, `/wiki/mods` still show as `ƒ` (Dynamic) in the `next build`
route table after this change, not `○` (Static) — worth noting since the whole point was to stop
doing per-request work server-side. This is because `src/components/layout/app-shell.tsx` (the
shell every one of these pages renders through) does its own `supabase.auth.getUser()` server-side
call, which forces the route dynamic regardless of what the page itself does. The per-request
`readFile` + `JSON.parse` of a multi-hundred-KB-to-megabyte file is gone either way — that was
the actual goal — but full static prerendering of these routes was never reachable without also
touching `AppShell`, which is out of scope here.

## Verification

- `npm run type-check` — clean.
- `npm run lint` — clean. (One `react-hooks/set-state-in-effect` error surfaced during
  development from an unnecessary `setState({status:'loading'})` call at the top of the effect
  body in `WikiBrowse.tsx`; removed it — the initial `useState` value is already `loading`, and
  `kind` is a literal per page instance so it never actually changes on re-render, matching the
  same non-resetting pattern `useTreeResources` uses for its `version` dep.)
- `npm run build` — succeeds. Route table confirms `/wiki/items|skills|mods` compile; see the
  dynamic-vs-static note above.
- `npx vitest run` — **77/77 passed**, across 9 test files, including the 5 new tests in
  `fetchIndex.test.ts` and the 4 existing `WikiSearch.test.ts` tests unmodified.
- Matcher regex: verified with a standalone Node script (not committed) — see table above.
- No dev server was run in this sandboxed environment to click through an actual unauthenticated
  browser request to `/wiki` or `/data/wiki/...`; see the gap noted under Task 1.

## Files touched

- `src/proxy.ts` (matcher regex + `PROTECTED_PREFIXES` + comments)
- `src/lib/wiki/fetchIndex.ts` (new)
- `src/lib/wiki/fetchIndex.test.ts` (new)
- `src/components/wiki/WikiBrowse.tsx` (new)
- `src/app/wiki/items/page.tsx`
- `src/app/wiki/skills/page.tsx`
- `src/app/wiki/mods/page.tsx`
- `src/components/wiki/WikiSearch.tsx` — unchanged
- `src/components/wiki/WikiSearch.test.ts` — unchanged, still passes

---

## Addendum — fixes from the 2026-08-21 independent security review

A fresh reviewer, tracing the compiled matcher regex against the actual `.next` build artifact
rather than just source, found two real Critical bypasses plus several Important gaps in the work
above. All are fixed below; findings and fixes are paired 1:1.

### Critical 1 — Cache-Control still marked gated data publicly cacheable

**Finding**: `next.config.ts`'s `/data/wiki/:path*` header rule was `public, max-age=3600,
s-maxage=86400, stale-while-revalidate=604800`, unchanged from when the path was public. With no
`Vary: Cookie`, both the 200 JSON (authed) and 307-to-`/login` (anon) response share the same
cache key — a shared/CDN cache could serve a cached 200 to an anonymous visitor, or a cached 307 to
a signed-in one, and `stale-while-revalidate=604800` meant a signed-out browser could keep serving
gated content for up to a week.

**Fix**: `next.config.ts` — changed the rule's `Cache-Control` value to
`private, max-age=3600, stale-while-revalidate=604800` (dropped `public` and `s-maxage` entirely).
Rewrote the surrounding comment to explain why `private`/no-`s-maxage` is required as long as this
path is auth-gated, and to warn against reverting it.

**Verified against the compiled artifact** (not just source), per the reviewer's own method:
```
$ node -e "const d = require('./.next/routes-manifest.json'); ..."
{ source: '/data/wiki/:path*',
  headers: [{ key: 'Cache-Control', value: 'private, max-age=3600, stale-while-revalidate=604800' }] }
```

### Critical 2 — percent-encoded paths bypassed `isProtectedPath`

**Finding**: `request.nextUrl.pathname` is WHATWG-parsed, not percent-decoded. A request to
`/data/%77iki/2026-08-21/item-index.json` passed the matcher, then `isProtectedPath` (a raw
`startsWith` check) returned `false` since the raw pathname doesn't literally start with
`/data/wiki` — but Next's static file resolver decodes the path and serves the real file at
`/data/wiki/...`. Confirmed real, not theoretical.

**Fix**: `src/proxy.ts` — `isProtectedPath` now checks both the raw pathname and its
(single-level) `decodeURIComponent`'d form, falling back to the raw check only if decoding throws
(malformed percent-encoding):

```ts
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
```

**Traced the reviewer's exact case by hand and with a script.** For
`/data/%77iki/2026-08-21/item-index.json`: `decodeURIComponent` turns `%77` into `w`, giving
`/data/wiki/2026-08-21/item-index.json`, which `startsWith('/data/wiki/')` → `true` → now
correctly redirected to `/login` when unauthenticated. Verified in the compiled bundle too —
`.next/server/middleware.js` contains both the `/data/wiki/` prefix string and `decodeURIComponent`
calls, confirming the fix reached the build, not just the source file.

**An additional bypass found while fixing Critical 2, not in the reviewer's original report**:
the matcher's own extension-based exclusion (`(?!data/).*\.(?:svg|png|...)$`, added in the base
gating commit specifically to stop wiki icon PNGs from slipping past via extension) also runs
against the raw, undecoded pathname. A request percent-encoding the `data` segment itself — e.g.
`/%64ata/wiki/2026-08-21/icons/items/ab-aeterno.png` — does not literally start with `data/`, so
the `(?!data/)` guard would pass, the extension rule would fire, and the request would be excluded
from the middleware **entirely** — meaning it would never even reach `isProtectedPath`, so the
Critical 2 fix above would not have helped. Closed this by adding a `(?!.*%)` guard to the same
extension alternative: **any** percent-encoded path is now forced through the middleware rather
than trying to reason about which specific segment might be encoded, deferring the real decision to
`isProtectedPath`'s decode-aware check. Final matcher:

```
/((?!_next/static|_next/image|favicon\.ico|data/tree/|(?!data/)(?!.*%).*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)
```

Re-verified all matcher and `isProtectedPath` cases (including this extra one) with a standalone
Node script — 20 cases, all passing — and confirmed the compiled matcher string in
`.next/server/middleware.js` matches this pattern exactly (not committed to the tree; ran from the
scratchpad, deleted after).

I did not further chase double-encoding (e.g. `%2564ata` — a literal `%64ata` after one decode
pass, still not `data`). Reasoning: `isProtectedPath` does exactly one decode pass, matching what
appears to be standard single-pass decoding in Next's own static file resolver per the reviewer's
trace — if the resolver only decodes once too, a double-encoded path would 404 there as well
(nothing to actually serve), so there's no exploit surface left to close. I did not verify this
symmetry against Next's resolver source directly; flagging as an assumption rather than a
confirmed fact.

### Important 4 — service worker runtime-caching gated wiki data past logout

**Finding**: `src/sw.ts` used `defaultCache` from `@serwist/next/worker` unmodified, whose
production rule set includes generic matchers — `.(?:jpg|jpeg|gif|png|svg|ico|webp)$` (
`StaleWhileRevalidate`) and `.(?:json|xml|csv)$` (`NetworkFirst`) — that also match
`/data/wiki/**`. `StaleWhileRevalidate` in particular would serve a cached wiki icon straight from
Cache Storage with no auth check at all on a repeat visit, and any entry cached this way survives
sign-out (Cache Storage isn't cleared by a Supabase sign-out) — a real problem on a shared device.

**Fix**: `src/sw.ts` — added an explicit `NetworkOnly` rule for `/data/wiki/` (same-origin only),
placed first in the `runtimeCaching` array ahead of `...defaultCache`, since Serwist/Workbox routes
match in array order and the first match wins:

```ts
runtimeCaching: [
  {
    matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/data/wiki/'),
    handler: new NetworkOnly(),
  },
  ...defaultCache,
],
```

Verified `next build` regenerates `public/sw.js` with this rule present (`grep -o "data/wiki"
public/sw.js` matches).

### Important 5 — coarse redirect detection + UI dead-end

**Finding**: the non-JSON-content-type heuristic for detecting a redirect-to-login could mislabel
an unrelated non-JSON 200 (captive portal, CDN error page, SW fallback) as "session expired."
Separately, `WikiBrowse.tsx` rendered that message as a dead-end banner with nothing to act on it.

**Fix**:
- `src/lib/wiki/fetchIndex.ts` — added a new `WikiSessionExpiredError extends WikiIndexFetchError`,
  thrown only when there's a direct signal: `res.redirected && new URL(res.url).pathname ===
  '/login'`. The content-type check is now a separate, generic fallback (`WikiIndexFetchError`,
  message "Unexpected response... (not JSON)"), no longer conflated with session expiry.
- `src/components/wiki/WikiBrowse.tsx` — on `WikiSessionExpiredError` specifically, calls
  `router.replace(`/login?redirect=${encodeURIComponent(window.location.pathname)}`)` instead of
  rendering an error state — matching the exact `?redirect=` convention already used by
  `src/proxy.ts` and `src/app/(auth)/login/page.tsx`'s `safeRedirect`. While the redirect is in
  flight the component stays in its `loading` state (no flash of a dead-end banner first).
- `src/lib/wiki/fetchIndex.test.ts` — added cases for: redirected-to-`/login` throws
  `WikiSessionExpiredError`; redirected-to-somewhere-else does NOT throw session-expired (resolves
  normally); non-ok/non-redirected throws plain `WikiIndexFetchError`, explicitly asserted
  `not.toBeInstanceOf(WikiSessionExpiredError)`; non-JSON/non-redirected throws plain
  `WikiIndexFetchError` with the new "Unexpected response" message, also asserted not
  session-expired.

### Important 3 — proxy-only auth is not defense-in-depth (documented, not rewritten)

Per instructions, did not attempt the full fix (serving `/data/wiki/**` through a Route Handler
with its own `getUser()` instead of raw static file serving) — that's a bigger architecture change.
Added an explicit comment block in `src/proxy.ts` next to `PROTECTED_PREFIXES` citing
`node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md` (confirmed it does say Proxy
checks are "optimistic" and should not be treated as a full authorization solution), naming that
`AppShell` reads the user but never itself redirects, and stating plainly that a future reader
should not assume this matcher is airtight.

**Judgment call on whether the two Critical fixes make this urgent**: no — I don't think the
Critical fixes change the calculus here. Both Criticals were bugs in the *existing* proxy-only
design (a stale cache header, an encoding edge case), not evidence that proxy-only middleware is
structurally insufficient for this app; once fixed, the matcher + `isProtectedPath` are, as far as
I traced, correct for every case tested including the encoding class of bug. The proxy-only
architecture is a real trade-off (a future routing change could reintroduce a gap like this one)
but not one this fix round created or worsened. Flagging it as documented, not escalating it.

### Minor items

- `next.config.ts` — `outputFileTracingExcludes['/wiki/**']` now also excludes
  `./public/data/wiki/**/*-index.json`. Verified safe: `grep -rn "index.json" src` (excluding this
  feature's own new client-fetch code) shows nothing server-side reads these files anymore since
  Task 2 moved that to a client-side fetch — only `loadDetail()` (per-slug detail JSON) and
  `loadAllSlugs()` (a `readdir`, not a read of the index file) remain in `src/lib/wiki/load.ts`.
  Updated the stale comment that used to say "The index files stay traced: the browse pages
  genuinely do read them." Per the existing comment's own instruction, this should still be gated
  by checking the `files` count in `.next/server/app/wiki/*/[slug]/page.js.nft.json` on a real
  Linux/Vercel build before relying on it — the existing PLATFORM NOTE in that file already
  explains why a local Windows build can't verify this (the excludes are inert on Windows).
- `src/proxy.ts` — fixed the missing trailing newline (confirmed via `tail -c` + `xxd` that the
  file now ends `}\n`).
- `PROTECTED_PREFIXES` — changed `'/data/wiki'` to `'/data/wiki/'` (trailing slash), so a
  hypothetical future `/data/wikifoo` sibling path can't accidentally prefix-match. Verified with
  the same test script: `/data/wikifoo/x.json` → not protected.
- `entityLabel` prop on `WikiBrowse` — removed. Replaced the three call sites' redundant prop with
  an internal `Record<WikiEntryKind, string>` lookup inside the component, so the label can't drift
  out of sync with `kind`.

### Re-verification

- `npm run type-check` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeds. `.next/routes-manifest.json` and `.next/server/middleware.js`
  inspected directly (not just source) to confirm the Critical 1 and Critical 2 fixes reached the
  compiled output, matching the reviewer's own verification method. `public/sw.js` confirmed to
  contain the new `/data/wiki/` `NetworkOnly` rule.
- `npx vitest run` — **79/79 passed** (9 test files) — 2 new cases added to `fetchIndex.test.ts`
  for the Important 5 fix, all prior tests still passing including `WikiSearch.test.ts` unmodified.
- Matcher/`isProtectedPath` re-verified with an expanded standalone Node script (20 cases: the
  original set, the reviewer's exact reported Critical 2 case, and the additional encoded-`data`-
  segment case found while fixing it) — all passing. Not committed; ran from the scratchpad.
- Still not done, same gap as before: no dev server was run in this sandbox to click through an
  actual browser request. The `.next` build-artifact inspection above is the closest available
  substitute for the two Critical fixes specifically.
- The reviewer's suggested integration test (307-for-anonymous on `/data/wiki/**`,
  200-for-anonymous on `/data/tree/**`) was not built. This repo has no existing integration/route-
  testing harness (no dev-server-driven test runner, no `supertest`-style setup, nothing under
  `scripts/` or `src/**/*.test.ts` that spins up the app) — building one from scratch was
  explicitly out of scope for this round. Residual: worth adding before/soon after merge, since (per
  the reviewer) it would catch a regression here far better than the unit-level coverage this
  change has.

### Status of this addendum

All five findings (2 Critical, 2 Important actionable, 1 Important documented-not-rewritten) plus
all four Minor items are addressed. The one deliberately-deferred item is the integration test
noted above — flagged, not built, for the reason given.

---

## Addendum 2 — round-2 independent review (real build, compiled routes-manifest.json)

A second independent reviewer, running an actual `npm run build` and tracing the compiled
`.next/routes-manifest.json` against Next's own routing source, confirmed Critical 2 and
Important 3/4/5 from Addendum 1 are genuinely fixed — including the self-reported third bypass
(the encoded-`data`-segment case), which they determined isn't exploitable on this Next version,
but agreed the `(?!.*%)` guard is correct hardening worth keeping regardless. One real residual
remained on Critical 1, plus two Low/Info items.

### Critical 1 residual — the sibling non-wiki `/data/**` rule was still a denylist

**Finding**: Addendum 1 fixed the `/data/wiki/:path*` rule's `Cache-Control` value, but didn't
touch its sibling rule, which was still `source: '/data/:filename((?!wiki/).*)'` →
`public, max-age=31536000, immutable`. Header-rule matching happens on the raw, non-percent-decoded
pathname (same class of bug as Critical 2, just in a different Next subsystem —
`headers()`/`fsChecker.headers` instead of the proxy matcher). So
`/data/%77iki/2026-08-21/item-index.json` fails the `(?!wiki/)` negative lookahead on the raw
string (it doesn't literally contain `wiki/`), falls through to this denylist rule instead, and
gets served with a full year of `public, immutable` caching — worse than the original bug, and
worse than what Addendum 1 left in place for the primary rule. Because `fsChecker.headers` runs
before middleware in Next's request pipeline, even the anonymous 307-to-`/login` response for that
same encoded path would carry this header.

**Fix**: `next.config.ts` — changed the sibling rule from a denylist to an allowlist scoped to
`/data/tree/:path*` (the one thing it's actually meant to cover, matching how the `src/proxy.ts`
matcher already scopes its own tree exclusion the same way). Any path that isn't a literal,
undecoded `/data/tree/...` — including every percent-encoded spelling of a wiki path — now falls
through to Next's own conservative default instead of matching either header rule. Rewrote the
surrounding comment block to explain why, name the specific bug, and warn against reverting to a
denylist.

**Re-verified against the actual compiled artifact**, per the reviewer's instruction (re-running a
real `npm run build`, not trusting source):

```
$ node -e "const d = require('./.next/routes-manifest.json'); for (const h of d.headers) if (h.source.includes('data')) console.log(h);"
{ source: '/data/wiki/:path*', headers: [{ key: 'Cache-Control', value: 'private, max-age=3600, stale-while-revalidate=604800' }],
  regex: '^/data/wiki(?:/((?:[^/]+?)(?:/(?:[^/]+?))*))?(?:/)?$' }
{ source: '/data/tree/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
  regex: '^/data/tree(?:/((?:[^/]+?)(?:/(?:[^/]+?))*))?(?:/)?$' }
```

No denylist regex remains in the compiled output. Tested the two compiled regexes directly against
the reviewer's exact case:

| path | matches `/data/wiki/:path*`? | matches `/data/tree/:path*`? |
|---|---|---|
| `/data/wiki/2026-08-21/item-index.json` | true | false |
| `/data/tree/0.5.2/skills.json` | false | true |
| `/data/%77iki/2026-08-21/item-index.json` | **false** | **false** — matches neither, falls through to Next's default (the fix) |
| `/data/wikifoo/x.json` | false | false — sibling path doesn't spuriously match either |

### Low/Info 1 — service worker doesn't purge caches from already-installed SWs

**Finding**: the `/data/wiki/` `NetworkOnly` rule from Addendum 1 prevents *future* caching, but an
already-installed service worker may have already cached gated bytes under `defaultCache`'s generic
image/JSON buckets before the fix shipped — "survives sign-out" persists for those installs until
they pick up the new SW.

**Fix** (small and safe enough to do, not just note): `src/sw.ts` — added a one-time `activate`
handler that walks every named cache `defaultCache` defines and deletes any entry whose URL is
under `/data/wiki/`. Cache names are read off each rule's `handler.cacheName` at runtime (via a
`RouteHandlerObject & { cacheName: string }` type guard) rather than hardcoded as literal strings
like `"static-image-assets"` / `"static-data-assets"`, so this stays correct if `@serwist/next`
ever renames its internal caches. Registered as a second, independent `activate` listener alongside
Serwist's own (`self.addEventListener('activate', ...)` — multiple listeners on the same event are
fine; each gets its own `event.waitUntil`). A no-op after the first activate on an already-clean
install.

Hit one type error along the way: `RuntimeCaching['handler']` is typed as
`RouteHandlerCallback | RouteHandlerObject`, so `cacheName` isn't statically visible on it even
though every real `defaultCache` entry is a `Strategy` instance that has one at runtime. Fixed with
an explicit type guard (`handler is RouteHandlerObject & { cacheName: string }`) rather than an
unsafe cast — first attempt used a bare `{cacheName: string}` predicate, which TS's `filter`
overload silently declined to narrow with (predicate result type didn't extend the array's element
type), caught by `type-check`, not by inspection.

Verified in the compiled output: `public/sw.js` contains `/data/wiki/` twice (the runtime-caching
matcher and the cleanup filter) and `"activate"` twice (Serwist's own + the new one).

### Low/Info 2 — `isProtectedPath` is case-sensitive

**Finding**: `/data/WiKi/...` wouldn't match `/data/wiki/`. Not exploitable — Next's static file
lookup is an exact-string match against real on-disk filenames — but worth a comment saying so
explicitly rather than leaving it looking like an oversight.

**Fix**: added a one-line comment on `isProtectedPath` in `src/proxy.ts` explaining why
case-sensitivity here is a non-issue (a differently-cased request just 404s, since it can't find a
real file that way) and why lowercasing would only ever widen protection, never narrow it, so isn't
worth the added complexity.

### Re-verification (round 2)

- `npm run type-check` — clean (after fixing the `cacheName` type-narrowing issue above).
- `npm run lint` — clean.
- `npm run build` — succeeds. `.next/routes-manifest.json` inspected directly and confirmed above —
  this is the specific artifact the reviewer flagged as the thing to re-check for real, not source.
  `public/sw.js` regenerated and confirmed to contain the new activate-time cleanup logic.
- `npx vitest run` — **79/79 passed** (9 test files), unchanged from Addendum 1 — this round's
  fixes are all in `next.config.ts` and `src/sw.ts`/`src/proxy.ts` comments+guards, none of which
  have unit-testable surface beyond what was already covered (the service worker activate handler,
  like the rest of `src/sw.ts`, isn't executable in this repo's DOM-less `vitest` environment — same
  gap already noted for `WikiBrowse.tsx`'s rendered output).

### Status of this addendum

The one real residual from round 2 (Critical 1's sibling denylist rule) is fixed and verified
against the compiled artifact. Both Low/Info items are fixed rather than just noted, since both
turned out to be small, safe, self-contained changes. No new residuals identified in this round
beyond what Addendum 1 already flagged (no integration test harness in this repo; the small
double-encoding assumption in the Critical 2 discussion; no dev-server click-through in this
sandbox).
