# Server-Side Migration — D1 / D5 / D2 Implementation Plan

**Date:** 2026-09-20
**Branch:** `worktree-server-migration` (worktree at `C:/Dev/project-vaal-wt/server-migration`)
**Handoff:** `docs/superpowers/handoffs/2026-09-18-server-side-migration-kickoff.md`
**Spec:** `docs/superpowers/specs/2026-09-16-build-planner-design.md`

**Goal:** Move `/tree`'s build load and `/builds`'s list to the server, then wire draft restore on the client component the migration creates. Deleting the client-side load state model is the point — not relocating it.

**Next version here is 16.2.9.** `searchParams` on a server page is a `Promise`. `next/dynamic` with `ssr: false` is only legal inside a Client Component.

---

## Global constraints (read before writing any code)

- **`supabase/schema.sql` was regenerated 2026-09-18 and is currently accurate**, but `src/types/database.ts` (generated) is the type-level source of truth. Do not verify DB facts against older docs.
- **RLS's "Public builds are readable by anyone" policy applies to role `public`, which includes authenticated users.** A plain `select` on `builds` returns the caller's rows **plus every public row**. Every personal-scope read must filter `user_id` explicitly. That filter is *display scoping*; RLS is what enforces writes.
- **Never use `createServiceClient()`** for user-triggered work.
- **Server Functions are reachable by direct POST**, not only through your UI (`node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`, the WARNING block). Verify authentication **and** authorization inside every one of them. Do not rely on the surrounding page's auth check.
- **Never rely on the `passive_state` column default** — it lacks `ascendancyNodes`. Always write all three keys.
- **Mobile-first.** Unprefixed Tailwind classes must be a complete phone experience; `md:` adds desktop.
- **`react-hooks` lint here is strict.** `set-state-in-effect` and `preserve-manual-memoization` both fire readily. Satisfy them properly — prefer derivation over setState-in-effect. **No `eslint-disable`, no `any`, no `@ts-expect-error`.**
- **Gates before every commit:** `npm run type-check` → `npm run lint` → `npm test` → `npm run build`. **Report actual output, never expected.** Baseline on this branch: type-check clean, lint clean, **278 tests / 20 files**, build succeeds.
- Two different `createClient`s exist: `@/lib/supabase/server` (cookie-scoped, `async`, server only) and `@/lib/supabase/client` (browser, sync). They are not interchangeable.

---

## Architecture decision — the component split

The handoff says "pass the verified build down as a prop to a client component." This plan splits that into **two** client components, deliberately:

```
src/app/(dashboard)/tree/page.tsx          SERVER — awaits searchParams, fetches + verifies the row
└── TreeEditor              (client)       build-AGNOSTIC: owns only the 5.1MB tree-export fetch.
                                           NOT keyed. Survives soft navigation on purpose.
    └── TreeBuildSession    (client)       key={buildId ?? 'scratch'} — owns ALL build-scoped state
        ├── PassiveTree                    (no key of its own except the draft-restore reseed key)
        └── BuildSavePanel
```

**Why two, not one.** `public/data/tree/0.5.2/data.json` is **5,141,380 bytes**. Keying a single client component on `buildId` would re-run that fetch and its `JSON.parse` on every build switch. Hoisting it into an unkeyed parent keeps it alive across switches. The parent is safe to leave unkeyed precisely *because* it holds nothing build-derived — the class of bug this migration exists to delete cannot live there.

**What this does not fix, and that is accepted:** `normalizeGggTree` runs inside `PassiveTree`'s own `useMemo`, so it still re-runs when `TreeBuildSession` remounts. That is today's behaviour already (`PassiveTree` is currently keyed by `buildId`), so this is not a regression. Do **not** restructure `PassiveTree`'s internals to chase it — out of scope.

**Why keying works at all.** The bug history is that the `/tree` route component survives soft navigation, so its state goes stale relative to the URL, and `PassiveTree` consumes `initialState` as one-shot lazy state that it never re-reads. Keying `TreeBuildSession` by `buildId` makes React unmount and remount the entire build-scoped subtree whenever the URL's build changes. There is then **no build-derived state that can outlive its build** — which is why every piece of that old state model gets deleted rather than moved.

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `src/app/(dashboard)/tree/page.tsx` | **Rewrite** | Server Component: await `searchParams`, fetch + verify the build, render `TreeEditor` |
| `src/components/tree/TreeEditor.tsx` | **Create** | Client: tree-export fetch only |
| `src/components/tree/TreeBuildSession.tsx` | **Create** | Client: editor state, save, draft prompt |
| `src/app/(dashboard)/builds/page.tsx` | **Rewrite** | Server Component: fetch the user's builds |
| `src/app/(dashboard)/builds/actions.ts` | **Create** | `'use server'` — `renameBuild`, `deleteBuild` |
| `src/components/builds/MyBuildsList.tsx` | **Rewrite** | Client: presentational list + action invocation, no data fetching |
| `src/lib/build/draft.ts` | **Rewrite** | Re-key drafts by build context |
| `src/lib/build/__tests__/draft.test.ts` | **Rewrite** | Follow the new signatures |
| `src/lib/build/draftCompare.ts` | **Create** | Pure: does a draft differ from a saved build? |
| `src/lib/build/__tests__/draftCompare.test.ts` | **Create** | Coverage for the above |

---

# D1 — `/tree` build load moves server-side

### Task D1.1 — Server page

**File:** rewrite `src/app/(dashboard)/tree/page.tsx`

- [ ] **Step 1: Delete `'use client'` and everything it enabled.** The following must not appear anywhere in the new page *or* in the new client components. Each is listed with the bug it caused, so you can tell whether you have genuinely removed it or merely renamed it:
  - the client build-load `useEffect` and its `createClient()` query — the origin of all four data-loss bugs
  - `loadedFor` / `ready` — a readiness gate that only existed because the load was async on the client
  - the `queueMicrotask` workaround — it exists only to satisfy `react-hooks/set-state-in-effect`
  - the `build` / `scratchBuild` two-slice model and `activeBuild` — six fix rounds of stale-state defence, made unnecessary by keying
  - `saveStatusFor` / `displaySaveError` / `displaySavedAt` — same; the panel now remounts per build
  - `useSearchParams` and the `<Suspense>` wrapper that existed to satisfy it
  - the missing `.catch` on the load chain (today a rejected auth call leaves the editor on "Loading build…" forever)

  Read the current file's comments before deleting them. They document each trap precisely and several of the traps still apply to the replacement — carry the reasoning forward into new comments where it still bites, rather than dropping it.

- [ ] **Step 2: Write the server page.**

```tsx
// /tree — passive skill tree editor.
//
// Server Component. It awaits ?build=<uuid>, fetches and VERIFIES the row,
// and hands the result down as props. Nothing about the loaded build is
// client state any more, which is what makes the stale-state class of bug
// (this route survives soft navigation; PassiveTree seeds initialState
// exactly once) unreachable rather than merely defended against.
import { createClient, getCachedUser } from '@/lib/supabase/server';
import type { SavedBuild } from '@/lib/build/types';
import TreeEditor from '@/components/tree/TreeEditor';

export const metadata = { title: 'Passive tree' };

// ?build= is a UUID; /builds/[shareToken] is a 21-char nanoid. Shape-check
// before querying so a junk value returns our own "not found" copy instead
// of a Postgres 22P02 (invalid input syntax for type uuid) round-trip.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TreePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const raw = params.build;
  const buildId = typeof raw === 'string' ? raw : undefined;

  let build: SavedBuild | null = null;
  let loadError: string | null = null;

  if (buildId) {
    if (!UUID_RE.test(buildId)) {
      loadError = 'That build could not be found.';
    } else {
      const supabase = await createClient();
      const [{ data: userData }, { data, error }] = await Promise.all([
        getCachedUser(),
        supabase.from('builds').select('*').eq('id', buildId).maybeSingle(),
      ]);
      if (error) {
        console.error('Failed to load build:', error);
        loadError = 'That build could not be found.';
      } else if (!data || data.user_id !== userData.user?.id) {
        // A row can come back that is NOT ours: the "Public builds are
        // readable by anyone" RLS policy is permissive and applies to role
        // `public`, which includes authenticated users. Postgres ORs it with
        // the owner policy. So ownership is checked here, on the server.
        //
        // This is a RELOCATION of the old in-component check, not a deletion
        // of it — removing it entirely would hydrate a stranger's build as
        // editable, with every Update 404ing. "Exists but not ours" and
        // "does not exist" deliberately produce the same message so the UI
        // cannot be used to probe which build ids exist.
        loadError = 'That build could not be found.';
      } else {
        build = data as unknown as SavedBuild;
      }
    }
  }

  return <TreeEditor buildId={buildId} build={build} loadError={loadError} />;
}
```

  Notes the implementer must respect:
  - `getCachedUser()` is React-`cache`d per request. Use it, not a second `supabase.auth.getUser()`.
  - The two awaits run in `Promise.all` so ownership verification costs no extra latency, matching what the client code did.
  - Scratch mode (`/tree` with no `?build=`) makes **zero** database calls. Keep it that way.
  - `/tree` is in `PROTECTED_PREFIXES` (`src/proxy.ts`), so there is no signed-out path to render. Do not add one.
  - Do **not** add a `<Suspense>` boundary or a `loading.tsx` unless a gate forces it. The query is a single primary-key lookup.

### Task D1.2 — `TreeEditor` (build-agnostic client shell)

**File:** create `src/components/tree/TreeEditor.tsx`

- [ ] **Step 1:** `'use client'`. Move here, unchanged in behaviour: the `TREE_VERSION = '0.5.2'` constant, the `PassiveTree` `dynamic(..., { ssr: false })` import, the `raw`/`error` state and its fetch effect, and the outer `fixed inset-x-0 bottom-16 top-20 touch-none select-none md:bottom-0 md:left-60 md:top-0` div with its comments.

- [ ] **Step 2:** Props are `{ buildId?: string; build: SavedBuild | null; loadError: string | null }`. Render the error / loading branches exactly as today, then:

```tsx
<TreeBuildSession
  key={buildId ?? 'scratch'}
  raw={raw}
  buildId={buildId}
  build={build}
  loadError={loadError}
  PassiveTree={PassiveTree}
/>
```

  **Decide one way and comment it:** either pass the `dynamic()` component down as a prop (as above) or declare the `dynamic()` import inside `TreeBuildSession` instead. Passing it down keeps the module-level `dynamic()` call in one place and out of the remounting component; declaring it in the child is simpler to read. Either is correct — `dynamic()` is module-level and memoised either way, so neither re-downloads the chunk. Pick one, do not do both.

- [ ] **Step 3:** Delete the `!ready` / "Loading build…" branch entirely. There is no client-side build load left to wait for.

### Task D1.3 — `TreeBuildSession` (build-scoped client component)

**File:** create `src/components/tree/TreeBuildSession.tsx`

- [ ] **Step 1:** `'use client'`. Owns, and only owns: `editorState`, the save call, and (after D2) the draft prompt.

- [ ] **Step 2:** Derive `initialState` from the `build` prop with `useMemo` over `fromPassiveState`. Because this component is keyed by `buildId`, `build` can never belong to a different build than the one being rendered — so the `activeBuild` guard the old code needed is gone. Say that in a comment; it is the whole justification for the deletion.

- [ ] **Step 3:** Port `handleSave` with these changes:
  - `activeBuild?.id` becomes `build?.id` for an existing row, **plus** a local `useState<SavedBuild | null>(null)` for a row created by a scratch-mode save (`createdBuild`). The id sent on save is `build?.id ?? createdBuild?.id`.
  - **This local state is safe where the old `scratchBuild` was not**, because the component remounts when `buildId` changes. Comment it, or a future reader will reintroduce the old defences.
  - On success in scratch mode, keep the returned row in `createdBuild` so a second tap updates rather than inserting a duplicate. Do **not** navigate or rewrite the URL — changing `?build=` would remount this component via the key and is an unrequested behaviour change.
  - `saveError` / `savedAt` become plain state. `saveStatusFor` is deleted: the panel remounts with this component, so a result can no longer leak across builds.
- [ ] **Step 4:** `error` passed to `BuildSavePanel` is `saveError ?? (createdBuild ? null : loadError)`.

  **Corrected 2026-09-20 — the original instruction here said "stays `saveError ?? loadError`, as today" and that was wrong.** It described the expression but not the stateful clearing the old code paired with it: the old version called `setLoadError(null)` on save success. `loadError` is an immutable prop now, so a stale "That build could not be found." would survive a *successful* save forever. Repro: open `/tree?build=<deleted or not-yours uuid>` → `loadError` set, `build` null → allocate → Save → the insert succeeds and `createdBuild` is set, but the banner still reads "That build could not be found.", and `BuildSavePanel`'s `{savedAt && !error}` branch never renders the "Saved" confirmation. Indistinguishable from a hard failure for the rest of the session.

  Derive it, do not store-and-clear it — clearing a prop-mirroring state inside an effect is exactly what `react-hooks/set-state-in-effect` rejects here.
- [ ] **Step 5:** `BuildSavePanel` no longer needs its own `key` — its parent is keyed. Remove it. (React keys must be unique among siblings; two siblings shared a key in an earlier round. Do not reintroduce that.)

### Task D1.4 — Gates and commit

- [ ] Run all four gates. Paste the real output into your report.
- [ ] Commit D1 alone, before starting D5.

---

# D5 — `/builds` list moves server-side

### Task D5.1 — Server Functions

**File:** create `src/app/(dashboard)/builds/actions.ts`

- [ ] **Step 1:** `'use server'` at the top of the file.
- [ ] **Step 2:** Both functions follow this shape. **The auth check and the `user_id` filter are mandatory in each**, per the direct-POST warning — do not hoist them into the page.

```ts
'use server';

// Server Functions for the builds list.
//
// These are reachable by a direct POST, not only through our UI, so every one
// of them re-verifies the session itself — the page's auth check protects the
// page, not these. (next/dist/docs/01-app/01-getting-started/07-mutating-data.md)
//
// The .eq('user_id', ...) filters are defence in depth: RLS's owner policy is
// what actually enforces the write, but the permissive "public builds" policy
// means a bare .eq('id', ...) is never something to reason about casually here.
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function renameBuild(id: string, name: string): Promise<ActionResult> { /* ... */ }
export async function deleteBuild(id: string): Promise<ActionResult> { /* ... */ }
```

  Requirements for both:
  - Validate `id` is a string matching the same `UUID_RE` shape; reject otherwise. Export the regex from a shared module rather than copying it a third time — put it in `src/lib/build/constants.ts`.
  - `renameBuild` trims `name`, rejects empty, and caps length at **80** characters (`builds.name` has no CHECK constraint, so this is ours to impose; pick 80 and state it in a comment).
  - Return `{ ok: false, error: <user-facing string> }` rather than throwing, so the client can render an inline error. Log the underlying Supabase error with `console.error` and do **not** put it in the returned string.
  - A zero-row result (not ours, or gone) returns `{ ok: false, error: "Couldn't find that build." }` — the same message for both, for the same non-enumeration reason as `/tree`.
  - Call `revalidatePath('/builds')` **only on success**.

- [ ] **Step 3:** Add unit-free sanity: these touch the network, so there is no test harness for them. Their correctness is proven by the browser pass in the verification section.

### Task D5.2 — Server page

**File:** rewrite `src/app/(dashboard)/builds/page.tsx`

- [ ] **Step 1:** Make it `async`. Call `getCachedUser()`.
- [ ] **Step 2:** **`/builds` is deliberately NOT in `PROTECTED_PREFIXES`** — it is public, because Task 4 puts the public build finder here. So a signed-out visitor must still render: keep the existing "Sign in to see your saved builds" block with its `/login` link, now rendered on the server. Do not redirect.
- [ ] **Step 3:** When signed in, fetch:

```ts
const { data, error } = await supabase
  .from('builds')
  .select('*')
  .eq('user_id', user.id)              // display scoping — see global constraints
  .order('updated_at', { ascending: false });
```

- [ ] **Step 4:** Pass `builds` and `loadError` to `MyBuildsList` as props, plus the two Server Functions as props named with the `Action` suffix (`renameAction`, `deleteAction`) — that suffix is what the Next lint rules expect for an action passed across the client boundary.

### Task D5.3 — `MyBuildsList` becomes presentational

**File:** rewrite `src/components/builds/MyBuildsList.tsx`

- [ ] **Step 1:** Delete all four of these and their comments: the `user` state and its auth check, the duplicated `builds` query (**it is currently written twice** — once in the `load` callback and once inline in the mount effect), the `load()` refetch helper, and the signed-out branch (now the server's job).
- [ ] **Step 2:** Keep exactly as-is: the list markup, the `h-11` tap targets, the rename-inline `Input`, the two-step delete confirm, and **`cancelRenameRef`**. That ref is not incidental — unmounting the focused `<Input>` fires a native blur that React still delivers to `onBlur`, so without it Escape-then-blur commits the rename the user just cancelled. Carry its comment across verbatim.
- [ ] **Step 3:** Mutations become:

```tsx
const [pending, startTransition] = useTransition();
// ...
startTransition(async () => {
  const result = await renameAction(id, name);
  if (!result.ok) setError(result.error);
});
```

  `revalidatePath` in the action refreshes the `builds` prop; there is no local list state to update and no refetch to call.
- [ ] **Step 4:** Use `pending` to disable the Rename/Delete controls while an action is in flight. **Accept the tradeoff explicitly in a comment:** mutations are now a server round-trip instead of an instant client update. The handoff judged that worth it given the bug history.
- [ ] **Step 5:** Keep the current error behaviour: a failure once the list is populated renders as a banner **above** the list, never blanking it out.

### Task D5.4 — Gates and commit

- [ ] All four gates, real output. Commit D5 alone.

---

# D2 — Draft restore

Do this **after** D1. Its prompt lives in `TreeBuildSession`.

**The current design makes restore impossible, and the fix is a design change, not an added call.** The key is `vaal:tree-draft:<classId>:<ascendancyId>`; neither value is known until `PassiveTree` reports upward via `onStateChange` — and that first report fires on mount and **immediately overwrites the stored draft** with the freshly-seeded state. Any restore running after it can only ever find the value it just clobbered.

### Task D2.1 — Re-key drafts

**File:** rewrite `src/lib/build/draft.ts`

- [ ] **Step 1:** New key: `vaal:tree-draft:<buildId ?? 'scratch'>`. Known at mount, so a lazy `useState` initialiser can read it before any effect runs.
- [ ] **Step 2:** New signatures:

```ts
export function draftKey(buildId: string | undefined): string;
export function saveDraft(buildId: string | undefined, state: BuildEditorState): void;
export function loadDraft(buildId: string | undefined): BuildEditorState | null;
export function clearDraft(buildId: string | undefined): void;
```

  Keep every `try`/`catch` — a private window or blocked site data must never break the editor.
- [ ] **Step 3:** `loadDraft` must validate the parsed shape before returning it, not just cast. A stale draft written by the *old* key scheme, or hand-edited localStorage, must yield `null` rather than a malformed object that reaches `PassiveTree`. Check that `main`, `main.allocated` and `ascendancyNodes` are arrays and `classId` is a number.
- [ ] **Step 4:** Update `src/lib/build/__tests__/draft.test.ts` to the new signatures, and add a case for Step 3's malformed-input rejection.

### Task D2.2 — Is the draft actually different?

**File:** create `src/lib/build/draftCompare.ts` (+ tests)

- [ ] **Step 1:** Without this, **every visit to a saved build shows a bogus "unsaved changes" prompt**, because the mount report writes a draft identical to what was just loaded. Export one pure function:

```ts
export function draftDiffersFrom(
  draft: BuildEditorState,
  build: Pick<SavedBuild, 'class' | 'ascendancy' | 'passive_state'> | null,
): boolean;
```

- [ ] **Step 2:** Behaviour:
  - `build === null` (scratch mode): the draft is meaningful only if anything is allocated at all — return true when `draft.main.allocated.length > 0 || draft.ascendancyNodes.length > 0`. An untouched scratch session must not prompt.
  - Otherwise compare `draft.className` against `build.class`, `draft.ascendancyId ?? null` against `build.ascendancy`, and `toPassiveState(draft.main, draft.ascendancyNodes)` against `build.passive_state` **with each of `set1`, `set2`, `ascendancyNodes` sorted numerically before comparison** — array order is not meaningful and the converters make no ordering guarantee.
- [ ] **Step 3:** Test: identical round-trip returns false; a single extra node returns true; reordered arrays return false; class change returns true; empty scratch returns false; allocated scratch returns true.

### Task D2.3 — The prompt

**File:** modify `src/components/tree/TreeBuildSession.tsx`

- [ ] **Step 1:** Read the draft in a **lazy `useState` initialiser**, so it is captured before `PassiveTree`'s mount effect overwrites it:

```tsx
// Lazy initialiser, NOT an effect. PassiveTree reports its seeded state
// upward on mount, and our save-draft effect writes that report straight
// over the stored draft — so anything reading the draft after mount can
// only ever find the value it just clobbered. Reading here, during the
// first render, is the only point at which the previous session's draft
// still exists. Keyed remount per build makes this per-build correct.
const [storedDraft] = useState(() => loadDraft(buildId));
```

- [ ] **Step 2:** Compute `showPrompt` with `draftDiffersFrom(storedDraft, build)` guarded on `storedDraft !== null`, held in state so Restore/Discard can dismiss it.
- [ ] **Step 3:** **Restore** re-seeds by bumping a `seedKey` counter that feeds `PassiveTree`'s `key`, with `initialState` switched to the draft's values. **Discard** calls `clearDraft(buildId)` and dismisses. The user explicitly chose prompt-on-restore over auto-restore — do not auto-restore.
- [ ] **Step 4:** Non-blocking chip on the canvas: *"Unsaved changes from last time — Restore / Discard."* Follow the established overlay recipe — `absolute`, `z-10`, `bg-card/95 backdrop-blur`, `h-11` tap targets, positioned so it does not collide with `TreeControls` (`left-3 top-3`), `BuildSavePanel` (`right-3 top-3`), or `NodeInfoPanel` (`inset-x-3 bottom-3`). Verify at 375px.
- [ ] **Step 5:** Update the draft-save effect and the `clearDraft` call in `handleSave` to the new signatures.

### Task D2.4 — Gates and commit

- [ ] All four gates, real output. Commit D2 alone.

---

## Verification — read before testing anything

Browser verification produced false results **three separate ways** last round. All fail quietly.

1. **Do not use `preview_start` for the dev server.** It runs from the session's original directory, not this worktree — you would silently test `main`. Start it yourself from the worktree: `npm run dev -- -p 3100`, then confirm you are on the branch by checking something that only exists here.
2. `.env.local` is gitignored, so a fresh worktree has none and every request 500s with "Your project's URL and Key are required to create a Supabase client!". **Already copied in for this worktree** — do not delete it, do not commit it.
3. **The browser tool's `computer` key action delivers an empty key event** (`key: ""`, `code: ""`, `which: 0`), so `e.key === 'Enter'` / `'Escape'` handlers never fire and working code looks broken. Dispatch a real one: `el.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}))`. Likewise `form_input` and setting `.value` do not update a React controlled input — use the native setter plus an `input` event.
4. **`read_console_messages` returns a sticky per-tab buffer** that survives navigation and `console.clear()`. Open a fresh tab to confirm a console fix.
5. A minimized app window makes pixel clicks fail with a screenshot timeout. A DOM `.click()` on a Next `<Link>` anchor still performs a real client-side soft navigation — which is exactly the path these bugs live on.

**Test account:** `jayceemccullough+vaaltest@gmail.com`. It writes to the **real** production-linked Supabase project. Create test rows, delete them, and verify afterwards. Say so in chat before a step that writes.

### Scenarios that must pass

The first five are the exact paths that produced the six fix rounds. Drive navigation with `<Link>` clicks (soft navigation), never a full reload, or the test proves nothing.

- [ ] Create build A in scratch mode; save; tap Update again — **one** row, not two.
- [ ] `/builds` → open A → edit → Update → back to `/builds`: A's name/level/league are right and no second row appeared.
- [ ] Soft-navigate `/tree?build=A` → `/tree?build=B`: the canvas shows B's allocation, not A's.
- [ ] Soft-navigate `/tree?build=A` → `/tree` (plain): scratch mode is empty, and an Update there does **not** overwrite A.
- [ ] `/tree?build=<valid uuid that is not yours>` and `/tree?build=garbage`: both show "That build could not be found." and neither 500s.
- [ ] Rename on `/builds` commits on Enter and on blur; Escape cancels and the subsequent blur does **not** commit it.
- [ ] Delete asks for confirmation, then the row is gone from the list after the revalidate.
- [ ] D2: allocate nodes, refresh without saving → prompt appears; Restore re-seeds; Discard clears. Open a saved build and immediately refresh → **no** prompt.
- [ ] All of the above at a **375px** viewport first, then desktop.
- [ ] Delete every row created during verification and confirm the table is clean.
