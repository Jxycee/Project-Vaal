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
