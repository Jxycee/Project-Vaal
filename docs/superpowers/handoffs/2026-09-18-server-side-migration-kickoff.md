# Server-Side Migration + Gear — Handoff

> ## ✅ COMPLETE — HISTORICAL RECORD. Read `docs/superpowers/CURRENT-STATE.md` for what is true now.
>
> The work this handoff briefs (D1, D5, D2) shipped on branch
> `worktree-server-migration`, along with Tasks 2, 3 and 4. Its verification
> guidance is still sound and still worth reading.
>
> Two of its database facts are now false, verified live on 2026-09-23:
> `get_build_by_share_token` resolves `visibility IN ('public','private')`, not
> `('public','unlisted')`, and `builds.visibility` defaults to `'unlisted'`, not
> `'private'`. The meanings of those two words were deliberately swapped on
> 2026-09-23 — see CURRENT-STATE.md.


**Date:** 2026-09-18
**Status:** No code written for this work yet. This hands off a decided direction, not a session recap.
**Read this whole file before writing code.** It exists because the previous round's bugs were almost all caused by acting on a document that was confidently wrong. Several claims below contradict older docs in this repo — where they do, this file is newer and was verified against the live database and the running app.

---

## 1. Read these first, in this order

1. **`docs/superpowers/specs/2026-09-16-build-planner-design.md`** — the corrected spec for the whole build planner. This, **not** `docs/superpowers/handoffs/2026-09-16-build-feature-kickoff.md`, is the source of truth. The older kickoff handoff verified its claims against `supabase/schema.sql`, which was stale at the time, so it asserts several things about the database that are simply false.
2. **`supabase/schema.sql`** — regenerated from the live database on 2026-09-18 and now accurate. It carries a header naming the project ref, the generation date, and the latest applied migration. Trust it *for now*, but if you need certainty, introspect the live database rather than reading any file.
3. **`AGENTS.md`** — repo rules. Two matter constantly: this is Next.js 16 with breaking changes, so **read the relevant guide in `node_modules/next/dist/docs/` before writing code**; and GGG art may only be used to depict real in-game content.
4. Your auto-memory for this project already contains `build-planner-status`, `supabase-schema-file-is-stale`, `browser-verification-gotchas`, `mobile-first-design`, `test-account-credentials`, and `site-redesign-sequence`. Read them — they encode traps that cost real time.

---

## 2. What exists today

Build planner **Task 1 of 4** shipped to `main` on 2026-09-18 (`1ee9dab`). Working end to end, verified in a browser at 375px and desktop against the live database:

- `/tree` saves a build and reopens one at `/tree?build=<uuid>`
- `/builds` lists the signed-in user's builds, with rename and delete; the nav entry is live
- `POST /api/builds` — authenticated upsert, mints a 21-char `nanoid` share token, stamps `game_version`
- Pure converters (`src/lib/build/passiveState.ts`) with round-trip tests; a localStorage draft module
- 278 tests across 20 files

**Also landed 2026-09-18 (this session, branch `worktree-debt-d3-d4`):**
- A live ascendancy point counter (`Asc n/8`) in `TreeControls`, so the 8-point cap no longer refuses clicks silently
- `supabase/schema.sql` regenerated from the live database

**Not built:** gear (spec Task 2), gems (Task 3), public sharing/finder (Task 4).

---

## 3. The work being handed off

Do these in order. The ordering is a dependency chain, not a preference.

### D1 — Move the `/tree` build load server-side

`src/app/(dashboard)/tree/page.tsx` currently loads the build **client-side** in a `useEffect`, and that single decision produced four separate data-loss bugs across six fix rounds. Make the page a Server Component that awaits `searchParams`, fetches the row and the user with the cookie-scoped client, and passes the verified build down as a prop to a client component that owns only the canvas and the save panel.

Deleting, not relocating, is the point. This should remove:
- the client load effect and its `createClient()` query
- the `loadedFor` / `ready` gate
- the `queueMicrotask` workaround (it exists only to satisfy `react-hooks/set-state-in-effect`)
- the missing `.catch` on the load chain (today a rejected auth call leaves the editor on "Loading build…" forever)
- the in-component ownership check

**Why those bugs happened, so you don't reintroduce them:** the `/tree` route component **survives soft navigation**. Moving between `/tree?build=A`, `/tree?build=B` and plain `/tree` does not remount it, so any state it holds can be stale relative to the URL. Compounding that, `PassiveTree` consumes its `initialState` prop as **one-shot lazy state** and never re-reads it — so seeding it from a stale row is silent and permanent until something changes its `key`.

Read the current file's comments before deleting them; they document each trap precisely, and the same traps apply to whatever replaces them.

**Next 16 specifics, already verified:** on a server page, `searchParams` is a **`Promise`** (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`). `PassiveTree` is `dynamic(..., { ssr: false })` because it is a pixi.js/WebGL renderer — it must stay inside a client component.

### D5 — Move the `/builds` list server-side

Server Component fetches the user's builds; rename and delete become Server Functions with `revalidatePath`. This removes the duplicated query (currently written twice, in a `load` callback and a mount effect), the manual refetch, and the signed-out gating that had to be bolted on.

**Read `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md` first.** It carries a warning that matters here: Server Functions are reachable by **direct POST**, not only through your UI, so authentication and authorization must be verified **inside every one of them**. Do not assume the surrounding page's auth check protects them.

Note the tradeoff you are accepting: mutations become a server round-trip instead of an instant client update. That was judged worth it given the bug history.

### D2 — Wire up draft restore

`src/lib/build/draft.ts` writes a draft but nothing ever reads it, so a mid-edit refresh still loses work. **This is not simple laziness — the current design makes restore impossible**, and you must fix the design, not just add a call:

The draft key is `vaal:tree-draft:<classId>:<ascendancyId>`. Neither value is known until `PassiveTree` reports upward via `onStateChange` — and that first report happens on mount and **immediately overwrites the stored draft** with the freshly-seeded state. Any restore that runs after it will only ever find the value it just clobbered.

Agreed fix: **re-key drafts by build context** — `vaal:tree-draft:<buildId ?? 'scratch'>`. That is known at mount, so the draft can be read in a lazy `useState` initializer before any effect runs. Then show a small non-blocking prompt on the canvas — *"Unsaved changes from last time — Restore / Discard."* Restore re-seeds by bumping the component `key`; Discard calls `clearDraft`. The user explicitly chose prompt-on-restore over auto-restore.

This changes `draft.ts`'s exported signatures and its tests (`src/lib/build/__tests__/draft.test.ts`).

Do D2 **after** D1. Its prompt lives in the client component D1 creates; building it first means writing it twice.

### Then — Task 2, gear

Spec section "Task 2 — Gear". Do it after the migration, for the same reason: it adds state to the tree page, and porting it across a restructure is wasted work.

The spec already contains verified groundwork — 17 slot keys, the slot→wiki-category mapping (Appendix B), and rune socket counts (Appendix A). **Two traps are recorded there and are easy to get wrong:**
- Base items and uniques use *different spellings of the same category* (`LifeFlask` ×9 for bases vs `Life Flask` ×3 for uniques). Filtering on one spelling silently hides the other set entirely.
- `UtilityFlask` (13 entries) actually contains **charms**, not flasks — "Thawing Charm", "Antidote Charm" and so on. The charm slots must search `Charm` *and* `UtilityFlask`, or they will offer only the 12 unique charms.

Also recorded in the spec: `WikiSearchEntry` has **no icon field** (icons need `fetchWikiCardSnippet` at pick time), and the wiki index is **not memoized** — a 708KB item index is re-fetched per mount, so a shared module-level cache is a prerequisite before many pickers mount at once.

---

## 4. Database facts you must not get wrong

Verified directly against the live project (`mjxadehorflhncendqiy`) on 2026-09-17/18.

- `builds.visibility` is **`text`** with `CHECK (visibility IN ('private','unlisted','public'))`, default `'private'`. **There is no `is_public` column** — older docs claim there is.
- **Permissive RLS policies are OR-ed together, and the "Public builds are readable by anyone" policy applies to role `public`, which includes authenticated users.** So a signed-in user's plain `select` on `builds` returns their own rows **plus every public row**. A personal list *must* filter by `user_id` for scoping. That filter is display scoping only — RLS remains what enforces writes. Getting this wrong is how "Your builds" nearly shipped showing strangers' builds.
- `get_build_by_share_token(p_token)` is `SECURITY DEFINER` and returns rows where `visibility IN ('public','unlisted')`. **Task 4's public view must use it**, because the plain RLS select policy exposes `'public'` only — an unlisted build would look broken via a direct select.
- `increment_build_view_count` and `get_build_author_name` also exist and are already granted.
- `builds.passive_state`'s column default is `'{"set1": [], "set2": []}'` — it **lacks** `ascendancyNodes`. Never rely on the default; always write all three keys.
- `build_likes` exists with an anti-spam insert policy (the liking account must be ≥1 day old). Fork lineage columns (`forked_from`, `forked_from_name`, `forked_from_user`) and `main_skill` exist too, with `main_skill` indexed for public builds — the finder is designed to filter on it.
- Never use `createServiceClient()` for user-triggered work; it bypasses RLS and is reserved for cron/admin.

---

## 5. Verification — read before you try to test anything

Browser verification produced **false results three separate ways** last round. All fail quietly.

1. **`preview_start` runs the dev server from the session's original directory, not your worktree.** You will silently test `main` instead of your branch: new routes 404 and new UI is simply absent, which reads exactly like a broken feature. Start the server yourself from the worktree (`npm run dev -- -p <port>`) and confirm on a route that only exists on your branch.
2. **A fresh worktree has no `.env.local`** (it is gitignored, so `git worktree add` doesn't bring it). Without it every request 500s with "Your project's URL and Key are required to create a Supabase client!". Copy it from the main checkout; it stays ignored.
3. **The browser tool's `computer` key action delivers an empty key event** (`key: ""`, `code: ""`, `which: 0`) — verified by instrumenting a listener. Handlers checking `e.key === 'Enter'` or `'Escape'` never fire, so working code looks broken. Dispatch a real event instead: `el.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}))`. Likewise `form_input` and setting `.value` do **not** update a React controlled input's state — use the native setter plus an `input` event.
4. **`read_console_messages` returns a sticky per-tab buffer** that survives navigation and `console.clear()`. Open a fresh tab to confirm a console fix.
5. If the app window is minimized, pixel clicks fail with a screenshot timeout. A DOM `.click()` on a Next `<Link>` anchor still performs real client-side soft navigation — which is exactly what you need to exercise the stale-state paths.

**Test account** (in memory, authorized for reuse): `jayceemccullough+vaaltest@gmail.com`. It writes to the **real** production-linked Supabase project. Create test rows, then delete them, and verify the table is empty afterwards. Say so in chat when a verification step will write.

**Gates before every commit:** `npm run type-check` → `npm run lint` → `npm test` → `npm run build`. Report actual output, never expected. Baseline as of this handoff: type-check clean, lint clean, 278 tests across 20 files, build succeeds.

`react-hooks` lint rules here are strict — `set-state-in-effect` and `preserve-manual-memoization` both fired repeatedly last round. Satisfy them properly; prefer derivation over setState-in-effect. No disable comments, no `any`, no `@ts-expect-error`.

---

## 6. Process lessons from the last round

These are cheap to ignore and expensive to relearn.

- **Most bugs came from the plan, not the implementers.** Four of the defects reviewers found were reproduced verbatim from plan snippets. Read the real code *before* writing plan code, not after.
- **Commit your own doc edits immediately.** An implementer wiped an uncommitted plan amendment by cleaning its working tree. Never instruct an implementer to "make sure `git status` is clean" without scoping it to its own files.
- **Don't accept a reviewer's "inert" or "out of scope" without checking.** The most serious bug of the round was filed as a Minor by a task-scoped reviewer, on the grounds it was unreachable — it became reachable one task later. The controller holds cross-task context the reviewers structurally do not.
- **Verify implementer claims about gates.** One reported type-check clean while the fix that made it pass sat uncommitted in its working tree.
- **React keys only need to be unique among siblings — and must be.** Two siblings were given the same key, which React treats as unsupported; it only surfaced in the browser console, never in review.

---

## 7. Suggested first moves

1. Read the spec, this file, and the memory entries.
2. Read `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`, `06-fetching-data.md`, and `07-mutating-data.md` — this Next version differs from training data, and the mutation guide's direct-POST warning is load-bearing.
3. Work on a branch in a worktree (repo convention), never on `main`.
4. Treat D1 as architectural: it restructures a route and deletes a state model that took six fix rounds to stabilise. A short spec and plan before code is warranted; the previous round's spec and plan are in `docs/superpowers/specs/` and `docs/superpowers/plans/` as format references.
