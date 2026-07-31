# Handoff to Claude Code — Passive Tree: Credit Label + Mobile Allocation Preview

**Context:** This picks up mid-task from a claude.ai chat session (Filesystem MCP access only, no shell/exec). Everything below was verified by reading actual source/type files in `node_modules`, not assumed. Two tasks, explicitly authorized by Jaycee to implement fully and verify: get both working with `npm run type-check && npm run lint && npm test && npm run build` all passing. This is the one thing the prior session *couldn't* do itself — you can, so don't stop until that gate is actually green.

Scope guardrail carried over from the prior session: **these two items only.** Do not touch schema reconciliation, the point-budget/stat panel UI, Abyssal Lich ascendancy support, or `tree-react`'s full-scene-rebuild performance issue — all explicitly deferred, tracked in the plan doc (`docs/superpowers/plans/poe2-console-hub-plan7_12_2026.md` — check for a newer dated file first, per that doc's own convention).

-----

## Task 1: Credit label position (trivial)

`src/components/tree/PassiveTree.tsx`, in the `creditLabels` memo:

```tsx
const creditLabels = useMemo(() => {
  const { centre, ring } = scene.centre;
  return [
    {
      x: centre.x + ring.frameRadius + 150,
      y: centre.y,
      text: 'Tree rendering via @poe2-toolkit — thanks, rajtik76',
    },
  ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

The `+ 150` offset sits too far right of the ring. Reduce it (try `+80` first) and visually confirm on `/tree` that the label sits closer to the ring without overlapping it. No exact target value was pinned down — use your own visual judgment once you can actually see it rendered.

-----

## Task 2: Mobile allocation preview (the real work)

### The problem being solved

Right now, tapping a node on `PassiveTree.tsx` does two things at once: shows `NodeInfoPanel` (the node's name/stats) *and* immediately commits the allocation (`handleNodeClick` calls `toggleAllocationInMode`/`toggleAscendancyAllocation` directly, updating real state). Desktop users have an escape hatch — mouse hover shows `NodeTooltip` for free, no commitment — but touch has no hover, so there's currently no way to see what a node does before allocating it.

### The design (already decided, don't re-litigate — implement this)

Tap-to-preview-then-confirm, **touch-only**. Desktop keeps its exact current click-to-commit-immediately behavior unchanged — it already has hover-preview via `NodeTooltip`, so this is solving a touch-specific gap, not replacing desktop's flow.

- Detect touch via `window.matchMedia('(pointer: coarse)').matches` — a standard, widely-used technique (no library patch, no event-plumbing changes needed). Do this once (e.g. a small `useState`/`useEffect` or a tiny custom hook), not per-render.
- **On touch:** tapping a node computes what the toggle *would* do (without calling `setMain`/`setAscendancyNodes`), shows that as a visual preview on the tree via `TreeView`'s existing `preview` prop, and shows `NodeInfoPanel` with an explicit **"Allocate" / "Remove"** button (label depends on whether this is an add or removal). Pressing that button actually commits (calls the real toggle + setState, same logic `handleNodeClick` already has today). Tapping a *different* node while one is pending just replaces the preview/pending state with the new node's — no need to force confirm-or-cancel first.
- **On desktop (mouse):** `handleNodeClick` behaves exactly as it does right now — immediate commit, no preview step, no button. Don't add a confirm button for mouse users; that'd be a regression for the existing tested, working flow.
- Rejected alternative, explicitly: a "tap the same node twice to confirm" gesture. No visual affordance tells the user that's how to confirm, so it fails a basic discoverability test. Explicit button in the panel is the standard pattern (same shape as "select a product, see details, press Add" in virtually every mobile app) and needs no explanation.

### The library API — verified from actual `.d.ts` files, use these exactly

From `node_modules/@poe2-toolkit/tree-react/dist/types.d.ts`:

```ts
export interface AllocationPreview {
  /** Whether the pending click would allocate (`add`) or deallocate (`remove`). */
  kind: 'add' | 'remove';
  /** Skill ids the click would touch. */
  nodes: Set<number>;
  /** Edge keys as `min-max` of the two node ids. */
  edges: Set<string>;
  /** Weapon set an `add` preview would allocate into (1 or 2); absent means basic. */
  weaponSet?: 1 | 2;
}
```

From `TreeView.d.ts` — the relevant prop already exists, just isn't wired up anywhere in `PassiveTree.tsx` yet (confirmed by reading the current file in full — no `preview` reference exists):

```ts
preview?: AllocationPreview | null;
```

Passed straight to `<TreeView preview={...} />` alongside the props already there.

**Important gotcha:** `edgeKey(a, b)` — the function that produces the `min-max` string format — exists in `dist/viewport.js`/`viewport.d.ts`, but **is not part of the package's public export surface**. Checked `dist/index.d.ts` directly: it only re-exports `TreeView`, its prop types, `RenderResources`, and the `*KeyFor` sprite-key helpers — `edgeKey` isn't among them. Don't deep-import an internal path to get it (fragile, unsupported, could break on any patch release). Instead, write your own tiny local version — the format is explicitly documented in two places (`viewport.d.ts` and `types.d.ts`) as `` `${min}-${max}` `` of the two node ids, so this is safe to reimplement:

```ts
function edgeKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}
```

### Computing the preview — the part that needs real care

`toggleAllocationInMode(data, startNode, currentAllocation, skill, mode, mainGraph)` (and `toggleAscendancyAllocation` for ascendancy nodes) already return a **new** allocation object without mutating the input — confirmed by how the existing code already uses it inside a `setState` updater (`setMain((cur) => toggleAllocationInMode(data, startNode, cur, skill, mode, mainGraph))`). That means you can safely call it "dry" — just to see what it *would* return — without ever calling `setMain`, which is exactly what a preview needs.

Sketch:
1. On tap (touch path only), call the toggle function with the current state to get `prospective`.
2. Diff `prospective.allocated` against the current `main.allocated` (as `Set<number>`) to get the changed node ids. If the count grew, `kind: 'add'`; if it shrank, `kind: 'remove'`.
3. For `edges`: iterate the tree's connections (available via `scene.connections`, or possibly more directly via `mainGraph` — check both, `scene.connections` is confirmed to exist and carry `.from`/`.to` since `TreeView.js` itself iterates it this way) and include an edge if both its endpoints are in the changed-node set and the edge's allocated-state actually flips between old and new (i.e. for `add`, both endpoints end up allocated and at least one wasn't before; for `remove`, both were allocated before and at least one isn't after).
4. This edge-diffing logic is the one part not directly copy-pasteable from anywhere — reason it through carefully and sanity-check against a couple of manual test allocations (e.g. allocate a single node one hop from the start, confirm exactly one edge lights up in the preview) before considering it done. Don't guess and move on if the highlighted path looks wrong when you actually look at it.
5. Same shape applies for ascendancy nodes via `toggleAscendancyAllocation` — check `node.ascendancyName` the same way `handleNodeClick` already branches today.

### Files that need changes

- **`PassiveTree.tsx`** — the touch-detection hook; split `handleNodeClick`'s logic into "compute + preview" (touch) vs. "commit immediately" (mouse, unchanged); new state for the pending preview + prospective allocation; pass `preview` to `<TreeView>`; a confirm handler that actually commits.
- **`NodeInfoPanel.tsx`** — needs a new optional "Allocate"/"Remove" button, shown only when there's a pending (unconfirmed) selection. `SelectedNode` (currently just `{name, stats}`) will need extending — probably a `pendingKind?: 'add' | 'remove'` field plus an `onConfirm?: () => void` prop on the component, or similar. Current full file content isn't reproduced here since you have direct file access — read it fresh before editing.

### What to verify at the end

The real one: `npm run type-check && npm run lint && npm test && npm run build`, actually run, actually green — not just "looks right." Then manually check on `/tree`: desktop click still commits immediately (no regression), a touch-emulated tap (Chrome DevTools device toolbar, or a real device) shows a preview + button without committing until pressed, and tapping a different node while one's pending swaps cleanly.
