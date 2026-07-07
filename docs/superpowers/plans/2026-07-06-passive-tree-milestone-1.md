# Passive Tree Viewer — Milestone 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (subagent-driven-development where subagents are available). Steps use checkbox (`- [ ]`) syntax for tracking.

**Date:** 2026-07-06 · **Status:** awaiting Jaycee's review — no code until approved
**Plan-doc anchors (authoritative):** §4, §5, §6, §7, §8.5, §12, §15 of `poe2-console-hub-plan7_06_2026.md` (incl. the 2026-07-06 decision rows). On any conflict, the plan doc wins — flag it, don't silently pick.

**Goal:** Ship `/tree` — a mobile-first PoE2 passive tree viewer: real tree render (PixiJS v8), pan/zoom with persisted viewport, tap-to-allocate with BFS validity, dual weapon-set support with the full two-pool point budget, the §5 safe-stat panel, and localStorage working-state + Reset.

**Architecture:** Pure-logic core in `src/lib/tree/` (parser, graph/BFS, allocation, budget, stats, persistence — zero React/Pixi imports, all TDD'd with vitest) → a route-agnostic Pixi v8 renderer component that consumes a parsed model + `PassiveState` and emits tap intents → a token-driven overlay UI → a thin `(dashboard)/tree` page wiring state and localStorage. Renderer + overlay stay reusable for `/builds/new` and `/characters/[id]/build` (§7).

**Tech stack:** Next.js 16.2.9 (App Router), React 19, TypeScript, `pixi.js ^8.19` (already installed), Tailwind v4 tokens (§15), vitest (added in Stage 0). Data: `grindinggear/poe2-skilltree-export` (GGG-sanctioned), self-hosted under `/public/data/tree/<version>/`.

## Global Constraints

- **Route & gating (decided 2026-07-06):** page at `src/app/(dashboard)/tree/page.tsx` (URL stays `/tree`); add `'/tree'` to `PROTECTED_PREFIXES` in `src/proxy.ts`; delete that file's stale `/tree → PUBLIC` comment. Group membership alone gates nothing.
- **State shape (§6):** `PassiveState = { "set1": number[], "set2": number[] }`; node IDs match the export; global/"both" = intersection, derived at read time. Never invent a third array.
- **Dual-set encoding (§8.5):** red = Set 1, green = Set 2, gold = global; tap defaults to Global; Set I/II selection is also a focus toggle dimming the other set's exclusives. Tokens `--set-one`/`--set-two`, distinct from `--destructive`. Pure color; no redundant CVD cue.
- **Point budget (§8.5):** full two-pool rules; totals from a user level/points control defaulting to current-patch max; in-tree conversions (Weapon Master) auto-detected; totals are version-tied constants — **never hardcode game numbers from memory; verify per patch**.
- **Safe stats only (§5):** no DPS anywhere. Panel stays modular.
- **Working state (§8.5):** localStorage only in M1 (no server writes). Save-to-Build is Milestone 2 (§8.6) — out of scope here.
- **Perf target:** 60fps pan/zoom on ~2022+ phones; Stage 1 gates on an on-device measurement. Optimization ladder (culling → LOD) applied only if the measurement demands it.
- **Design system (§15):** semantic tokens only, no hex in components; `font-heading`/`font-sans`; the two new set tokens live in `globals.css`.
- **Sanctioned assets (§12):** GGG tree sprites are a scoped §15 exception, self-hosted; app chrome stays original.
- **Process:** PowerShell + backslash paths for human-run commands; repo at `C:\Dev\project-vaal`. Gates per task: `npm run type-check`, `npm run lint`, `npm test`; `npm run build` at stage ends; Chrome verification for anything visual. Commit per task (conventional messages). Jaycee reviews at every stage checkpoint.

## How this plan is staged — read before executing

This plan is **discovery-gated**. Stage 0 exists because the export's exact schema is unverified; Stage 1 exists because mobile WebGL performance is unproven. Writing parser/renderer code today against an assumed schema would violate the project's evidence-first rule, so:

- **Stage 0 is fully specified below** (every step, real code).
- **Stages 1–5 are binding scope contracts** — files, interfaces, enumerated test cases, and acceptance gates are fixed now; their bite-sized step code is **appended to this document at the preceding checkpoint**, written from the real schema/perf data. Appending stage detail is part of executing this plan, not a deviation from it.
- Do not skip ahead. Do not begin a stage before the prior checkpoint is approved.

## File map (end state)

| Path | Responsibility |
|---|---|
| `public/data/tree/<version>/` | Vendored export: JSON + sprite atlases + `SOURCE.md` |
| `src/lib/tree/version.ts` | `TREE_VERSION` + per-version point-budget constants (values filled by Stage 3 research) |
| `src/lib/tree/types.ts` | `TreeModel`, `TreeNode`, `PassiveState`, mode types (finalized at Checkpoint 0) |
| `src/lib/tree/parse.ts` | `parseTreeExport(raw): TreeModel` — the only module that touches raw JSON |
| `src/lib/tree/graph.ts` | Adjacency build + BFS reachability/pathing |
| `src/lib/tree/allocation.ts` | Allocate/deallocate per mode; orphan pruning; validity |
| `src/lib/tree/budget.ts` | Two-pool accounting; conversions; extension rule |
| `src/lib/tree/stats.ts` | §5 safe-stat aggregation |
| `src/lib/tree/persistence.ts` | Versioned localStorage load/save for working state |
| `src/lib/tree/viewport-persistence.ts` | Viewport `{x,y,scale}` serialize/clamp + storage |
| `src/lib/tree/__tests__/*.test.ts` | Vitest suites (pure logic only) |
| `src/components/tree/TreeCanvas.tsx` | Pixi v8 renderer — route-agnostic, stateless re: business rules |
| `src/components/tree/TreeOverlay.tsx` (+ `ModeControl`, `PointCounter`, `StatPanel`, `ResetButton`) | Token-driven UI over the canvas |
| `src/app/(dashboard)/tree/page.tsx` | Wiring: state, localStorage, layout |
| `vitest.config.ts` | Test harness config |
| Modify: `src/proxy.ts` | `'/tree'` prefix + stale-comment deletion |
| Modify: `src/app/globals.css` | `--set-one`, `--set-two` tokens |
| Modify: `package.json` | vitest dep + `test`/`test:watch` scripts |

**Interfaces pinned now (later stages must match exactly):**

```ts
export type WeaponSet = 'set1' | 'set2';
export interface PassiveState { set1: number[]; set2: number[]; }   // §6 JSONB shape
export type AllocMode = 'global' | WeaponSet;                        // tap default: 'global'
export type FocusMode = 'all' | WeaponSet;                           // focus toggle
export interface TreeCanvasProps {
  model: TreeModel;                    // from parseTreeExport
  state: PassiveState;
  mode: AllocMode;
  focus: FocusMode;
  onNodeTap(nodeId: number): void;     // page owns state; renderer emits intent only
}
```

`TreeModel`/`TreeNode` internals are finalized at Checkpoint 0 from the shape report; `parseTreeExport(raw: unknown): TreeModel` and numeric node IDs are fixed regardless (per §6's example). If the report shows string IDs, STOP and flag — §6 would need a decision, not a silent fix.

---

## Stage 0 — Data + harness (fully specified)

> **STATUS 2026-07-06 — Stage 0 substantially executed.**
> - **Checkpoint 0 (schema) DONE** from the real `data.json` (v0.5.2, 5,151 nodes). Findings: node-id keys are numeric strings (= `skill`) plus a special `"root"` key (excluded); **coordinates are pre-computed** (`x`/`y` on every node — no orbit math needed); adjacency from per-node `out`/`in`; class starts via `classStartIndex` (12 classes pair onto 6 attribute origins); **stats are display strings with `[Token|Text]` markup** → Stage 4 needs a tested string parser, not structured reads; point economy is in-data (`grantedPassivePoints`; Weapon Master skill 8272 = `weaponPassivePointsGranted:100 / passivePointsGranted:-100` — note the 100, contradicting the ~20 secondary source, so verify at Stage 3); node art is the repo `assets/` atlas set (skills / skills-disabled / frame / line / background-<class> / group-background / jewel / mastery).
> - **Task 0.4 delivered + verified (Claude-side):** `src/lib/tree/types.ts`, `src/lib/tree/parse.ts`, `src/lib/tree/__tests__/parse.test.ts` — `parseTreeExport(raw): TreeModel`. `tsc --noEmit` clean; **13/13 vitest pass** (9 fixture + 4 real-data integration). Awaiting Jaycee's local `npm install` + `npm test` to confirm in-repo.
> - **Task 0.2 (vitest harness) done:** `vitest.config.ts` + `package.json` (test scripts + `vitest` devDep) written; the trivial 1+1 harness test is superseded by `parse.test.ts`.
> - **Task 0.1 vendoring CORRECTED:** use the repo **archive zip** (verified; no GitHub API / rate-limit dependency), not the releases API. Version is **0.5.2** (confirmed latest tag); `SOURCE.md` already written into `public/data/tree/0.5.2/`. The Step 1–3 API commands below are superseded by the archive-zip commands in the session handoff.

### Task 0.1: Vendor the tree export

**Files:**
- Create: `public/data/tree/<version>/` (JSON + all release assets)
- Create: `public/data/tree/<version>/SOURCE.md`

- [ ] **Step 1: Enumerate the latest release (PowerShell)**

```powershell
Invoke-RestMethod https://api.github.com/repos/grindinggear/poe2-skilltree-export/releases/latest |
  Select-Object tag_name, @{n='assets';e={$_.assets | Select-Object name, size, browser_download_url}} |
  ConvertTo-Json -Depth 4
```

Expected: a tag like `skilltree-0.5.2` with a ~4.8 MB JSON asset plus image atlas assets. **If the tag is newer than 0.5.2, STOP and tell Jaycee** — the newer version is almost certainly what we want (it must match the live patch), but confirm, then use the actual tag everywhere `<version>` appears.

- [ ] **Step 2: Download all release assets into the versioned folder**

```powershell
$rel = Invoke-RestMethod https://api.github.com/repos/grindinggear/poe2-skilltree-export/releases/latest
$ver = $rel.tag_name -replace '^skilltree-',''
$dir = "C:\Dev\project-vaal\public\data\tree\$ver"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$rel.assets | ForEach-Object { Invoke-WebRequest $_.browser_download_url -OutFile (Join-Path $dir $_.name) }
Get-ChildItem $dir | Select-Object Name, Length
```

Expected: every asset listed in Step 1 present with matching sizes.

- [ ] **Step 3: Check the export repo root for non-release files the JSON references**

```powershell
Invoke-RestMethod https://api.github.com/repos/grindinggear/poe2-skilltree-export/contents |
  Select-Object name, size, download_url
```

If a metadata/readme file documents the format or the JSON references files not in the release, vendor those too (same folder). Note anything surprising for the Checkpoint 0 report.

- [ ] **Step 4: Write `SOURCE.md`** with exactly this content (fill the two placeholders from Step 1/2 output):

```markdown
# Passive tree data — provenance

- Source: https://github.com/grindinggear/poe2-skilltree-export (Grinding Gear Games)
- Release tag: <tag_name> · vendored 2026-07-06
- Files: <list of vendored filenames>

This is GGG's sanctioned passive-tree export — the stated exception to their
data-access rules — and its node-sprite atlases are used under the scoped
§15 exception recorded in the plan doc (§12, 2026-07-06). Self-hosted so
WebGL textures stay same-origin. Re-vendor per patch; the folder name is the
version and must match `TREE_VERSION` in `src/lib/tree/version.ts`.
```

- [ ] **Step 5: Commit (vendoring only — no code)**

```powershell
git add public\data\tree
git status
git commit -m "chore(tree): vendor GGG skilltree export <tag> (sanctioned source; plan-doc §12)"
```

`git status` must show only the new `public/data/tree/**` files.

### Task 0.2: vitest harness

**Files:** Create `vitest.config.ts`; Modify `package.json`; Create `src/lib/tree/__tests__/harness.test.ts`

- [ ] **Step 1: Install** — `npm i -D vitest` (expect it added to `devDependencies`; lockfile updates)

- [ ] **Step 2: Create `vitest.config.ts`:**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
```

- [ ] **Step 3: Add scripts to `package.json`** (`scripts` block): `"test": "vitest run"`, `"test:watch": "vitest"`

- [ ] **Step 4: Create `src/lib/tree/__tests__/harness.test.ts`:**

```ts
import { describe, it, expect } from 'vitest';

describe('vitest harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run** `npm test` → expect `1 passed`. Also run `npm run type-check` and `npm run lint` → both clean.

- [ ] **Step 6: Commit** — `git commit -m "chore(tree): add vitest harness"` (config, package files, harness test)

### Task 0.3: Shape report (characterization — assumes nothing about the schema)

**Files:** Create `src/lib/tree/__tests__/shape-report.test.ts`

This test *discovers* the format and prints a report; it asserts only what any valid export must satisfy. Its console output is the Checkpoint 0 deliverable.

- [ ] **Step 1: Write the report test:**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const treeRoot = join(process.cwd(), 'public', 'data', 'tree');
const version = readdirSync(treeRoot).sort().at(-1)!;
const versionDir = join(treeRoot, version);
const jsonName = readdirSync(versionDir).find((f) => f.endsWith('.json'))!;
const raw: unknown = JSON.parse(readFileSync(join(versionDir, jsonName), 'utf8'));

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function describeValue(v: unknown): string {
  if (Array.isArray(v)) return `array(${v.length})`;
  if (isRec(v)) return `object{${Object.keys(v).length} keys}`;
  return `${typeof v}: ${String(JSON.stringify(v)).slice(0, 60)}`;
}

/** Largest record-collections in the root — the node table will be #1. */
function findCollections(root: Rec): Array<{ path: string; size: number; sample: Rec }> {
  const found: Array<{ path: string; size: number; sample: Rec }> = [];
  for (const [key, value] of Object.entries(root)) {
    if (Array.isArray(value) && value.length > 0 && isRec(value[0])) {
      found.push({ path: key, size: value.length, sample: value[0] });
    } else if (isRec(value)) {
      const vals = Object.values(value);
      if (vals.length > 0 && isRec(vals[0])) {
        found.push({ path: key, size: vals.length, sample: vals[0] });
      }
    }
  }
  return found.sort((a, b) => b.size - a.size);
}

function keyFrequency(collection: unknown): Map<string, number> {
  const freq = new Map<string, number>();
  const items: unknown[] = Array.isArray(collection)
    ? collection
    : isRec(collection) ? Object.values(collection) : [];
  for (const item of items) {
    if (!isRec(item)) continue;
    for (const k of Object.keys(item)) freq.set(k, (freq.get(k) ?? 0) + 1);
  }
  return freq;
}

describe(`tree export shape report (${version}/${jsonName})`, () => {
  it('reports top-level structure', () => {
    expect(isRec(raw)).toBe(true);
    const root = raw as Rec;
    console.log('== TOP-LEVEL KEYS ==');
    for (const [k, v] of Object.entries(root)) console.log(`  ${k}: ${describeValue(v)}`);
    console.log('== CANDIDATE COLLECTIONS (largest first) ==');
    for (const c of findCollections(root)) {
      console.log(`  ${c.path}: ${c.size} records; sample keys: [${Object.keys(c.sample).join(', ')}]`);
    }
  });

  it('profiles the node table and asserts plausible completeness', () => {
    const root = raw as Rec;
    const [nodes] = findCollections(root);
    expect(nodes).toBeDefined();
    expect(nodes.size).toBeGreaterThan(1500); // the PoE2 tree is thousands of nodes
    console.log(`== KEY FREQUENCY across ${nodes.size} records in "${nodes.path}" ==`);
    for (const [k, n] of [...keyFrequency(root[nodes.path]).entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${k}: ${n}/${nodes.size}`);
    }
    console.log('== FULL SAMPLE RECORD ==');
    console.log(JSON.stringify(nodes.sample, null, 2).slice(0, 2000));
  });

  it('lists image references for atlas wiring (informational)', () => {
    const hits = new Set<string>();
    const visit = (v: unknown): void => {
      if (typeof v === 'string' && /\.(png|webp|jpg|dds)/i.test(v)) hits.add(v);
      else if (Array.isArray(v)) v.forEach(visit);
      else if (isRec(v)) Object.values(v).forEach(visit);
    };
    visit(raw);
    console.log(`== IMAGE-LIKE STRINGS (${hits.size}) ==`);
    [...hits].slice(0, 40).forEach((h) => console.log('  ' + h));
    expect(hits.size).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run** `npm test` → all pass; capture the full console report.
- [ ] **Step 3: Commit** — `git commit -m "test(tree): characterization shape report for vendored export"`

### ⛔ CHECKPOINT 0 — schema review with Jaycee

Present the report and answer, from evidence: node ID type (must be numeric per §6 — STOP if not); where adjacency lives; how coordinates derive (groups/orbits + constants?); how class starts are flagged; whether stats are structured or strings (drives Stage 4); where sprite-atlas coordinates live; whether any weapon-set metadata exists in-data. **Then append Task 0.4 (types.ts + parse.ts, full TDD steps) to this file from the real field names, execute it, and close Stage 0** with `parseTreeExport` returning a `TreeModel` and tests green.

---

## Stage 1 — Static render + pan/zoom (scope contract; steps appended at Checkpoint 0)

**Files:** Create `src/components/tree/TreeCanvas.tsx`, `src/app/(dashboard)/tree/page.tsx`, `src/lib/tree/viewport-persistence.ts` (+ test); Modify `src/proxy.ts`.

**Binding pre-task:** pull current Pixi v8 docs via Context7 (`Application.init` async lifecycle, Container/Graphics/Sprite, atlas textures, pointer events, `destroy()`), and follow them over training memory — v8 ≠ v7.

**Scope:** proxy edit (add `'/tree'` to `PROTECTED_PREFIXES`; delete the stale `/tree → PUBLIC` comment — view the file first, edit exactly); client-only canvas component with async Pixi init + StrictMode-safe destroy; fetch model from `/data/tree/<version>/…`; draw all edges (Graphics) + node sprites from atlas frames at parsed coordinates; pointer-drag pan, wheel + pinch zoom (clamped); devicePixelRatio handling; viewport `{x,y,scale}` persisted under `vaal.tree.viewport.v1` (pure clamp/serialize logic unit-tested).

**Acceptance gate (on-device):** signed-out `/tree` → `/login?redirect=/tree`; signed-in renders the full tree in the dashboard shell; pan/zoom at target 60fps on Jaycee's phone (LAN dev server or preview deploy), frame timings reported. If missed, apply in order — offscreen culling → zoom-LOD — re-measure between rungs; do not proceed on a failed gate. **⛔ CHECKPOINT 1:** perf numbers + screenshots; Stage 2 steps appended.

## Stage 2 — Single-set allocation (scope contract)

**Files:** Create `src/lib/tree/graph.ts`, `src/lib/tree/allocation.ts` (+ `__tests__/graph.test.ts`, `__tests__/allocation.test.ts`); wire `onNodeTap` → page state → canvas highlight; `PointCounter` overlay; deallocation confirm (destructive tokens).

**Tests written first — enumerated cases (small fixture graphs, not the real tree, plus one real-tree smoke test):**
- graph: adjacency built symmetrically from model; BFS shortest path from class start to target; unreachable target → `null`; start-to-start → `[start]`.
- allocation: adjacent node allocates; distant node allocates its full BFS path; already-allocated tap is a no-op; leaf dealloc removes only the leaf; cut-vertex dealloc prunes the orphaned subtree (every remaining node still reaches start); node on a cycle deallocs without pruning the far side; class start cannot be deallocated; allocating in `'global'` mode writes the node to **both** arrays (§6), and point counting counts a global node **once**.

**Gate:** all new tests green; tap-allocate/deallocate works in Chrome with highlight + counter correct. **⛔ CHECKPOINT 2.**

## Stage 3 — Dual-set + full two-pool budget (scope contract)

**Files:** Create `src/lib/tree/budget.ts`, `src/lib/tree/version.ts` (+ tests); `ModeControl` (Global | I | II) + focus toggle; `--set-one`/`--set-two` in `globals.css`; per-set line tinting + focus dimming in `TreeCanvas`.

**Binding research pre-task (before any budget code):** verify against current-patch sources and record findings + URLs in `version.ts` comments — max level and total regular points (level + quest books); weapon-set point sources and counts; Weapon Master's exact conversion; the precise set-branch extension rule. Constants keyed by `TREE_VERSION`. Token color values proposed from in-game reference and signed off by Jaycee (aesthetic call).

**Tests written first — enumerated cases:**
- membership: in both arrays = global; single array = set-exclusive; intersection derivation matches §6.
- mode: tap in `'global'` → both arrays; in `'set1'` → set1 only (mirror for set2).
- pools: regular and weapon-set points counted separately; weapon-set spend obeys the verified precondition exactly as sourced.
- extension rule: a regular-point allocation cannot extend beyond a set-exclusive node (mirror case for set points), per the verified wording.
- Weapon Master: allocation shifts pools by the verified amount; deallocation reverts; a revert that would overspend is blocked with an explanatory result (no silent invalid states).
- level control: level→points mapping at floor and ceiling; default = current-patch max; "remaining" never negative and always derived from the user-set totals.

**Gate:** tests green; mode control defaults Global; focus dims correctly; red/green/gold render from tokens (no hex); on-device sanity re-check. **⛔ CHECKPOINT 3.**

## Stage 4 — Safe-stat panel (scope contract)

**Files:** Create `src/lib/tree/stats.ts` (+ test); `StatPanel` (collapsible bottom sheet on mobile, sidebar-adjacent on desktop).

**Tests written first — enumerated cases:** STR/DEX/INT sums for the viewed set; Life/ES/Mana flat + %-increase composition (order documented in the module header); resistance totals with a 75%-cap indicator flag (§5); points used per set from budget selectors. Stat parsing strategy fixed at Checkpoint 0 (structured vs. string stats). §5 list only — no DPS; attribute-requirements row deferred until gear exists (interface slot kept).

**Gate:** tests green; panel updates live with allocation and set focus; tokens only. **⛔ CHECKPOINT 4.**

## Stage 5 — Working-state persistence + Reset (scope contract)

**Files:** Create `src/lib/tree/persistence.ts` (+ test); `ResetButton` (destructive confirm); debounced autosave wiring in the page.

**Tests written first — enumerated cases:** `PassiveState` round-trip under `vaal.tree.working.v1` including `TREE_VERSION`; version mismatch → discard with a one-time notice (revisit at Checkpoint 4 if migration is wanted instead); corrupted JSON → clean empty state, no crash; Reset clears state + storage only after confirm; storage quota errors caught and logged, never thrown to the UI.

**Final gates (Milestone 1 done):** full suite + type-check + lint + `npm run build` clean; Chrome walkthrough — signed-out redirect → login → allocate across sets → refresh restores state and viewport → Reset; on-device perf re-check. **⛔ CHECKPOINT 5 = Milestone 1 review → Milestone 2 (Save-to-Build, §8.6) planning.**

---

## Self-review (writing-plans)

- **Spec coverage vs. §8.5 + locked decisions:** render ✓ (S1) · pan/zoom + viewport memory ✓ (S1) · BFS tap-allocate ✓ (S2) · Set 1/Set 2/Both ✓ (S3) · point budget ✓ (S3) · safe-stat panel ✓ (S4) · working state + Reset ✓ (S5) · route + proxy gating ✓ (S1) · sanctioned sprites + SOURCE.md ✓ (S0).
- **Placeholder scan:** Stage 0 steps contain complete code/commands. Stages 1–5 are explicitly checkpoint-gated contracts (declared in "How this plan is staged"), not tasks with hidden gaps; the append-at-checkpoint rule is the mechanism, not an omission.
- **Type consistency:** `PassiveState`/`AllocMode`/`FocusMode`/`TreeCanvasProps` defined once above and referenced identically throughout; storage keys `vaal.tree.viewport.v1` / `vaal.tree.working.v1` appear consistently.
