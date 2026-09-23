# Build Planner — Task 1: Persistence Implementation Plan

> ## ✅ COMPLETE — HISTORICAL RECORD. Read `docs/superpowers/CURRENT-STATE.md` for what is true now.
>
> Task 1 shipped. One factual claim is now false: `builds.visibility` defaults
> to `'unlisted'`, not `'private'`, and the meanings of those two words were
> swapped on 2026-09-23. Verified live on that date.


> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the passive tree editor's allocation savable to and loadable from `public.builds`, and give users a private list of their saved builds.

**Architecture:** The `/tree` page becomes the owner of the build record; `PassiveTree` gains two props (`initialState` to hydrate, `onStateChange` to report) rather than being refactored internally. Saves go through a new authenticated route handler that mints the share token server-side; all other build mutations go direct from the client and lean on RLS. A pure converter module translates between the editor's in-memory allocation shape and the database's `passive_state` JSON shape, and is the only part of this task with real unit-test coverage.

**Tech Stack:** Next.js (App Router, Route Handlers), TypeScript, Supabase (`@supabase/ssr`), `nanoid`, vitest, Tailwind, `radix-ui`.

**Spec:** `docs/superpowers/specs/2026-09-16-build-planner-design.md`

## Global Constraints

- **`supabase/schema.sql` is stale. Never verify anything against it.** Use `src/types/database.ts` (generated, correct) or query the live database.
- **`builds.visibility`** is `text` with CHECK `('private','unlisted','public')`, default `'private'`. There is no `is_public` column.
- **Never rely on the `passive_state` column default** — its live value is `{"set1": [], "set2": []}` and lacks `ascendancyNodes`. Always write all three keys.
- **Never use `createServiceClient()`** for anything user-triggered. It bypasses RLS and is reserved for cron/admin.
- **Ownership is enforced by RLS**, never by application-level `user_id` comparison. `user_id` comes from the validated session, never from a request body.
- **Mobile-first.** Unprefixed Tailwind classes must be a complete good phone experience; `md:` adds desktop. Verify at 375px before desktop.
- **Ascendancy point cap is 8.**
- **Game version constant is `'0.5.5'`.** Never rely on the `game_version` column default (`'0.2.0'`, stale).
- **Two different `createClient` functions exist.** `@/lib/supabase/server` (cookie-scoped, async, server only) and `@/lib/supabase/client` (browser singleton, sync). Import the right one; they are not interchangeable.
- **Gates before every commit:** `npm run type-check` → `npm run lint` → `npm test` → `npm run build`. Report actual output, never expected output.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/build/types.ts` | Shared build-state TypeScript types |
| `src/lib/build/constants.ts` | `GAME_VERSION`, `MAX_ASCENDANCY_POINTS` |
| `src/lib/build/passiveState.ts` | Pure converters between editor allocation and `passive_state` JSON |
| `src/lib/build/__tests__/passiveState.test.ts` | Round-trip and edge-case coverage for the converters |
| `src/lib/build/draft.ts` | localStorage draft read/write/clear, all guarded |
| `src/lib/build/__tests__/draft.test.ts` | Draft serialisation + storage-unavailable behaviour |
| `src/app/api/builds/route.ts` | `POST` — authenticated upsert, mints `share_token` on insert |
| `src/components/tree/PassiveTree.tsx` | Modify: add `initialState` / `onStateChange` props, enforce ascendancy cap |
| `src/components/tree/BuildSavePanel.tsx` | Overlay panel: name/level/league fields + Save button |
| `src/app/(dashboard)/tree/page.tsx` | Modify: own build record, read `?build=`, hydrate, wire save |
| `src/app/(dashboard)/builds/page.tsx` | `/builds` route shell |
| `src/components/builds/MyBuildsList.tsx` | Private list: open / rename / delete |
| `src/components/layout/shell-chrome.tsx` | Modify: flip `/builds` to `live: true` |

---

### Task 1: Build state types and constants

**Files:**
- Create: `src/lib/build/types.ts`
- Create: `src/lib/build/constants.ts`

**Interfaces:**
- Consumes: `WeaponSetAllocation` from `@poe2-toolkit/tree-core`
- Produces: `PassiveState`, `BuildEditorState`, `BuildVisibility`, `SavedBuild`, `GAME_VERSION`, `MAX_ASCENDANCY_POINTS`

- [ ] **Step 1: Create the types module**

```ts
// src/lib/build/types.ts
import type { WeaponSetAllocation } from '@poe2-toolkit/tree-core';

/** Matches the CHECK constraint on public.builds.visibility. */
export type BuildVisibility = 'private' | 'unlisted' | 'public';

/**
 * The shape stored in builds.passive_state.
 *
 * A node tagged to neither weapon set (shared/basic) appears in BOTH set1 and
 * set2 — "in both" is how the storage format spells "untagged". The column
 * default omits ascendancyNodes, so every write must supply all three keys.
 */
export interface PassiveState {
  set1: number[];
  set2: number[];
  ascendancyNodes: number[];
}

/**
 * The editor's in-memory allocation, as PassiveTree reports it upward.
 *
 * Carries BOTH classId and className deliberately. classId is tree-core's
 * index and is meaningless without the normalized tree; className is what
 * builds.class stores. Reporting the name means the page never has to
 * normalize the tree export itself just to translate an index — PassiveTree
 * already holds the normalized data, so it does the mapping.
 */
export interface BuildEditorState {
  classId: number;
  className: string;
  ascendancyId: string | undefined;
  main: WeaponSetAllocation;
  ascendancyNodes: number[];
}

/**
 * What the page hands PassiveTree to hydrate a saved build. Keyed by class
 * NAME, not id, because that is what came out of the database.
 */
export interface PassiveTreeInitialState {
  className: string | undefined;
  ascendancyId: string | undefined;
  main: WeaponSetAllocation;
  ascendancyNodes: number[];
}

/** A build row as the save route returns it. */
export interface SavedBuild {
  id: string;
  name: string;
  class: string;
  ascendancy: string | null;
  level: number;
  league: string;
  visibility: BuildVisibility;
  share_token: string | null;
  game_version: string;
  passive_state: PassiveState;
  updated_at: string;
}
```

- [ ] **Step 2: Create the constants module**

```ts
// src/lib/build/constants.ts

/**
 * Current PoE2 patch, stamped onto every save.
 *
 * Hand-bumped, mirroring TREE_VERSION and WIKI_DATA_VERSION. The
 * builds.game_version column default is '0.2.0' and is years of patches
 * stale — never rely on it, always pass this explicitly.
 */
export const GAME_VERSION = '0.5.5';

/** 8 total: 2 per trial completion, up to 4 completions. */
export const MAX_ASCENDANCY_POINTS = 8;
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run type-check`
Expected: PASS, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/build/types.ts src/lib/build/constants.ts
git commit -m "feat(build): add build state types and version constants"
```

---

### Task 2: Passive state converters

**Files:**
- Create: `src/lib/build/passiveState.ts`
- Test: `src/lib/build/__tests__/passiveState.test.ts`

**Interfaces:**
- Consumes: `PassiveState`, `BuildEditorState` from Task 1; `WeaponSetAllocation` from `@poe2-toolkit/tree-core`
- Produces:
  - `toPassiveState(main: WeaponSetAllocation, ascendancyNodes: number[]): PassiveState`
  - `fromPassiveState(state: PassiveState): { main: WeaponSetAllocation; ascendancyNodes: number[] }`

**Encoding rules (the whole point of this task):**

| Editor | Stored |
|---|---|
| `weaponSets[id] === 1` | `set1` only |
| `weaponSets[id] === 2` | `set2` only |
| `id` allocated, no `weaponSets` entry | **both** `set1` and `set2` |

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/build/__tests__/passiveState.test.ts
import { describe, it, expect } from 'vitest';
import { toPassiveState, fromPassiveState } from '@/lib/build/passiveState';
import type { WeaponSetAllocation } from '@poe2-toolkit/tree-core';

describe('toPassiveState', () => {
  it('puts an untagged node in both sets', () => {
    const main: WeaponSetAllocation = { allocated: [10], weaponSets: {} };
    expect(toPassiveState(main, [])).toEqual({
      set1: [10],
      set2: [10],
      ascendancyNodes: [],
    });
  });

  it('puts a set-1 node in set1 only', () => {
    const main: WeaponSetAllocation = { allocated: [10], weaponSets: { 10: 1 } };
    expect(toPassiveState(main, [])).toEqual({
      set1: [10],
      set2: [],
      ascendancyNodes: [],
    });
  });

  it('puts a set-2 node in set2 only', () => {
    const main: WeaponSetAllocation = { allocated: [10], weaponSets: { 10: 2 } };
    expect(toPassiveState(main, [])).toEqual({
      set1: [],
      set2: [10],
      ascendancyNodes: [],
    });
  });

  it('keeps ascendancy nodes in their own list', () => {
    const main: WeaponSetAllocation = { allocated: [], weaponSets: {} };
    expect(toPassiveState(main, [7, 8])).toEqual({
      set1: [],
      set2: [],
      ascendancyNodes: [7, 8],
    });
  });

  it('handles a mixed allocation', () => {
    const main: WeaponSetAllocation = {
      allocated: [1, 2, 3],
      weaponSets: { 2: 1, 3: 2 },
    };
    expect(toPassiveState(main, [99])).toEqual({
      set1: [1, 2],
      set2: [1, 3],
      ascendancyNodes: [99],
    });
  });
});

describe('fromPassiveState', () => {
  it('treats a node in both sets as untagged', () => {
    const result = fromPassiveState({ set1: [10], set2: [10], ascendancyNodes: [] });
    expect(result.main.allocated).toEqual([10]);
    expect(result.main.weaponSets).toEqual({});
  });

  it('treats a set1-only node as tagged 1', () => {
    const result = fromPassiveState({ set1: [10], set2: [], ascendancyNodes: [] });
    expect(result.main.weaponSets).toEqual({ 10: 1 });
  });

  it('treats a set2-only node as tagged 2', () => {
    const result = fromPassiveState({ set1: [], set2: [10], ascendancyNodes: [] });
    expect(result.main.weaponSets).toEqual({ 10: 2 });
  });

  it('tolerates a missing ascendancyNodes key from the stale column default', () => {
    const legacy = { set1: [1], set2: [1] } as unknown as {
      set1: number[];
      set2: number[];
      ascendancyNodes: number[];
    };
    expect(fromPassiveState(legacy).ascendancyNodes).toEqual([]);
  });
});

describe('round trip', () => {
  it('survives a mixed allocation unchanged', () => {
    const main: WeaponSetAllocation = {
      allocated: [1, 2, 3, 4],
      weaponSets: { 2: 1, 3: 2 },
    };
    const ascendancyNodes = [50, 51];
    const back = fromPassiveState(toPassiveState(main, ascendancyNodes));
    expect([...back.main.allocated].sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
    expect(back.main.weaponSets).toEqual({ 2: 1, 3: 2 });
    expect(back.ascendancyNodes).toEqual(ascendancyNodes);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/build/__tests__/passiveState.test.ts`
Expected: FAIL — cannot resolve `@/lib/build/passiveState`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/build/passiveState.ts
import type { WeaponSetAllocation, WeaponSet } from '@poe2-toolkit/tree-core';
import type { PassiveState } from '@/lib/build/types';

/**
 * Editor allocation -> stored shape.
 *
 * An untagged node is written into BOTH sets: the storage format has no
 * "shared" marker, so presence in both is what shared means. fromPassiveState
 * reverses this, and the pair must stay in sync.
 */
export function toPassiveState(
  main: WeaponSetAllocation,
  ascendancyNodes: number[],
): PassiveState {
  const set1: number[] = [];
  const set2: number[] = [];

  for (const id of main.allocated) {
    const tag = main.weaponSets[id];
    if (tag === 1) set1.push(id);
    else if (tag === 2) set2.push(id);
    else {
      set1.push(id);
      set2.push(id);
    }
  }

  return { set1, set2, ascendancyNodes: [...ascendancyNodes] };
}

/** Stored shape -> editor allocation. Inverse of toPassiveState. */
export function fromPassiveState(state: PassiveState): {
  main: WeaponSetAllocation;
  ascendancyNodes: number[];
} {
  const set1 = state.set1 ?? [];
  const set2 = state.set2 ?? [];
  const inSet2 = new Set(set2);

  const allocated: number[] = [];
  const weaponSets: Record<number, WeaponSet> = {};

  for (const id of set1) {
    allocated.push(id);
    if (!inSet2.has(id)) weaponSets[id] = 1;
  }

  const inSet1 = new Set(set1);
  for (const id of set2) {
    if (inSet1.has(id)) continue;
    allocated.push(id);
    weaponSets[id] = 2;
  }

  return {
    main: { allocated, weaponSets },
    ascendancyNodes: [...(state.ascendancyNodes ?? [])],
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/build/__tests__/passiveState.test.ts`
Expected: PASS, all cases green.

- [ ] **Step 5: Run the full gates**

Run: `npm run type-check` then `npm run lint` then `npm test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/build/passiveState.ts src/lib/build/__tests__/passiveState.test.ts
git commit -m "feat(build): add passive state converters with round-trip tests"
```

---

### Task 3: Save route handler

**Files:**
- Create: `src/app/api/builds/route.ts`

**Interfaces:**
- Consumes: `GAME_VERSION` (Task 1), `createClient` from `@/lib/supabase/server`, `nanoid`
- Produces: `POST /api/builds` accepting `SaveBuildBody`, returning `{ build: SavedBuild }` on 200

**Contract:**

| Case | Status | Body |
|---|---|---|
| No session | 401 | `{ error: 'Unauthorized' }` |
| Invalid body | 400 | `{ error: '<reason>' }` |
| `id` given, no row matched (not owner / gone) | 404 | `{ error: 'Build not found' }` |
| Insert | 200 | `{ build }` with a fresh `share_token` |
| Update | 200 | `{ build }` |

- [ ] **Step 1: Write the route**

```ts
// src/app/api/builds/route.ts
// =============================================================================
// POST /api/builds — authenticated build upsert.
//
// The first user-triggered write route in this repo. Uses the cookie-scoped
// createClient() so RLS applies: ownership is enforced by the "Owners can do
// everything with their builds" policy, never by comparing user_id here. An
// update for someone else's build simply matches zero rows.
//
// Saves go through a route (rather than direct from the client, as renames and
// deletes do) for exactly one reason: share_token must be minted server-side.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { createClient } from '@/lib/supabase/server';
import { GAME_VERSION } from '@/lib/build/constants';
import type { PassiveState } from '@/lib/build/types';

interface SaveBuildBody {
  id?: string;
  name?: unknown;
  class?: unknown;
  ascendancy?: unknown;
  level?: unknown;
  league?: unknown;
  main_skill?: unknown;
  passive_state?: PassiveState;
  gear_state?: Record<string, unknown>;
  gem_state?: Record<string, unknown>;
}

function isPassiveState(value: unknown): value is PassiveState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.set1) && Array.isArray(v.set2) && Array.isArray(v.ascendancyNodes)
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: SaveBuildBody;
  try {
    body = (await request.json()) as SaveBuildBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const className = typeof body.class === 'string' ? body.class.trim() : '';
  if (!className) {
    return NextResponse.json({ error: 'Class is required' }, { status: 400 });
  }

  const level = typeof body.level === 'number' ? Math.trunc(body.level) : 1;
  if (level < 1 || level > 100) {
    return NextResponse.json({ error: 'Level must be between 1 and 100' }, { status: 400 });
  }

  if (body.passive_state !== undefined && !isPassiveState(body.passive_state)) {
    return NextResponse.json({ error: 'Malformed passive_state' }, { status: 400 });
  }

  // Always written in full — the column default omits ascendancyNodes.
  const passive_state: PassiveState = body.passive_state ?? {
    set1: [],
    set2: [],
    ascendancyNodes: [],
  };

  const shared = {
    name,
    class: className,
    ascendancy: typeof body.ascendancy === 'string' ? body.ascendancy : null,
    level,
    league: typeof body.league === 'string' && body.league.trim() ? body.league.trim() : 'Standard',
    main_skill: typeof body.main_skill === 'string' ? body.main_skill : null,
    passive_state,
    gear_state: body.gear_state ?? {},
    gem_state: body.gem_state ?? {},
    game_version: GAME_VERSION,
  };

  if (body.id) {
    const { data, error } = await supabase
      .from('builds')
      .update(shared)
      .eq('id', body.id)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      // RLS matched nothing: either it does not exist or it is not ours.
      // Deliberately indistinguishable — do not leak other users' build ids.
      return NextResponse.json({ error: 'Build not found' }, { status: 404 });
    }
    return NextResponse.json({ build: data });
  }

  const { data, error } = await supabase
    .from('builds')
    .insert({ ...shared, user_id: user.id, share_token: nanoid() })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ build: data });
}
```

- [ ] **Step 2: Verify it compiles and lints**

Run: `npm run type-check` then `npm run lint`
Expected: both PASS. If the Supabase generated types reject `main_skill` or `visibility`, re-read `src/types/database.ts` — do not cast to `any` to silence it.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/builds/route.ts
git commit -m "feat(api): add authenticated build save route"
```

---

### Task 4: PassiveTree props and ascendancy cap

**Files:**
- Modify: `src/components/tree/PassiveTree.tsx`

**Interfaces:**
- Consumes: `BuildEditorState`, `PassiveTreeInitialState`, `MAX_ASCENDANCY_POINTS` (Task 1)
- Produces: `PassiveTree` accepting `{ raw, initialState?: PassiveTreeInitialState, onStateChange?: (s: BuildEditorState) => void }`

**Context:** `tree-core`'s `toggleAscendancyAllocation` does no point counting — verified in its `.d.ts`. Without this task a user can allocate unlimited ascendancy nodes.

**Note on class identity:** the component takes a class *name* in and reports both the name and the internal id out. It owns this mapping because it already holds the normalized tree; the page must never normalize the export itself just to translate an index.

- [ ] **Step 1: Widen the component's props**

Replace the signature at `src/components/tree/PassiveTree.tsx:62`:

```tsx
export default function PassiveTree({
  raw,
  initialState,
  onStateChange,
}: {
  raw: GggTreeJson;
  initialState?: PassiveTreeInitialState;
  onStateChange?: (state: BuildEditorState) => void;
}) {
```

Add the import alongside the existing ones:

```tsx
import { MAX_ASCENDANCY_POINTS } from '@/lib/build/constants';
import type { BuildEditorState, PassiveTreeInitialState } from '@/lib/build/types';
```

- [ ] **Step 2: Seed the state slices from `initialState`**

Change the four `useState` initialisers (lines ~69-75) to prefer `initialState`. The class name is resolved to an id here, against the normalized `data` the component already has:

```tsx
const [classId, setClassId] = useState(() => {
  const named = initialState?.className
    ? data.classes.find((c) => c.name === initialState.className)
    : undefined;
  return named?.id ?? data.classes.find((c) => c.ascendancies.length > 0)?.id ?? 0;
});
const [ascendancyId, setAscendancyId] = useState<string | undefined>(
  initialState?.ascendancyId,
);
const [mode, setMode] = useState<AllocMode>(0);
const [main, setMain] = useState<WeaponSetAllocation>(initialState?.main ?? EMPTY_MAIN);
const [ascendancyNodes, setAscendancyNodes] = useState<number[]>(
  initialState?.ascendancyNodes ?? [],
);
```

These are lazy/initial values only — they intentionally do not re-sync if `initialState` changes later. The page remounts the component via `key` when it loads a different build (Task 7).

- [ ] **Step 3: Report state upward**

Add after the state declarations. Note it reports `className` so the page never needs the normalized tree:

```tsx
// Report the allocation upward so the page can save it. Deliberately not
// debounced: it is a cheap object build, and the page only stores it.
useEffect(() => {
  onStateChange?.({
    classId,
    className: data.classes[classId]?.name ?? '',
    ascendancyId,
    main,
    ascendancyNodes,
  });
}, [onStateChange, data, classId, ascendancyId, main, ascendancyNodes]);
```

- [ ] **Step 4: Enforce the ascendancy cap at BOTH commit sites**

**There are three call sites of `toggleAscendancyAllocation`, and two of them commit.** Read all of them before editing:

| Location | Role | Needs the cap? |
|---|---|---|
| `preview` memo, ~line 195 | Computes `next` for the visual preview | No (display only) |
| `preview.commit` closure, ~lines 197-200 | **Commits on touch**, fired by `handleConfirmPending` | **Yes** |
| `handleNodeClick`, ~lines 313-317 | **Commits on desktop** (mouse commits immediately) | **Yes** |

Guarding only `handleNodeClick` leaves the cap unenforced on phones, which is the primary target platform. Both commit paths must be capped.

Both commit sites currently run the same two lines:

```tsx
const mainSet = new Set(main.allocated);
setAscendancyNodes(next.filter((id) => !mainSet.has(id)));
```

Replace that duplication with one helper, defined after the state declarations, and call it from both sites:

```tsx
// tree-core's toggleAscendancyAllocation does no point counting, so the cap
// lives here. Both commit paths (touch confirm and desktop click) route
// through this — capping only one of them would leave the other unbounded.
const commitAscendancy = useCallback(
  (next: number[]) => {
    const mainSet = new Set(main.allocated);
    const nextAscendancy = next.filter((id) => !mainSet.has(id));
    // Refuse growth past the cap; always allow a click that shrinks the
    // allocation, so a user at the cap can still deallocate.
    if (
      nextAscendancy.length > MAX_ASCENDANCY_POINTS &&
      nextAscendancy.length > ascendancyNodes.length
    ) {
      return;
    }
    setAscendancyNodes(nextAscendancy);
  },
  [main.allocated, ascendancyNodes.length],
);
```

Then in the `preview.commit` closure:

```tsx
commit = () => commitAscendancy(next);
```

And in `handleNodeClick`:

```tsx
const next = toggleAscendancyAllocation(data, node.ascendancyName, new Set(allocated), skill, ascGraph);
commitAscendancy(next);
```

Update the dependency arrays of the `preview` memo and `handleNodeClick` to include `commitAscendancy` in place of the `main.allocated` reference they no longer use directly. Let lint's exhaustive-deps rule guide this — do not suppress it.

- [ ] **Step 5: Verify gates**

Run: `npm run type-check` then `npm run lint` then `npm test` then `npm run build`
Expected: all PASS.

- [ ] **Step 6: Browser check the cap on BOTH input paths**

Start the dev server, sign in with the test account, go to `/tree`, pick a class and ascendancy.

**Desktop path:** at a normal viewport, click ascendancy nodes until 8 are allocated. The 9th must refuse. Removing must still work while at 8.

**Touch path (this is the one that matters most):** switch to a 375px mobile viewport so the component's touch branch activates, then repeat. On touch, allocation is two-step — tap a node to preview, then confirm via the panel's button. The 9th node's confirm must refuse. A cap that works on desktop and not here is a failed task, because phones are the primary platform.

- [ ] **Step 7: Commit**

```bash
git add src/components/tree/PassiveTree.tsx
git commit -m "feat(tree): add build state props and enforce 8-point ascendancy cap"
```

---

### Task 5: localStorage draft

**Files:**
- Create: `src/lib/build/draft.ts`
- Test: `src/lib/build/__tests__/draft.test.ts`

**Interfaces:**
- Consumes: `BuildEditorState` (Task 1). Deliberately does **not** use the Task 2 converters — a draft stores the editor's own shape verbatim, since it never crosses the database boundary.
- Produces:
  - `draftKey(classId: number, ascendancyId: string | undefined): string`
  - `saveDraft(state: BuildEditorState): void`
  - `loadDraft(classId: number, ascendancyId: string | undefined): BuildEditorState | null`
  - `clearDraft(classId: number, ascendancyId: string | undefined): void`

Every storage access is wrapped — a private window, blocked site data, or a quota error must never break the editor.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/build/__tests__/draft.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { draftKey, saveDraft, loadDraft, clearDraft } from '@/lib/build/draft';
import type { BuildEditorState } from '@/lib/build/types';

const state: BuildEditorState = {
  classId: 3,
  ascendancyId: 'Lich',
  main: { allocated: [1, 2], weaponSets: { 2: 1 } },
  ascendancyNodes: [40],
};

function installMockStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  return store;
}

afterEach(() => vi.unstubAllGlobals());

describe('draftKey', () => {
  it('namespaces by class and ascendancy', () => {
    expect(draftKey(3, 'Lich')).toBe('vaal:tree-draft:3:Lich');
  });

  it('uses a stable placeholder when no ascendancy is chosen', () => {
    expect(draftKey(3, undefined)).toBe('vaal:tree-draft:3:none');
  });
});

describe('save and load', () => {
  beforeEach(() => installMockStorage());

  it('round-trips a draft', () => {
    saveDraft(state);
    expect(loadDraft(3, 'Lich')).toEqual(state);
  });

  it('returns null when nothing is stored', () => {
    expect(loadDraft(9, 'Nope')).toBeNull();
  });

  it('returns null for corrupt JSON instead of throwing', () => {
    localStorage.setItem(draftKey(3, 'Lich'), '{not json');
    expect(loadDraft(3, 'Lich')).toBeNull();
  });

  it('clears a draft', () => {
    saveDraft(state);
    clearDraft(3, 'Lich');
    expect(loadDraft(3, 'Lich')).toBeNull();
  });
});

describe('storage unavailable', () => {
  it('does not throw when localStorage access throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    expect(() => saveDraft(state)).not.toThrow();
    expect(loadDraft(3, 'Lich')).toBeNull();
    expect(() => clearDraft(3, 'Lich')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/build/__tests__/draft.test.ts`
Expected: FAIL — cannot resolve `@/lib/build/draft`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/build/draft.ts
// In-progress editor state, kept so a refresh mid-edit does not discard an
// unsaved allocation. This is NOT the save mechanism — it is a safety net that
// the server save clears on success.
import type { BuildEditorState } from '@/lib/build/types';

export function draftKey(classId: number, ascendancyId: string | undefined): string {
  return `vaal:tree-draft:${classId}:${ascendancyId ?? 'none'}`;
}

export function saveDraft(state: BuildEditorState): void {
  try {
    localStorage.setItem(
      draftKey(state.classId, state.ascendancyId),
      JSON.stringify(state),
    );
  } catch {
    // Private window, blocked site data, or quota exceeded. A draft is a
    // convenience; losing it must never break the editor.
  }
}

export function loadDraft(
  classId: number,
  ascendancyId: string | undefined,
): BuildEditorState | null {
  try {
    const raw = localStorage.getItem(draftKey(classId, ascendancyId));
    if (!raw) return null;
    return JSON.parse(raw) as BuildEditorState;
  } catch {
    return null;
  }
}

export function clearDraft(classId: number, ascendancyId: string | undefined): void {
  try {
    localStorage.removeItem(draftKey(classId, ascendancyId));
  } catch {
    // See saveDraft.
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/build/__tests__/draft.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/build/draft.ts src/lib/build/__tests__/draft.test.ts
git commit -m "feat(build): add guarded localStorage draft persistence"
```

---

### Task 6: Save panel overlay

**Files:**
- Create: `src/components/tree/BuildSavePanel.tsx`

**Interfaces:**
- Consumes: `SavedBuild`, `BuildVisibility` (Task 1)
- Produces: `BuildSavePanel` with props
  `{ buildId?: string; initialName?: string; initialLevel?: number; initialLeague?: string; saving: boolean; error: string | null; savedAt: string | null; onSave: (meta: { name: string; level: number; league: string }) => void }`

**Layout constraints (non-negotiable, from the spec):** this renders *inside* the tree page's fixed canvas div as an `absolute` overlay, matching `TreeControls` (`absolute left-3 top-3 z-10`) and `NodeInfoPanel` (`absolute inset-x-3 bottom-3 z-10`). It must **collapse to a chip by default** — an always-expanded panel eats drag surface, which on a phone is the entire interface. Position it at the top-right so it does not collide with `TreeControls` at top-left.

- [ ] **Step 1: Write the component**

```tsx
// src/components/tree/BuildSavePanel.tsx
'use client';

// Save controls for the tree editor, rendered as an absolute overlay inside
// the page's fixed canvas div — the same recipe as TreeControls/NodeInfoPanel.
// Collapsed to a chip by default so it never eats pan/pinch surface on a phone.

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function BuildSavePanel({
  buildId,
  initialName = '',
  initialLevel = 1,
  initialLeague = 'Standard',
  saving,
  error,
  savedAt,
  onSave,
}: {
  buildId?: string;
  initialName?: string;
  initialLevel?: number;
  initialLeague?: string;
  saving: boolean;
  error: string | null;
  savedAt: string | null;
  onSave: (meta: { name: string; level: number; league: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [level, setLevel] = useState(String(initialLevel));
  const [league, setLeague] = useState(initialLeague);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number.parseInt(level, 10);
    onSave({
      name: name.trim(),
      level: Number.isFinite(parsed) ? Math.min(100, Math.max(1, parsed)) : 1,
      league: league.trim() || 'Standard',
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute right-3 top-3 z-10 flex h-11 items-center gap-2 rounded-lg border border-border bg-card/90 px-3 text-sm font-medium backdrop-blur"
      >
        {buildId ? 'Saved build' : 'Save build'}
      </button>
    );
  }

  return (
    <div className="absolute right-3 top-3 z-10 w-[min(20rem,calc(100vw-1.5rem))] rounded-lg border border-border bg-card/95 p-3 backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">{buildId ? 'Update build' : 'Save build'}</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-muted-foreground"
          aria-label="Close save panel"
        >
          Close
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="build-name">Name</Label>
          <Input
            id="build-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Lightning Spear Deadeye"
            disabled={saving}
            className="h-11"
          />
        </div>

        <div className="flex gap-3">
          <div className="flex w-24 flex-col gap-1.5">
            <Label htmlFor="build-level">Level</Label>
            <Input
              id="build-level"
              inputMode="numeric"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              disabled={saving}
              className="h-11"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="build-league">League</Label>
            <Input
              id="build-league"
              value={league}
              onChange={(e) => setLeague(e.target.value)}
              disabled={saving}
              className="h-11"
            />
          </div>
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {savedAt && !error ? (
          <p className="text-sm text-muted-foreground">Saved {savedAt}</p>
        ) : null}

        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving ? 'Saving…' : buildId ? 'Update' : 'Save'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Verify gates**

Run: `npm run type-check` then `npm run lint`
Expected: PASS. If `Input` or `Label` do not accept `className`, read `src/components/ui/input.tsx` and match its actual prop surface rather than casting.

- [ ] **Step 3: Commit**

```bash
git add src/components/tree/BuildSavePanel.tsx
git commit -m "feat(tree): add collapsible build save panel overlay"
```

---

### Task 7: Wire the tree page

**Files:**
- Modify: `src/app/(dashboard)/tree/page.tsx`

**Interfaces:**
- Consumes: `PassiveTree` props (Task 4), `BuildSavePanel` (Task 6), converters (Task 2), draft helpers (Task 5), `POST /api/builds` (Task 3)
- Produces: a `/tree` that saves, and that hydrates from `?build=<uuid>`

- [ ] **Step 1: Load the build when `?build=` is present**

Add to the page component, alongside the existing tree-JSON fetch:

```tsx
const searchParams = useSearchParams();
const buildId = searchParams.get('build') ?? undefined;

const [build, setBuild] = useState<SavedBuild | null>(null);
const [buildLoaded, setBuildLoaded] = useState(!buildId);
const [loadError, setLoadError] = useState<string | null>(null);

useEffect(() => {
  if (!buildId) return;
  let cancelled = false;
  const supabase = createClient();
  supabase
    .from('builds')
    .select('*')
    .eq('id', buildId)
    .maybeSingle()
    .then(({ data, error }) => {
      if (cancelled) return;
      // RLS means "not ours" and "does not exist" are the same result here.
      if (error) setLoadError(error.message);
      else if (!data) setLoadError('That build could not be found.');
      else setBuild(data as unknown as SavedBuild);
      setBuildLoaded(true);
    });
  return () => {
    cancelled = true;
  };
}, [buildId]);
```

Import `useSearchParams` from `next/navigation` and `createClient` from `@/lib/supabase/client` (the browser one, **not** the server one).

- [ ] **Step 2: Derive the initial editor state**

The page does **not** normalize the tree export. It passes the class name straight through; `PassiveTree` resolves it (Task 4).

```tsx
const initialState = useMemo<PassiveTreeInitialState | undefined>(() => {
  if (!build) return undefined;
  const { main, ascendancyNodes } = fromPassiveState(build.passive_state);
  return {
    className: build.class,
    ascendancyId: build.ascendancy ?? undefined,
    main,
    ascendancyNodes,
  };
}, [build]);
```

- [ ] **Step 3: Hold the live editor state and persist drafts**

```tsx
const [editorState, setEditorState] = useState<BuildEditorState | null>(null);

useEffect(() => {
  if (editorState) saveDraft(editorState);
}, [editorState]);
```

- [ ] **Step 4: Implement save**

```tsx
const [saving, setSaving] = useState(false);
const [saveError, setSaveError] = useState<string | null>(null);
const [savedAt, setSavedAt] = useState<string | null>(null);

const handleSave = useCallback(
  async (meta: { name: string; level: number; league: string }) => {
    if (!editorState) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/builds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: build?.id,
          name: meta.name,
          class: editorState.className,
          ascendancy: editorState.ascendancyId ?? null,
          level: meta.level,
          league: meta.league,
          passive_state: toPassiveState(editorState.main, editorState.ascendancyNodes),
        }),
      });
      const payload = (await res.json()) as { build?: SavedBuild; error?: string };
      if (!res.ok) {
        setSaveError(payload.error ?? 'Could not save this build.');
        return;
      }
      if (payload.build) {
        setBuild(payload.build);
        setSavedAt(new Date().toLocaleTimeString());
        // Only clear the draft once the server has the work.
        clearDraft(editorState.classId, editorState.ascendancyId);
      }
    } catch {
      setSaveError('Could not reach the server. Your work is still here.');
    } finally {
      setSaving(false);
    }
  },
  [editorState, build?.id],
);
```

- [ ] **Step 5: Render**

Inside the existing fixed canvas div, render `PassiveTree` with the new props and `BuildSavePanel` as a sibling overlay. Gate rendering on `buildLoaded` so a build never hydrates into an already-mounted tree:

```tsx
) : !buildLoaded ? (
  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
    Loading build…
  </div>
) : (
  <>
    <PassiveTree
      key={build?.id ?? 'scratch'}
      raw={raw}
      initialState={initialState}
      onStateChange={setEditorState}
    />
    <BuildSavePanel
      buildId={build?.id}
      initialName={build?.name ?? ''}
      initialLevel={build?.level ?? 1}
      initialLeague={build?.league ?? 'Standard'}
      saving={saving}
      error={saveError ?? loadError}
      savedAt={savedAt}
      onSave={handleSave}
    />
  </>
)}
```

The `key` is load-bearing: it remounts `PassiveTree` when a different build loads, which is what makes the one-shot `initialState` seeding correct.

- [ ] **Step 6: Verify gates**

Run: `npm run type-check` then `npm run lint` then `npm test` then `npm run build`
Expected: all PASS. `useSearchParams` requires a Suspense boundary under static rendering — if `npm run build` complains, wrap the page body in `<Suspense>`.

- [ ] **Step 7: Browser verification at 375px first**

Sign in with the test account. At a 375px viewport: allocate nodes, open the save chip, save a named build, confirm the URL-less scratch save succeeds and the panel reports success. Reload with `?build=<id>` and confirm the allocation returns. Then repeat at desktop width. Confirm the save chip does not block panning.

This writes real rows to the live Supabase project. Note the build ids created and delete them afterwards.

- [ ] **Step 8: Commit**

```bash
git add src/app/\(dashboard\)/tree/page.tsx
git commit -m "feat(tree): wire build save and load into the tree editor"
```

---

### Task 8: My Builds list

**Files:**
- Create: `src/app/(dashboard)/builds/page.tsx`
- Create: `src/components/builds/MyBuildsList.tsx`
- Modify: `src/components/layout/shell-chrome.tsx:20`

**Interfaces:**
- Consumes: `SavedBuild` (Task 1), `createClient` from `@/lib/supabase/client`
- Produces: `/builds` route listing the signed-in user's builds

**Layout constraint:** match the `/prices` house style — a single `<ul className="divide-y divide-border rounded-lg border border-border bg-card/40">` of `<li className="flex items-center gap-3 px-3 py-2.5">` rows, **identical markup at every breakpoint**. No `<table>`, no cards-on-mobile/table-on-desktop split. Touch targets at `h-11`.

- [ ] **Step 1: Build the list component**

```tsx
// src/components/builds/MyBuildsList.tsx
'use client';

// The signed-in user's own builds. RLS scopes the select to the owner, so
// there is deliberately no user_id filter here — adding one would imply the
// query is what enforces ownership, and it is not.
//
// Rename and delete go direct through the browser client rather than an API
// route: neither touches a server-generated value, so RLS is the whole story.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import type { SavedBuild } from '@/lib/build/types';

export default function MyBuildsList() {
  const [builds, setBuilds] = useState<SavedBuild[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from('builds')
      .select('*')
      .order('updated_at', { ascending: false });
    if (err) setError(err.message);
    else setBuilds((data ?? []) as unknown as SavedBuild[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function commitRename(id: string) {
    const name = draftName.trim();
    setRenamingId(null);
    if (!name) return;
    const supabase = createClient();
    const { error: err } = await supabase.from('builds').update({ name }).eq('id', id);
    if (err) setError(err.message);
    else await load();
  }

  async function confirmDelete(id: string) {
    setPendingDeleteId(null);
    const supabase = createClient();
    const { error: err } = await supabase.from('builds').delete().eq('id', id);
    if (err) setError(err.message);
    else await load();
  }

  if (error) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error}
      </p>
    );
  }

  if (builds === null) {
    return <p className="text-sm text-muted-foreground">Loading your builds…</p>;
  }

  if (builds.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-muted-foreground">You have not saved a build yet.</p>
        <Link href="/tree" className="mt-2 inline-block text-sm underline">
          Plan one on the passive tree
        </Link>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card/40">
      {builds.map((b) => (
        <li key={b.id} className="flex items-center gap-3 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            {renamingId === b.id ? (
              <Input
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={() => void commitRename(b.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void commitRename(b.id);
                  if (e.key === 'Escape') setRenamingId(null);
                }}
                className="h-11"
              />
            ) : (
              <Link href={`/tree?build=${b.id}`} className="block truncate font-medium">
                {b.name}
              </Link>
            )}
            <p className="truncate text-xs text-muted-foreground">
              {b.ascendancy ?? b.class} · Level {b.level} · {b.league}
            </p>
          </div>

          {pendingDeleteId === b.id ? (
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => void confirmDelete(b.id)}
                className="h-11 rounded-lg px-3 text-sm text-destructive"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setPendingDeleteId(null)}
                className="h-11 rounded-lg px-3 text-sm text-muted-foreground"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => {
                  setRenamingId(b.id);
                  setDraftName(b.name);
                }}
                className="h-11 rounded-lg px-3 text-sm text-muted-foreground"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => setPendingDeleteId(b.id)}
                className="h-11 rounded-lg px-3 text-sm text-muted-foreground"
              >
                Delete
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Add the route shell**

```tsx
// src/app/(dashboard)/builds/page.tsx
import MyBuildsList from '@/components/builds/MyBuildsList';

export const metadata = { title: 'Builds' };

export default function BuildsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Your builds</h1>
      <MyBuildsList />
    </div>
  );
}
```

The public finder tab arrives in Task 4 of the spec. Leave room for it; do not build it here.

- [ ] **Step 3: Turn the nav entry on**

In `src/components/layout/shell-chrome.tsx:20`, change `live: false` to `live: true` on the `/builds` entry. Nothing else in that file changes — the `live: true` branch already renders a proper `<Link>` with active-state styling.

- [ ] **Step 4: Verify gates**

Run: `npm run type-check` then `npm run lint` then `npm test` then `npm run build`
Expected: all PASS.

- [ ] **Step 5: Browser verification at 375px first**

Confirm the nav item is now tappable and no longer shows "Soon". Confirm the list shows builds saved in Task 7, that Open loads one into the editor, that rename persists across reload, and that delete removes the row. Check the bottom nav does not overlap the last row (the shell's `pb-24` should handle it). Then check desktop.

Clean up the test builds created during verification.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(dashboard\)/builds/page.tsx src/components/builds/MyBuildsList.tsx src/components/layout/shell-chrome.tsx
git commit -m "feat(builds): add my-builds list and enable the builds nav entry"
```

---

## Done when

- A signed-in user can allocate a tree, name it, and save it.
- Reopening `/tree?build=<id>` restores that allocation exactly.
- A mid-edit refresh does not lose unsaved work.
- The 9th ascendancy point is refused.
- `/builds` lists the user's builds and can open, rename, and delete them.
- Every saved row has a `share_token`, `game_version = '0.5.5'`, and `visibility = 'private'`.
- All four gates pass, and both flows were verified in a real browser at 375px and at desktop width.
