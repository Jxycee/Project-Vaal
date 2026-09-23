# Task 4 — Sharing Implementation Plan

**Date:** 2026-09-22
**Branch:** `worktree-server-migration` (worktree at `C:/Dev/project-vaal-wt/server-migration`)
**Spec:** `docs/superpowers/specs/2026-09-16-build-planner-design.md` § "Task 4 — Sharing" — **amended by this plan**, in six places. See "Where the spec is wrong".
**Precedent:** `2026-09-22-task3-gems.md`, `2026-09-20-gear-design.md`, `2026-09-20-jewels-design.md`, `2026-09-20-competitor-build-planner-recon.md`.

**Goal:** A saved build can be made `unlisted` or `public` by its owner, opened by anyone at `/builds/<shareToken>` as a **static read-only page**, attributed to its author, counted, tagged, bookmarked, and found from a Public tab on `/builds`. No second tree/gear/gem renderer where reuse is real; no reuse of the editor's sheets where reuse is a liability.

---

## AMENDMENT — 2026-09-22, decided by the user. Read this before anything below.

The user was asked how shared builds should show item icons, given `/data/wiki/` is auth-gated. Their answer changes the architecture:

> "The entire build page should be under auth protection. No user that is signed out should even be able to see a public build, it should redirect them to login before being able to view the build page completely."

And, asked specifically about the finder: **protect all of `/builds`.**

### What this overrides

1. **"Blocking decision 1" (the icon 307) is void. Do not implement it.** Do not touch `src/proxy.ts`'s matcher regex, `isProtectedPath`'s internals, or the `/data/wiki/` gating in any way. Every viewer of a shared build is now signed in, so the icons resolve exactly as they do in the editor. The 2026-08-21 security fix that closed the icon bypass stays fully intact — exempting icons would have partially reversed it, and that is now unnecessary rather than merely risky.

2. **Add `'/builds'` to `PROTECTED_PREFIXES`** (no trailing slash, so it covers `/builds` and every child). That is the only `proxy.ts` change in this task.

3. **Update the route map comment at the top of `proxy.ts`.** It currently reads `/builds → PUBLIC (build finder, anonymous planner, shared viewer)`. That is now wrong in all three respects.

4. **`src/app/(dashboard)/layout.tsx`'s comment — "Proxy already gates this group" — becomes true again.** The plan's note about fixing it as stale no longer applies; `/builds` was the one member of that group it was wrong about.

5. **`/builds`'s signed-out branch is now unreachable.** The Server Component's `if (!user)` block rendering "Sign in to see your saved builds" can go, along with its `/login` link. Keep a cheap guard if you like, but it is defence in depth, not a rendered path.

6. **An existing e2e test now asserts the opposite of the product decision and must be changed** — `e2e/draft-and-auth.spec.ts`, `'/builds is public and invites sign-in rather than redirecting'`. Rewrite it to assert `/builds` **redirects to `/login`** when signed out, and add the same for `/builds/<any-token>`. This is the one protected test in the suite that changes; it changes because the requirement changed, not to make anything pass.

### What is unaffected

- **Still use `get_build_by_share_token`.** Authentication is not authorisation: the `builds` SELECT policy exposes `visibility = 'public'` only, so a plain select still returns nothing for an `unlisted` build even for a signed-in caller. The RPC is still the only path that works. Blocking decision 2 stands unchanged.
- **The finder must still carry `.eq('visibility','public')`.** The owner policy is permissive and ORs in, so a signed-in viewer's bare select would list their own private builds under a "Public" tab. Now *more* important, since every finder visitor is signed in.
- `build_tags`' SELECT policy still omits `unlisted`, so tags still vanish on an unlisted shared build. Unchanged.
- Route shape, view counting, attribution, read-only rendering recommendation: all unchanged.

### Consequence worth stating

A "public" build is now public *to signed-in users*, not to the web. Link-sharing to someone without an account sends them to `/login` first. That is the requested behaviour. It also means the shared view is not a search-engine discovery surface — if that is ever wanted, it is a deliberate future reversal, not an oversight.

---

## Verified against real code/data/database (this session)

Database claims come from live introspection of project `mjxadehorflhncendqiy` (`pg_proc`, `pg_policies`, `pg_indexes`, `pg_constraint`, `pg_trigger`, `information_schema.columns`), never from `supabase/schema.sql`.

| Claim | How verified |
|---|---|
| `get_build_by_share_token(p_token text)` is `LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public`, body is exactly `SELECT * FROM public.builds WHERE share_token = p_token AND visibility IN ('public','unlisted')` | `pg_get_functiondef` on the live function |
| `increment_build_view_count(p_build_id uuid)` is plpgsql SECURITY DEFINER, body is a bare `UPDATE builds SET view_count = view_count + 1 WHERE id = p_build_id AND visibility IN ('public','unlisted')` — **no dedupe of any kind** | same |
| `get_build_author_name(p_build_id uuid)` joins `builds → user_profiles` and returns `display_name`. **It does NOT check `visibility`** | same |
| All three are `EXECUTE`-able by `anon` (and `authenticated`) | `pg_proc.proacl` + `has_function_privilege('anon', …, 'EXECUTE')`; both also called live under `set local role anon` without a permission error |
| `builds` RLS: `"Owners can do everything with their builds"` = `ALL`, role `public`, `auth.uid() = user_id`; `"Public builds are readable by anyone"` = `SELECT`, role `public`, `visibility = 'public'`. **Permissive, so they OR together.** | `pg_policies` |
| `build_tags` SELECT policy is `own OR builds.visibility = 'public'` — **`unlisted` is not included** | `pg_policies` |
| `build_tags` has INSERT and DELETE policies (both ownership-gated) and **no UPDATE policy** | `pg_policies` |
| `user_profiles` SELECT policy is `auth.uid() = id` only — an author's `display_name` is unreachable by join from any other account | `pg_policies` |
| `builds.visibility` is `text NOT NULL DEFAULT 'private'`, CHECK `IN ('private','unlisted','public')` | `information_schema.columns` + `pg_constraint` |
| `builds.share_token` is `text NULL` with a UNIQUE constraint and a partial index `WHERE share_token IS NOT NULL`; **no database default** | same |
| `builds_visibility_idx` is `(visibility, class, league) WHERE visibility = 'public'` | `pg_indexes` |
| `builds_main_skill_idx` is `(main_skill) WHERE visibility = 'public'` | `pg_indexes` |
| `build_tags_tag_idx` is `(tag)`; PK is `(build_id, tag)`; CHECK is `length(tag) BETWEEN 1 AND 32` | `pg_indexes` + `pg_constraint` |
| **No index on `builds.updated_at`, `created_at` or `view_count`** — the whole index list for `builds` is: pkey, `user_id`, `share_token` (×2), `visibility`, `main_skill`, `game_version`, `forked_from` | `pg_indexes`, full listing |
| `build_bookmarks` PK `(user_id, build_id)`, FKs to `user_profiles(id)` and `builds(id)` both `ON DELETE CASCADE`, indexes on both columns; RLS is a single `ALL` policy `auth.uid() = user_id` with **no visibility check on the build** | `pg_indexes`, `pg_constraint`, `pg_policies` |
| `set_builds_updated_at BEFORE UPDATE … handle_updated_at()` exists, so `updated_at` maintains itself on any update | `pg_trigger` |
| `src/types/database.ts` types all three RPCs; `get_build_by_share_token` is typed `Returns: {...}[]` with `SetofOptions.isSetofReturn: true` | read the file, lines 428–466 |
| `PROTECTED_PREFIXES` = `['/dashboard','/characters','/settings','/tree','/campaign','/wiki','/data/wiki/']`; `/builds` and `/api` are absent; `/data/tree/` is excluded at the matcher | `src/proxy.ts` |
| The matcher's image-extension exclusion carries a nested `(?!data/)` **specifically** so `/data/wiki/**/icons/**.png` cannot bypass the gate, plus a `(?!.*%)` guard for percent-encoded spellings | `src/proxy.ts` matcher comment + regex |
| Stored icon URLs sit under that prefix, e.g. `"iconUrl":"/data/wiki/2026-08-25/icons/skills/herald-of-ash.png"` | `public/data/wiki/2026-08-25/skills/herald-of-ash.json` |
| `GearItem = {slug, name, category, isUnique, iconUrl}` and is the stored shape for gear, jewels **and** gems | `src/lib/build/gearSlots.ts:145`, `gemState.ts` |
| `/prices` is a public route that renders game item/currency icons to signed-out visitors with a plain `<img src={row.icon_url}>` | `src/app/prices/page.tsx` header, `PricesClient.tsx:50-55, 232-234` |
| `next.config.ts`'s `outputFileTracingExcludes` excludes `icons/**` **only for `/wiki/**` routes**; the comment records the real numbers (27,771 files / 211MB, cut to ~47MB by the icon downscale) | `next.config.ts` |
| `/data/wiki/:path*` carries `Cache-Control: private, max-age=3600, stale-while-revalidate=604800`, deliberately `private` and deliberately an allowlist rather than a denylist | `next.config.ts` headers block |
| `share_token` is minted exactly once, `nanoid()` in the **insert** path of `POST /api/builds`; no code path ever updates it | `src/app/api/builds/route.ts`, `grep` for `share_token` |
| `nanoid@5.1.11` — default size 21, alphabet `A-Za-z0-9_-`, entirely URL-safe | `node_modules/nanoid/package.json` + the library's documented default |
| `POST /api/builds`'s update path always writes `name/class/ascendancy/level/league/passive_state/game_version` in full (`shared`), conditionally the three jsonb/skill fields | `route.ts:104-140` |
| `/builds` is `src/app/(dashboard)/builds/page.tsx` and already handles signed-out itself; its header comment states `/builds` is deliberately public "because the public build finder lands here later" | `builds/page.tsx` |
| `AppShell` reads the `x-vaal-user-email` header, which proxy sets to `''` when signed out, normalised to `null` — no auth call, no redirect | `src/components/layout/app-shell.tsx`, `src/proxy.ts` |
| `NAV` already has `{ href: '/builds', label: 'Builds', live: true }` | `src/components/layout/shell-chrome.tsx:20` |
| `summarizeJewels(raw: GggTreeJson, allocated, jewels)` requires the full tree export as its first argument | `src/lib/build/jewelState.ts:51` |
| `PassiveTree` has no read-only mode: it owns `classId`/`ascendancyId`/`mode`/`main`/`ascendancyNodes` and renders `TreeControls` (class + ascendancy pickers, paint-mode toggle, `ResetButton`) and `onNodeClick` | `src/components/tree/PassiveTree.tsx:65-95, 514-552` |
| `TreeEditor` fetches `/data/tree/0.5.2/data.json` (5.1MB) on mount, unconditionally | `TreeEditor.tsx` |
| `GearSheet`/`JewelsSheet`/`GemsSheet` are `createPortal(document.body)` `fixed inset-0 z-40` overlays, and each mounts `ItemPickerSheet` at `z-50`; the portal exists solely to escape the tree canvas's `position: fixed` stacking context | `GearSheet.tsx` header comment + body; same pattern in the other two |
| `ItemPickerSheet` fetches `GET /api/wiki/items`, which 401s without a session | `ItemPickerSheet.tsx`, `api/wiki/items/route.ts` |
| vitest is `environment: 'node'`, `include: ['src/**/*.test.ts','scripts/**/*.test.ts']` — **`.ts` only, no DOM** | `vitest.config.ts` |
| Playwright: 5 spec files, **17 `test()` declarations**; `mobile` runs everything except `desktop-layout.spec.ts` (15), `desktop` runs only that file (2) → 17 executions plus the `setup` project. `workers: 1`, `fullyParallel: false`, `timeout: 180_000`, `reuseExistingServer` off by default | `playwright.config.ts`, `grep -c 'test('` over `e2e/*.spec.ts` |
| A signed-out e2e context is an existing pattern: `test.use({ storageState: { cookies: [], origins: [] } })` | `e2e/draft-and-auth.spec.ts:76-77` |
| `mobile-layout.spec.ts` sweeps exactly two routes — `/builds` and `/tree` | `mobile-layout.spec.ts:70-82, 145-155` |
| The `builds` table is **empty right now** (0 rows, all visibilities) | `select visibility, count(*) … group by visibility` returned no rows |

## Claims I could NOT verify

- **That an icon actually 307s for an anonymous visitor.** The chain is verified statically and is unambiguous (matcher forces `/data/wiki/**/*.png` through the middleware; `isProtectedPath` matches the `/data/wiki/` prefix; no user → `NextResponse.redirect('/login')`), but I did not run a server and issue an anonymous request — the brief forbids the Playwright suite and I did not start a dev server. **Task 8's first e2e assertion exists to close this**, and the implementer should run it *before* touching the proxy, so the fix is proven against an observed failure rather than a read one.
- **Real-world behaviour of any of the three RPCs against a populated row.** `builds` has zero rows, so I could only confirm the function bodies, the grants, and that `anon` can call them without error. The `visibility IN ('public','unlisted')` filter is read from the live body, not observed filtering a real unlisted build.
- **Whether `display_name` is ever populated.** `user_profiles.display_name` is nullable with no default and I found no write path for it in the app. Attribution may be `null` for every existing account. Plan for it (Task 6) rather than assuming a name comes back.
- **Query plans.** I read the index definitions but ran no `EXPLAIN` — with an empty table a plan would be meaningless anyway. The index-coverage statements below are read off the definitions, which is enough to say what *cannot* be index-backed and not enough to promise what will be.
- **Whether making wiki icons public conflicts with an unrecorded product intent.** `wiki-data-gating-report.md` records the decision as "`/wiki` must not be usable signed-out" and scopes it to the browsable dataset; it says nothing about icons in isolation. I am reading that scope, not quoting an explicit ruling on icons. **This is the one decision in the plan that deserves a human yes/no before it ships.**

---

## Where the spec is wrong

1. **"Tags join `build_tags`" — for a shared page, only sometimes.** `build_tags`'s SELECT policy is `own OR builds.visibility = 'public'`. It does **not** include `unlisted`. So the public view of an *unlisted* build renders fine via the RPC but its tags come back empty — the same class of "works for public, silently broken for unlisted" bug the spec correctly caught for the build row itself, and missed one table over. See Task 6.
2. **Author attribution is not a style choice either.** `user_profiles`'s only SELECT policy is `auth.uid() = id`. A join from a shared page returns nothing for *any* visibility, signed in or out. `get_build_author_name` is load-bearing, and the spec's "via `get_build_author_name`" understates it.
3. **`get_build_author_name` is not visibility-gated.** The spec lists it under functions whose behaviour is verified, alongside two that *do* check `visibility`. It does not. Any build id, including a private one, returns its author's `display_name`. Mitigation in Task 6: only ever call it with an id that `get_build_by_share_token` just returned.
4. **"Fire `increment_build_view_count` once per view" implies the RPC helps.** It does not — it is an unguarded `+ 1`. "Once per view" is entirely the caller's responsibility, and the naive client-side implementation double-counts in dev (StrictMode) and re-counts on soft navigation. See Task 7.
5. **"Class and league are served by `builds_visibility_idx`."** Half true. The index is `(visibility, class, league) WHERE visibility='public'` — inside the partial index `visibility` is constant, so it behaves as `(class, league)`. Class-only and class+league are prefix matches; **league-only is not**, and neither is any sort order the finder might want (`updated_at`/`view_count` have no index at all). See Task 5.
6. **"Render through the *same* Tree/Gear/Gems components with a `readOnly` prop threaded down. No second renderer."** Correct for the passive tree, wrong for the sheets. See "Read-only rendering" below — and note the spec was written on 2026-09-16, before those components existed; it is describing an intention, not an assessment of what shipped.

Not wrong, and worth saying so: the spec's two headline claims — that the RLS SELECT policy exposes `visibility = 'public'` only, and that `get_build_by_share_token` is therefore the only path to an unlisted build — are **both exactly right**, verified against the live function body and the live policy.

---

## The three blocking decisions

### 1. Icons under `/data/wiki/` would 307 to `/login` for every signed-out visitor

**Confirmed at the code level.** `GearItem.iconUrl` is stored verbatim from the wiki detail JSON, e.g. `/data/wiki/2026-08-25/icons/skills/herald-of-ash.png`. `src/proxy.ts`'s matcher deliberately routes that path through the middleware (the nested `(?!data/)` inside the image-extension exclusion exists for exactly this reason, and its comment says so), `isProtectedPath` matches the `/data/wiki/` prefix, and with no user the middleware returns a redirect to `/login`. Every gear, jewel and gem icon on a public build page is an `<img>` pointed at an HTML login page. `/data/tree/` is excluded at the matcher, so the passive-tree export itself is genuinely fine.

**Decision: exempt `/data/wiki/<version>/icons/` from the auth gate. Keep the indexes and the detail JSON gated exactly as they are.**

Why this does not reopen the wiki to anonymous scraping:

- The gated asset with value is the **dataset**: `item-index.json` (708KB, 4,975 entries), `skill-index.json` (172KB, 1,118 entries) and the per-entity detail JSON carrying stats, mods, scaling and flavour. An icon is a 64×64 PNG of one item, addressable only by knowing its slug — and the slug list lives in the index, which stays behind the gate. Scraping every icon still requires first defeating the thing we are not touching.
- `wiki-data-gating-report.md` records the product decision as "wiki data must be behind the auth gate; `/wiki` must not be usable signed-out". Serving an individual icon does not make `/wiki` usable: there is no search, no listing, no stat text.
- **Precedent already shipped in this repo:** `/prices` is a public route and renders game item and currency icons to signed-out visitors (`PricesClient.tsx` renders `row.icon_url` with a plain `<img>`). `AGENTS.md` sanctions exactly this — the wiki's extracted icons and poe2scout's CDN icons are two of its three named exceptions, both "depicting real in-game content" from GGG's own official data. Showing an item's real icon to a signed-out visitor is already the app's established behaviour.

Alternatives, and why not:

- **Drop `/data/wiki/` from `PROTECTED_PREFIXES`.** Reverses a deliberate, documented product decision and exposes the whole dataset. No.
- **Proxy icons through a Route Handler** (`/api/wiki/icon/[...path]`). This is the one that looks right and is not. `next.config.ts`'s `outputFileTracingExcludes` excludes `icons/**` **only for `/wiki/**` routes**; a new handler that reads `public/data/wiki/**/icons/**` at request time is a new route with a dynamic path, so Next's tracer cannot narrow it and pulls the icon tree into that function's bundle — the precise failure that config block was written to stop (211MB functions, past Vercel's 250MB limit, a failed deploy). It also converts a static file into a serverless invocation per icon, on a page that shows twenty to forty of them, on a phone.
- **Copy or re-host the icons under a public path.** Duplicates ~47MB in the repo and gives the weekly sync two places to write.

**Implementation (do all three, in this order):**

1. `src/proxy.ts`: add a named predicate next to `isProtectedPath`, e.g.

   ```ts
   // Wiki ICONS only — not the indexes, not the detail JSON. A public build
   // page (/builds/[shareToken]) is by definition viewed with no session, and
   // every gear/jewel/gem iconUrl points under /data/wiki/, so without this
   // every icon on a shared build 307s to /login and renders as a broken
   // image. Scoped to the icons directory because the gated asset of value is
   // the DATASET (item-index.json, skill-index.json, the per-entity detail
   // JSON) — an icon is addressable only by a slug that lives in that still-
   // gated index. See docs/superpowers/handoffs/wiki-data-gating-report.md and
   // the 2026-09-22 Task 4 plan.
   const PUBLIC_WIKI_ASSET_RE = /^\/data\/wiki\/[^/]+\/icons\//
   ```

   and consult it inside `isProtectedPath`, over the **same `candidates` array** the prefix check already builds (raw plus single-level-decoded). Exempt only when **every** candidate matches — so `/data/%77iki/…/icons/x.png`, which is an icon in one spelling and not in the other, falls through to the prefix check and is still redirected. Narrowing an exemption is always the safe direction here; widening it is not.
2. **Do not touch the matcher regex.** It is the documented percent-encoding hazard in this file and has been patched for it twice (2026-08-21 security review, rounds 1 and 2). The cost of leaving it alone is one `supabase.auth.getUser()` round-trip per icon request — which signed-in users already pay today for every icon in the gear sheet, so this is not a new cost, just an unreduced one. If it later shows up in mobile timings, that is its own change with its own review, not a rider on this one.
3. **Do not touch `next.config.ts`'s headers.** Icons keep `Cache-Control: private, max-age=3600, stale-while-revalidate=604800`. They are now public, so `public` + CDN caching would be strictly better — but adding it means a second, narrower rule overlapping `/data/wiki/:path*`, and that file's SECURITY block documents in detail why narrow/denylist rules on this path are how the last two bugs happened. Browser caching still works. Recorded as deliberately deferred.

Nothing else changes. `next/image` stays banned for these URLs (the existing `eslint-disable @next/next/no-img-element` comment pattern); the reasoning in `GearSheet`'s `SlotRow` comment is still correct for the signed-in case and now simply also true for the signed-out one.

### 2. The read-only view must call `get_build_by_share_token`

**Confirmed, exactly as the spec says, against the live function body and the live policy.** The RLS SELECT policy on `builds` is `visibility = 'public'`; the RPC filters `visibility IN ('public','unlisted')` and is `SECURITY DEFINER`, so it is the only path that reads an unlisted build. A plain select would return zero rows for every unlisted build — which is the set most likely to be behind a freshly-copied share link.

`anon` holds `EXECUTE` on it (verified via `proacl` and an actual call under `set local role anon`), so the cookie-scoped `createClient()` works with no session and no service client. **Never use `createServiceClient()` here** — it bypasses RLS entirely and the RPC already does the only privilege escalation this feature needs, scoped to one filter.

Two consequences the spec does not draw:

- `build_tags` does **not** have an equivalent escape hatch (its SELECT policy stops at `public`), so tags are invisible on an unlisted shared page. Task 6 renders tags only when `visibility === 'public'` and says so in a comment. Adding a `get_build_tags_by_share_token` RPC would fix it properly and is the one migration this feature could justify — **not in v1**, because it is a database change for a secondary display element and this plan would rather ship a correct omission than an unreviewed migration.
- `get_build_author_name` takes a build id and checks nothing. Call it only with `row.id` from the RPC's own result.

### 3. Route collision and shape

**There is no collision, and the premise is slightly off.** `?build=<uuid>` is a **query parameter on `/tree`** (`src/app/(dashboard)/tree/page.tsx` reads `searchParams.build`), not a path segment under `/builds`. The two never occupy the same position in a URL. `UUID_RE`'s own docstring in `src/lib/build/constants.ts` already states this: "`/builds/[shareToken]` is a separate, 21-char nanoid and does not use this."

Routing: `/builds` is `(dashboard)/builds/page.tsx`; `/builds/[shareToken]` is `(dashboard)/builds/[shareToken]/page.tsx`. Different segment depth, no ambiguity. If a static sibling is ever added (`/builds/new`), Next resolves static before dynamic — but do not add one in this task.

Token shape: `nanoid@5.1.11`, default size 21, alphabet `A-Za-z0-9_-`. Every character is URL-safe, so no encoding, and the shape cannot be confused with a UUID (wrong length, no hyphen positions, mixed case).

**Signed-out reachability:** `PROTECTED_PREFIXES` contains no `/builds` entry, and the check is `startsWith`, so `/builds/<token>` inherits `/builds`'s public status. **Do not add it.** The middleware still *matches* the path (so the session cookie refreshes and `x-vaal-user-email` is set) — it simply does not redirect.

Placing the route inside the `(dashboard)` group is correct: it gets `AppShell`, which reads the proxy header and renders signed-out chrome with no auth call and no redirect, and `/builds` already proves that path works in this exact group. One stale comment to fix while there: `(dashboard)/layout.tsx` says "Proxy already gates this group, so only signed-in users reach here" — untrue since `/builds` shipped, and doubly untrue after this task. One line.

---

## Read-only rendering — recommendation

**Split the decision. Thread `readOnly` into the passive tree only. Do not thread it into the sheets; write small static presentational components instead.**

**Passive tree — thread it.** There is genuinely no alternative renderer for a 1,500-node WebGL graph and writing a second one is not on the table. Two contained edits: `PassiveTree` takes `readOnly?: boolean` and skips its commit paths (`handleNodeClick`'s toggles, `commitAscendancy`) while keeping pan/zoom, hover and node selection so a reader can still inspect what a node does; `TreeControls` takes the same flag and hides the class picker, ascendancy picker, paint-mode toggle and `ResetButton`, keeping the point counters and the search field, which are read affordances. Nothing about the scene, geometry or sprite loading changes.

**Gear, jewels, gems — do not thread it.** Four independent reasons, each sufficient:

1. **The sheets exist to solve a problem the shared page does not have.** Each is `createPortal(…, document.body)` rendering `fixed inset-0 z-40`, and `GearSheet`'s header comment spells out why: `/tree`'s canvas wrapper is `position: fixed` and creates a stacking context that a descendant `z-40` can never escape, so the portal is the only way to out-rank the shell's `sticky z-20` header. A shared build page has no canvas and no stacking-context problem. Inheriting that machinery buys nothing and costs a full-screen overlay where a scrolling page is wanted.
2. **They own editing state that must be proven dead, not merely hidden.** `GearSheet` holds `pickerSlot` and mounts `ItemPickerSheet` at `z-50`; `GemsSheet` and `JewelsSheet` do the same. `ItemPickerSheet` fetches `GET /api/wiki/items`, which **401s with no session**. A `readOnly` flag that must never be false on one code path, guarding a fetch that fails loudly for exactly the audience the feature is for, is a defect waiting for the one branch someone forgets.
3. **A read-only `JewelsSheet` would drag the tree export onto a page that needs none.** `summarizeJewels(raw: GggTreeJson, …)` takes the full 5.1MB export as its first argument, because socket names are resolved from it. A static jewel list can render the `gear_state.jewels` values directly — name and icon — and simply not claim which socket each sits in. That is a real information loss and a very large win, and it is the right trade on a phone opening a link.
4. **The recon's strongest single finding points here.** `2026-09-20-competitor-build-planner-recon.md:49` — pobb.in "is the best mobile experience among the PoE sites, **precisely because it has nothing to interact with**"; and `:107` recommends the shared view be "deliberately simple and static-first … resist the temptation to make the shared-build view as interactively heavy as the editor." That is the finding this plan is built on.

**What is actually being reused, and it is the part that matters:** `parseGearState`, `parseGemState`, `GearState`, `GemState`, `GearItem`, `GEAR_SLOT_LABELS`, `WEAPON_SET_DOT` and `deriveMainSkill` — the pure, unit-tested state modules. The read-only components consume the identical validated shapes. "No second renderer" is honoured where it means something (the tree, the state vocabulary) and declined where it would mean shipping an editor with its buttons painted out.

---

## Global constraints (read before writing any code)

- **Mobile-first.** Unprefixed Tailwind is the complete phone experience; `md:` is the desktop addition. Tap targets ≥ 44px (`h-11`) — `mobile-layout.spec.ts` measures both dimensions, not just height.
- **`/builds/[shareToken]` renders for a visitor with no session.** Every data path on it must work as `anon`. No `getCachedUser()`-gated content in the main column; owner-only affordances are additive.
- **Never import a pure function from a `'use client'` module into server code.** The RSC bundler turns every export of such a module into a client reference and throws at request time while `type-check` and `build` stay silent. Visibility/tag/token helpers go in plain modules under `src/lib/build/`.
- **`react-hooks` lint is strict** (`set-state-in-effect`, `preserve-manual-memoization`). Derive rather than setState-in-effect. No `eslint-disable` except the existing `@next/next/no-img-element` pattern for `/data/wiki/` icons; no `any`; no `@ts-expect-error`.
- **Server Functions are reachable by direct POST.** Every new action in `builds/actions.ts` re-verifies the session itself and keeps the `.eq('user_id', …)` defence-in-depth filter, exactly as `renameBuild`/`deleteBuild` do and for the reason their header comment gives.
- **Gates before every commit:** `npm run type-check` → `npm run lint` → `npm test` → `npm run build`. Report actual output, never expected.
- Do not run `npm install` (it silently reverts the `@poe2-toolkit` patch).

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `src/lib/build/constants.ts` | **Edit** | Add `SHARE_TOKEN_RE` (`/^[A-Za-z0-9_-]{21}$/`) beside `UUID_RE`, same reasoning. |
| `src/lib/build/visibility.ts` | **Create** | `BUILD_VISIBILITIES`, `isBuildVisibility`, labels + one-line descriptions. Plain module. |
| `src/lib/build/tags.ts` | **Create** | `normalizeTag`, `normalizeTagList`, `MAX_TAGS_PER_BUILD`. Pure. |
| `src/lib/build/finderFilters.ts` | **Create** | Parse/serialise the finder's filter object against `searchParams`. Pure. |
| `src/lib/build/__tests__/visibility.test.ts` · `tags.test.ts` · `finderFilters.test.ts` | **Create** | The whole unit-test surface of this task. |
| `src/app/(dashboard)/builds/[shareToken]/page.tsx` | **Create** | Server Component. RPC → author name → view count → static view. |
| `src/app/(dashboard)/builds/[shareToken]/not-found.tsx` | **Create** | "That build is private or does not exist." |
| `src/components/builds/SharedBuildView.tsx` | **Create** | The static read-only page body (header, gear, jewels, gems, tags, tree gate). |
| `src/components/builds/ReadOnlyGearList.tsx` · `ReadOnlyGemList.tsx` | **Create** | Presentational, no state, no fetch, no portal. |
| `src/components/builds/SharedTreePanel.tsx` | **Create** | Client. Renders a button until tapped; then fetches the tree export and mounts `PassiveTree` with `readOnly`. |
| `src/components/tree/PassiveTree.tsx` | **Edit** | `readOnly?: boolean` — suppress the two commit paths. |
| `src/components/tree/TreeControls.tsx` | **Edit** | `readOnly?: boolean` — hide pickers, mode toggle, reset. |
| `src/app/(dashboard)/builds/actions.ts` | **Edit** | `setBuildVisibility`, `addBuildTag`, `removeBuildTag`, `toggleBuildBookmark`. |
| `src/components/builds/MyBuildsList.tsx` | **Edit** | Per-row visibility control + share link. |
| `src/app/(dashboard)/builds/page.tsx` | **Edit** | Two tabs: Mine (existing) and Public (the finder). |
| `src/components/builds/BuildFinder.tsx` | **Create** | Filter chips + result list, presentational; the query lives in the page. |
| `src/app/(dashboard)/layout.tsx` | **Edit** | One stale comment line. |
| `src/proxy.ts` | **Edit** | The wiki-icon exemption. |
| `e2e/sharing.spec.ts` | **Create** | Three mobile-only tests. |
| `e2e/mobile-layout.spec.ts` | **Edit** | One extra `expectNoOverflow` on the shared route. |

**No database migration.** Every column, function, policy, constraint and index this task needs already exists and was verified above.

---

## Task 1 — `visibility.ts`, `tags.ts`, `constants.ts`

- [ ] `src/lib/build/visibility.ts`: `export const BUILD_VISIBILITIES = ['private','unlisted','public'] as const` — the same three values as the live CHECK constraint, in a comment that says so and says the DB will reject anything else. `isBuildVisibility(v: string): v is BuildVisibility`. `VISIBILITY_LABEL` / `VISIBILITY_HINT` records for the UI ("Only you", "Anyone with the link", "Listed in the finder"). `BuildVisibility` itself already exists in `types.ts` — import it there, do not redeclare.
- [ ] `src/lib/build/tags.ts`:
  - `normalizeTag(raw): string | null` — trim, collapse internal whitespace, **lowercase**, then length 1–32 or `null`. Lowercasing is not cosmetic: the PK is `(build_id, tag)` and the CHECK is length-only, so `Minion` and `minion` are two distinct rows and two distinct finder facets. The database will not do this for us.
  - `normalizeTagList(raw: string[]): string[]` — map, drop nulls, dedupe, cap at `MAX_TAGS_PER_BUILD`.
  - `export const MAX_TAGS_PER_BUILD = 8` — **ours, not the database's**: there is no row-count constraint on `build_tags`, so without this a build can carry unbounded tags. Single named constant so the number is one edit.
- [ ] `constants.ts`: add `SHARE_TOKEN_RE = /^[A-Za-z0-9_-]{21}$/`, documented as nanoid's default size and alphabet (`nanoid@5.1.11`), with the same rationale `UUID_RE` carries — shape-check before querying so junk becomes our own copy instead of a pointless round-trip.

---

## Task 2 — `PassiveTree` / `TreeControls` read-only

- [ ] `PassiveTree` gains `readOnly?: boolean`. Guard the **two commit paths only**: the allocation branch inside `handleNodeClick` and `commitAscendancy`. Leave hover, selection, `NodeInfoPanel`, `NodeTooltip`, pan and zoom alone — a reader inspecting what a node grants is the entire point.
- [ ] Make `onStateChange` optional in practice for this mode (it already is optional in the type) and do not pass it from the shared page. There is nothing to save.
- [ ] `TreeControls` gains `readOnly?: boolean`: hide the class picker, the ascendancy picker, the paint-mode toggle and `ResetButton`; keep the point counters and the search field. The collapsed-chip behaviour stays — it is a mobile space decision, not an editing one.
- [ ] Do **not** add a `readOnly` prop to `TreeEditor` or `TreeBuildSession`. Those own the save panel, the draft prompt and the sheets; the shared page does not use them at all (Task 4).

---

## Task 3 — `/builds/[shareToken]` page

- [ ] `src/app/(dashboard)/builds/[shareToken]/page.tsx`, a Server Component:

```ts
const { shareToken } = await params;
if (!SHARE_TOKEN_RE.test(shareToken)) notFound();

const supabase = await createClient();          // anon-capable, cookie-scoped. NEVER createServiceClient().
const { data, error } = await supabase
  .rpc('get_build_by_share_token', { p_token: shareToken })
  .maybeSingle();                                // SETOF; the generated type is `[]` with isSetofReturn
if (error || !data) notFound();
```

- [ ] `notFound()` for a bad token, an RPC error, and a `private` build alike — the same deliberate indistinguishability `builds/actions.ts` and `/tree` already apply. The RPC's own `visibility IN ('public','unlisted')` filter is what turns "private" into "not found", server-side, with no client cooperation.
- [ ] `export const metadata` cannot be static here. Use `generateMetadata` for the title (`<name> — Project Vaal`). **It must not call `increment_build_view_count`** — Next may invoke `generateMetadata` and the page body for one request, and the counter must fire in exactly one place (Task 7).
- [ ] The route reads cookies via `createClient()`, which is a request-time API and opts the whole route out of static/ISR rendering regardless of any `revalidate` export — the same reasoning `src/app/prices/page.tsx`'s header already records. Do not add `revalidate`; it would be a no-op and misleading. The view counter needs a dynamic route anyway.
- [ ] Hand `SharedBuildView` the row plus `isOwner` (from `getCachedUser()`, already memoised per request and already called by `AppShell`). `isOwner` drives nothing but an "Edit this build" link to `/tree?build=<id>`; every other affordance is identical for everyone.

---

## Task 4 — `SharedBuildView` and the read-only lists

One vertical scroll. Order, top to bottom — deliberately the same order as pobb.in's, which the recon found to be the one mobile-good page in the survey:

1. **Header** — build name, `ascendancy ?? class`, level, league, `main_skill`, author, view count, `updated_at`. Reuse `/prices`' house list language (`divide-y divide-border rounded-lg border border-border bg-card/40`), which is already the repo's breakpoint-invariant list style.
2. **Tags** — only when `visibility === 'public'`, with a comment stating why (Task 6).
3. **Gems** — `parseGemState(row.gem_state)`, one card per loadout: skill icon + name, wrapped support chips, weapon-set dots from `WEAPON_SET_DOT`, and a `Main skill` marker on `primaryId`. Static markup; no toggles, no remove buttons, no picker.
4. **Gear** — `parseGearState(row.gear_state)`, `GEAR_SLOT_LABELS` rows for the 17 slots. Show both weapon sets stacked rather than reproducing `GearSheet`'s set-switching toggle: the toggle is an editing affordance and vertical space is cheaper than a control.
5. **Jewels** — the values of `gear_state.jewels` as a flat list, name + icon. **No socket names**: resolving them needs `summarizeJewels(raw: GggTreeJson, …)`, i.e. the 5.1MB export, on a page that otherwise needs none. Deliberate, comment it.
6. **Passive tree** — `SharedTreePanel`, below everything else.

- [ ] `ReadOnlyGearList` / `ReadOnlyGemList` are presentational: props in, markup out, no state, no fetch, no portal. Icons use plain `<img>` with the existing `eslint-disable @next/next/no-img-element` comment. Give every icon `loading="lazy"` (the shared page can carry forty of them, and `PricesClient` already does this) and `alt=""` with the name as adjacent text — an icon next to its own label is decorative.
- [ ] `SharedTreePanel` (client): renders a single `h-11` full-width button — `View passive tree (N points allocated)`, the count derived from `passive_state` with no export needed. On tap, fetch `/data/tree/0.5.2/data.json` and mount `PassiveTree` with `readOnly` and `initialState` built by `fromPassiveState`. **The 5.1MB fetch must never be on the shared page's first paint** — that is a third of the reason this page is worth having.
- [ ] Keep `TREE_VERSION` in exactly one place. It is currently a module constant in `TreeEditor.tsx`; export it from there (or move it to `constants.ts`) rather than typing `'0.5.2'` a second time.
- [ ] Empty states are not errors: a build with no gear renders "No gear recorded", not a blank region.

---

## Task 5 — The finder (Public tab on `/builds`)

- [ ] `/builds` grows a tab. Server-rendered, driven by `searchParams` (`?tab=public&class=…&league=…&skill=…&tag=…`) — not client state, so a filtered finder is a shareable URL and the Back button works. The existing "Your builds" query and `MyBuildsList` are untouched on the Mine tab.
- [ ] The query, from the same `createClient()` (works signed-out):

```ts
let q = supabase.from('builds')
  .select('id, name, class, ascendancy, level, league, main_skill, share_token, view_count, updated_at')
  .eq('visibility', 'public')       // NOT redundant — see below
  .order('updated_at', { ascending: false })
  .limit(PAGE_SIZE);
```

- [ ] **`.eq('visibility','public')` is load-bearing, not belt-and-braces.** The owner policy is `ALL` for role `public` with `auth.uid() = user_id`, and Postgres ORs permissive policies together — so for a *signed-in* viewer a bare select returns every public build **plus all of their own private ones**, listed in a tab labelled "Public". This is the same trap `builds/page.tsx`'s comment already documents from the other direction; write the mirror-image comment here.
- [ ] Select named columns, not `*`. The finder does not need `passive_state`/`gear_state`/`gem_state`, and those are the three large jsonb columns; shipping them for every row of a list is the difference between a fast page and a slow one.
- [ ] **Index reality, stated plainly in a comment so nobody later "optimises" against a false belief:**
  - `class`, and `class` + `league`, are prefix matches on `builds_visibility_idx (visibility, class, league) WHERE visibility='public'` (inside the partial index `visibility` is constant, so it behaves as `(class, league)`).
  - **`league` alone is not a prefix** and is not index-backed.
  - `main_skill` has its own partial index, `builds_main_skill_idx`.
  - `tag` filtering goes `build_tags` (index `build_tags_tag_idx (tag)`) → build ids → `builds`, in that direction.
  - **Nothing indexes `updated_at`, `created_at` or `view_count`.** Any ordering is a sort over the public set. Always pass an explicit `.limit()`, and do not advertise a "most viewed" sort as if it were cheap.
- [ ] Filter vocabulary comes from real data, not a hardcoded list: classes from the tree export's class names (the same eight `PassiveTree` already filters to), leagues and main skills from `distinct` over the public set. Do not invent a league enum — `builds.league` is free text with a `'Standard'` default.
- [ ] `BuildFinder` is presentational: filter chips (`h-11`, wrapping, never a horizontally-clipped strip — recon `:59` is exactly that failure) plus the result list, each row linking to `/builds/<share_token>`. Rows whose `share_token` is null cannot be linked; they should not exist (every insert mints one) but render them non-clickable rather than crashing.
- [ ] Empty result set is a first-class state, and right now the **expected** one — the `builds` table currently holds zero rows.

---

## Task 6 — Visibility control, tags, bookmarks, attribution

**Visibility control — owner-only, in `MyBuildsList`.**

- [ ] New Server Function in `builds/actions.ts`, shaped exactly like `renameBuild`: `UUID_RE` check → `isBuildVisibility` check → `getCachedUser()` → `.update({ visibility }).eq('id', id).eq('user_id', user.id).select('id')` → zero rows is `NOT_FOUND` → `revalidatePath('/builds')`.
- [ ] Validate the value in the action even though the CHECK constraint would reject it. A 500 from a constraint violation is a worse experience than our own message, and the action is reachable by direct POST.
- [ ] **Do not route this through `POST /api/builds`.** That route's update path always writes `name/class/ascendancy/level/league/passive_state/game_version` in full, so a visibility-only change through it would need the entire editor state in the body and could clobber it from a page that has none.
- [ ] UI: a three-state control per row (a `<select>` from `@/components/ui/select`, or three `h-11` pills — either satisfies the tap-target check; the select wins on width at 375px). Default is whatever the row says; new builds are `private` by the column default.
- [ ] When `visibility !== 'private'` **and** `share_token !== null`, show the link with a Copy button. `share_token` is minted once on insert and never regenerated (verified: no code path updates it), so the link is stable across visibility changes — which is exactly why moving to `private` and back restores the same URL.
- [ ] Revocation needs no client cooperation: both `get_build_by_share_token` and `increment_build_view_count` check `visibility IN ('public','unlisted')` in their own bodies (verified). Say this in the UI in one line — "Switching to Private disables the link immediately" — because it is the question every user will have.

**Tags — owner-only editing, on the same row or a small sheet.**

- [ ] `addBuildTag(buildId, raw)`: `normalizeTag` → `null` is a validation error; then count existing tags and refuse past `MAX_TAGS_PER_BUILD`; insert into `build_tags`. Ownership is enforced by the INSERT policy's `EXISTS (… b.user_id = auth.uid())`; keep the explicit session check anyway.
- [ ] `removeBuildTag(buildId, tag)`: delete. **There is no UPDATE policy on `build_tags`** (verified) — editing a tag is delete + insert, never an update. Do not write an update path that will fail silently under RLS.
- [ ] A duplicate insert violates PK `(build_id, tag)`. Treat it as success (idempotent), not an error.
- [ ] On the shared page, render tags **only when `visibility === 'public'`**, with this comment: *`build_tags`' SELECT policy is `own OR builds.visibility = 'public'` — it does not include `unlisted`, so a plain select returns zero rows on an unlisted shared build even though the build itself renders via the RPC. Rendering an empty tag row would look like "this build has no tags" rather than "we cannot see them". Verified against pg_policies 2026-09-22.*

**Bookmarks.**

- [ ] `toggleBuildBookmark(buildId)`: requires a session (the RLS policy is `auth.uid() = user_id`); insert or delete `(user_id, build_id)`. PK makes it naturally idempotent.
- [ ] The control renders only when signed in **and** the build resolved — note that the `ALL` policy does **not** check the build's visibility, so a caller could bookmark any id they guess. Low severity (they still cannot read it), but the UI should never be the thing that makes it easy.
- [ ] **No "my bookmarks" page in v1.** The indexes for one exist (`build_bookmarks_user_id_idx`), so it is a cheap follow-up; it is simply not in this task's scope.

**Author attribution.**

- [ ] `supabase.rpc('get_build_author_name', { p_build_id: row.id })`, using **the id the share-token RPC just returned** — never one from the URL or the client. The function does not check visibility (verified), so the id it is given is the whole access control.
- [ ] `display_name` is nullable with no default and I found no write path that sets it (see "Claims I could NOT verify"), so **`null` is the likely common case**. Fall back to a neutral literal such as "Anonymous". **Never fall back to the email** — `AppShell` has one in a request header and putting it on a public page would be a genuine leak.
- [ ] Run it in parallel with the view-count call (`Promise.allSettled`), not sequentially.

---

## Task 7 — View counting

`increment_build_view_count` is an unguarded `UPDATE … SET view_count = view_count + 1` with a visibility filter and nothing else (verified body). Every word of "once per view" is the caller's job.

- [ ] **Fire it server-side, in the page body, once per request**, after the share-token RPC returns, with `row.id`. The route is already dynamic (it reads cookies), so one request is one page load. This counts *page loads*, not unique viewers — say so in the comment rather than letting a later reader assume otherwise.
- [ ] **Never fire it from a client `useEffect`.** React StrictMode double-invokes effects in development, and an effect re-runs on soft re-navigation — two different ways to double-count, one of which only shows up in dev and is therefore the one that ships.
- [ ] **Never fire it from `generateMetadata`.** Next may call `generateMetadata` and the page body for the same request; the counter belongs in exactly one of them.
- [ ] **Skip it when the viewer is the owner** (`row.user_id === user?.id`). `getCachedUser()` is memoised per request and `AppShell` calls it anyway, so this costs nothing and stops an author inflating their own count by refreshing their share link.
- [ ] Fire-and-forget inside its own try/catch. A failed counter must never fail the page, and it must never block first paint — `Promise.allSettled` alongside the author lookup, awaited once before render.
- [ ] Per-visitor dedupe (cookie or IP) is **out of v1**. Do not imply otherwise in the UI; "views" is a page-load count.

---

## Task 8 — Tests

**Unit (vitest, `environment: 'node'`, `src/**/*.test.ts` — `.ts` only, so not one component in this task is unit-testable).** The whole surface is the three pure modules, which is exactly why they exist as separate modules:

- [ ] `visibility.test.ts` — `isBuildVisibility` accepts the three live CHECK values and rejects `''`, `'Public'`, `'deleted'`, and non-strings.
- [ ] `tags.test.ts` — `normalizeTag` lowercases (`'Minion'` → `'minion'`), trims, collapses internal whitespace, returns `null` for empty-after-trim and for 33 characters, accepts exactly 32 and exactly 1 (the live CHECK bounds); `normalizeTagList` dedupes case-variants to one entry and truncates at `MAX_TAGS_PER_BUILD`.
- [ ] `finderFilters.test.ts` — parse/serialise round-trip, unknown keys dropped, array-valued `searchParams` handled (Next hands `string | string[] | undefined`, and `/tree`'s page already has to deal with that), empty filter serialising to no query string.
- [ ] Also add `SHARE_TOKEN_RE` cases to whichever constants test exists, or inside `visibility.test.ts`: accept a real 21-char nanoid, reject a UUID, reject 20 and 22 characters, reject a `+` or `/`.

**E2E — one new file, three tests, mobile-only.**

The suite today is 5 spec files / 17 `test()` declarations, `workers: 1`, `fullyParallel: false`, 180s per-test budget, dev server cold-compiled unless `E2E_REUSE=1`.

- [ ] `e2e/sharing.spec.ts`, guarded with the existing `test.skip(() => test.info().project.name !== 'mobile', 'mobile project only')`. `testBuildName('share')`, `cleanupWithFreshPage` in `afterAll` — these are real rows in the real project.
  1. **Unlisted link works signed out.** Owner creates and saves a build with one gear item and one gem (via the existing `openTree`/`saveBuild` helpers), sets visibility to `unlisted`, reads the share link. Then a signed-out context (`test.use({ storageState: { cookies: [], origins: [] } })`, the pattern `draft-and-auth.spec.ts:76-77` already uses) opens `/builds/<token>` and asserts the build name, the gear item name and the gem name are all visible. **This is the test that would have caught the RLS trap**, and it fails today for the plain-select implementation the spec warned about.
  2. **Icons load signed out.** Same signed-out context, same page: assert at least one `<img>` under the gear list has `naturalWidth > 0` — a 307-to-`/login` yields `0`, so this is the direct, observable form of blocking item 1. In the same test, assert a direct `request.get('/data/wiki/<version>/skill-index.json')` still lands on `/login`, so the icon exemption cannot silently widen into the dataset. **Run this test before changing `src/proxy.ts`, watch it fail, then fix.**
  3. **Private revokes.** Owner switches the same build to `private`; the signed-out context reloads `/builds/<token>` and gets the not-found page.
- [ ] **Cost.** Test 1 pays one `/tree` mount to author the build (5.1MB export + `normalizeGggTree`); tests 2 and 3 are plain page loads. Because the shared view is static-first and the tree sits behind a tap, **none of the three mounts the tree on the shared page itself** — that is a direct, measurable payoff of the static-first decision rather than a claim about it. Budget roughly one existing spec's worth, ~45–90s on top of the suite's ~14 minutes. Scoped to `mobile`: the shared view has no `md:`-only behaviour, so a desktop re-run would re-prove a server-state result at full price, which is exactly what `playwright.config.ts`'s `desktop` project comment says not to do.
- [ ] `mobile-layout.spec.ts`: add one `expectNoOverflow(page, '/builds/<token>')` to the existing "no horizontal page scroll" test rather than a new test. That file sweeps only `/builds` and `/tree` today; the new route is the one place in this task where a long build name or a wide tag row can overflow 375px. The Public tab on `/builds` needs no edit — both the tap-target and the overflow checks already visit that route.

---

## Verification before commit

- [ ] `npm run type-check` → `npm run lint` → `npm test` → `npm run build`, reporting actual output. Baseline to beat: whatever this branch reports today, plus the new test files.
- [ ] `npm run test:e2e -- sharing` once, against a server started from **this** directory (see `playwright.config.ts`'s `webServer` comment — a stale server from another checkout silently serves different code, and that trap has produced false results here repeatedly).
- [ ] Manual, at 375px, signed **out**, in a private window: open a real unlisted share link and confirm every icon renders. Signed-in verification is worthless for this feature — the entire failure mode is invisible with a session.
- [ ] Manual: confirm a signed-out request for `/data/wiki/<version>/item-index.json` still redirects to `/login` after the proxy change. The exemption is one regex; the whole gating decision rests on it being narrow.
