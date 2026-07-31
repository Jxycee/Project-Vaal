# Handoff to Claude Code — Abyssal Lich Ascendancy + `tree-react` Rebuild Performance

**Context:** Point-budget UI and the credit-label/mobile-preview work are done (verified by reading the actual shipped code, not just taken on faith — including a bonus fix Claude Code found on its own: a BFS pathing bug where allocation could shortcut through *other* classes' start nodes, now fixed via `pathingGraph` in `PassiveTree.tsx`). This handoff covers the two hardest remaining passive-tree items, both involving real changes to vendored third-party library code via `patch-package` — higher blast-radius than anything done so far, so both tasks below front-load all the raw-data verification already done, specifically so you don't have to re-derive it. Everything stated as fact below was checked directly against the actual vendored `data.json` and the actual `tree-core`/`tree-react` source in `node_modules` — not assumed, not taken from the plan doc's older, slightly-less-precise notes.

**Existing patch infrastructure to build on:** `patches/@poe2-toolkit+tree-react+0.7.2.patch` already exists (weapon-set colors, `worldLabels`) — applied automatically via `postinstall` (`patch-package`). Both tasks below add to this same mechanism; `tree-core` doesn't have a patch file yet, so Task 1 creates the first one (`patches/@poe2-toolkit+tree-core+0.4.1.patch`).

**Plan doc:** `docs/superpowers/plans/poe2-console-hub-plan7_12_2026.md` (check for a newer dated file first). Update its §13 entries for these two items when done, following its own "targeted section edits, dated" convention — don't rewrite the whole doc.

-----

## Task 1: Abyssal Lich ascendancy

### The mechanism, fully verified against the real vendored `data.json`

Every ascendancy needs a `name` AND a dedicated node with `isAscendancyStart: true` to survive `tree-core`'s own filter (`ggg/normalize.js`, `normalizeClass`):

```js
ascendancies: (raw.ascendancies ?? [])
    .filter((asc) => Boolean(asc.name) && ascendancyStarts.has(asc.id))
    .map((asc) => normalizeAscendancy(asc, ascendancyStarts)),
```

Abyssal Lich (`Witch3b`) has a name but zero nodes of its own — it reuses Lich's (`Witch3`) exact graph, positions, and connections, with **13 specific nodes swapped** for different name/icon/stats. `mapAscendancyStarts`' own doc comment in the library already names this exact case: *"Ascendancies with no nodes (e.g. unreleased 'Abyssal Lich') are simply absent."* So the author is aware of the shape; it's just not handled yet.

**Checked and confirmed: this is currently the *only* ascendancy in the whole tree with this pattern** (verified by scanning every class's ascendancies for "named, no dedicated start, non-empty `overridePairs`" — Abyssal Lich is the sole match right now). Worth generalizing anyway rather than hardcoding "Witch3b" specifically, for the reason below.

**Where the override data actually lives (verified directly, not assumed):**
- `Witch.overridePairs` (class-level, 23 entries) — a *different, unrelated* table. `tree-core`'s `normalizeClass` currently reads exactly this field and passes it through as `TreeData.classes[].overridePairs` — **this is not the data Abyssal Lich needs.**
- `Witch.ascendancies[].overridePairs` — **each ascendancy carries its own**, keyed separately. Lich's (`Witch3`) is `[]` (empty — it's the base). Abyssal Lich's (`Witch3b`) has **13 entries**, e.g. `{"23352": 390, "26085": 41162, ...}` — base skill id → alternate skill id.
- The alternate IDs (390, 41162, etc.) are **not real positioned nodes** — confirmed directly, they don't exist anywhere in `raw.nodes`. They resolve through the same global `raw.skillOverrides` table `tree-core` already reads for the three generic Str/Dex/Int attribute nodes (`mapAttributeOptions` in the same file). Example, verified directly:
  ```json
  "390": {
    "id": "AscendancyAltWitch1Notable1",
    "skill": 390,
    "name": "Rupture the Flesh",
    "icon": "Art/2DArt/SkillIcons/passives/Lich/LichCursedEnemiesExplodeChaos.png",
    "isNotable": true,
    "ascendancyId": "Witch3b",
    "stats": ["[Curse|Cursed] Enemies Killed by you... Explode, dealing a quarter of their maximum Life as [Physical] Damage"]
  }
  ```
  Note it's already tagged `"ascendancyId": "Witch3b"` directly in the raw data — a strong, reliable signal, not an inference.
- **Base node ids in the override table each carry their own `ascendancyId` too** (e.g. base id `23352`'s raw node has `"ascendancyId": "Witch3"`). This is the key to a *general*, data-driven fix rather than string-matching on ID suffixes (`"Witch3b"` → strip trailing letter → `"Witch3"` would also work, but is a naming-convention assumption GGG hasn't documented; reading the base ids' own `ascendancyId` field is the same information without assuming a convention holds for whatever the next hidden ascendancy's ID looks like).

Also worth knowing: the override table has 13 entries, not "~3" — the 3 renamed notables community build guides describe (Umbral Well, Unwilling Offering, Steward of Kulemak replacing their Lich counterparts) are just the headline changes; the rest are smaller passive swaps GGG doesn't advertise as prominently but are equally real in the data.

### The fix — `tree-core` (new patch file)

In `ggg/normalize.js`:

1. **Resolve a "base ascendancy" for any named ascendancy with no dedicated start but a non-empty `overridePairs`.** General, data-driven — not an ID-suffix string match:
   ```js
   function resolveBaseAscendancyId(overridePairs, rawNodes) {
     for (const baseIdStr of Object.keys(overridePairs ?? {})) {
       const node = rawNodes[baseIdStr];
       if (node?.ascendancyId) return node.ascendancyId;
     }
     return null;
   }
   ```
2. **Loosen the filter** in `normalizeClass` so an ascendancy with a resolvable base ascendancy is kept, not dropped — it should reuse that base ascendancy's start position (via `ascendancyStarts.get(baseAscendancyId)` instead of its own, since it has none).
3. **Resolve the override map to full definitions, not raw id pairs**, so downstream code doesn't need a second lookup into `skillOverrides`. Add a field to `AscendancyDef` (check `types.d.ts` for its current exact shape before adding — don't guess the type) carrying something like:
   ```ts
   nodeOverrides?: Record<number, { name: string; icon: string; stats: string[] }>
   ```
   populated by resolving each `overridePairs` entry's alternate id against `raw.skillOverrides`.
4. **Confirm `buildAscendancyGraph`/`buildScene` still work unmodified for Abyssal Lich** — since it shares Lich's exact graph, this should Just Work once it passes the filter and gets Lich's start position; don't add graph-topology special-casing unless something actually breaks, since the whole point is it's the *same* graph.

### The fix — `tree-react` (extends the existing patch)

The graph/positions need zero changes — only what's *displayed* for the 13 overridden node ids, and only when Abyssal Lich specifically is the active ascendancy (not when browsing Lich itself, which should keep showing its own real names/stats).

- **Name/stats (tooltip, `NodeInfoPanel`):** likely doesn't need a `tree-react` patch at all — this can probably be handled entirely in `PassiveTree.tsx`'s own `handleNodeClick`/`handleNodeHover`, by checking whether the active ascendancy has a `nodeOverrides` entry for the hovered/tapped skill id and substituting the override's name/stats before setting `selectedNode`/`hoveredNode`. Try this first; it's zero library-patch risk.
- **Icon on the actual canvas:** this part likely *does* need the `tree-react` patch, since `buildNode`'s sprite comes from `nodeVisual(node)` reading the scene's own node data, not something swappable from our app layer. Check `sceneStyle.js`'s `nodeVisual` and `buildNode` in `TreeView.js` for the exact hook point — the icon key resolution is where an override would need to substitute the alternate icon path when the active ascendancy matches.

### Verification

- A small test on `normalizeGggTree` run against the real vendored `data.json`: Witch's ascendancy list includes "Abyssal Lich"; its `nodeOverrides` (or whatever the field ends up named) has exactly 13 entries; each entry's resolved name matches what's in `skillOverrides` (spot-check the 3 documented ones: "Rupture the Flesh", "Umbral Well", "Unwilling Offering").
- Manual: select Witch → Abyssal Lich in the picker (it should now appear at all — that's the headline bug). Confirm the graph renders identically positioned to Lich. Tap/hover the swapped nodes and confirm the alternate name/stats show; tap/hover an *unswapped* Lich node and confirm it's unaffected. Switch back to plain Lich and confirm nothing about Lich's own display changed.

-----

## Task 2: `tree-react` full-scene-rebuild performance

### The actual architecture, traced through the real source (not re-describing the known symptom)

`TreeView.js`'s `rebuild()` callback depends on `[scene, resources, centreSprites, activeClassId, activeAscendancy, debugIds]` and calls a module-level `buildScene(...)` (tree-react's own internal function — not `tree-core`'s exported one of the same name) that unconditionally does, every single time:
```js
centreLayer.removeChildren().forEach((child) => child.destroy());
effectLayer.removeChildren().forEach((child) => child.destroy());
nodeLayer.removeChildren().forEach((child) => child.destroy());
ascLayer.removeChildren().forEach((child) => child.destroy());
labelLayer.removeChildren().forEach((child) => child.destroy());
connLayer.clear();
```
...then rebuilds literally every node sprite (1500+) and every connection path from scratch. Since `scene` is recomputed on every single allocation click, this runs in full on every click — real, wasteful work, but at least it's *one* rebuild per click.

**The separately-triggered, purely-wasteful rebuilds** come from this effect, also in `TreeView.js`:
```js
for (const url of urls) {
  if (texRef.current.images.has(url)) continue;
  const image = new Image();
  image.onload = () => {
    texRef.current.images.set(url, image);
    rebuildRef.current?.();   // <- calls the FULL rebuild, for a centre-art image
  };
  image.src = url;
}
```
This loads the centre portrait + ring art (and would load jewel icons, if any were allocated — none are yet, since gear/Save-to-Build isn't built, so that part of this effect is currently a no-op). Each image's `onload` triggers the *entire* `buildScene` — all 1500+ node sprites destroyed and recreated — just to place 1-2 centre-art sprites. This is the concrete cause of the multiple long tasks spread across several seconds that Lighthouse showed earlier.

### Recommended approach — tiered, so a real win ships even if the harder part doesn't

**Tier 1 (do this, it's safe and a real, immediate win):** `buildCentre(centreLayer, scene, centreSprites, activeClassId, tex)` already exists as an isolated function that only touches `centreLayer` — it's not tangled up with node/connection rebuilding. Patch the image-loading effect to call a narrower "rebuild centre only" path (expose a second ref, e.g. `rebuildCentreRef`, pointing at just `buildCentre`) instead of the full `rebuildRef.current?.()`, when the loaded image is a centre-art URL. This alone eliminates 2 of the current several full rebuilds per page load (portrait + ring), with no risk to node/connection rendering since that code path isn't touched at all. Jewel-icon URLs can keep triggering the full rebuild for now (harmless — that set is empty until gear exists), but don't special-case it out; just leave it be so it stays correct once jewels are eventually used.

**Tier 2 (real, valuable, genuinely harder — attempt if it's going well, don't force it):** reduce what a normal *allocation-driven* rebuild touches, so clicking one node doesn't re-touch 1500+ sprites.
- **Nodes:** maintain an id-indexed map (`Map<skillId, Sprite | Sprite[]>`) built on the first full build per class/ascendancy. On a scene change where only allocation changed (not class/ascendancy/resources/centreSprites), diff which node ids actually flipped active state and update just those sprites' `.tint` in place — a GPU uniform change, not a destroy+recreate. Skip everything else entirely.
- **Connections:** `connLayer` is a single `Graphics` object built via cumulative path calls — Pixi's `Graphics` API has no partial-invalidation, so this needs splitting into (at least) two persistent Graphics: one for rails whose active-state basically never changes once a class/ascendancy is picked, one for rails that do change with allocation. Only the second needs redrawing on a normal click.
- **When a full rebuild is still correct:** class switch, ascendancy switch, `resources`/`centreSprites` changing — these actually do need everything touched. The optimization is specifically "allocation changed, nothing else did → cheap path."

If Tier 2 turns out riskier or more time-consuming than it's worth, ship Tier 1 alone, verify it, and leave Tier 2 as a documented, still-open item — a real, working, verified partial improvement beats a half-finished risky rewrite. Use your own judgment on where that line is; you have visibility into how the actual patch is going that this handoff can't have in advance.

### Verification

- Re-run the same kind of check from earlier this session: load `/tree`, open Chrome DevTools Performance (or just check `performance.getEntriesByType('longtask')` after a fresh load), confirm the count/total duration of long tasks dropped meaningfully versus before.
- Manually confirm all of: class switch still renders correctly, ascendancy switch still renders correctly, allocating/deallocating a node still visually updates (tint changes correctly), the credit-label `worldLabels` still persists correctly (it's rendered once at mount, independent of rebuilds — shouldn't be affected either way, but confirm it wasn't disturbed).

-----

## General notes for both tasks

- Both are `patch-package` patches to code neither of us wrote — read the surrounding code in each file before changing it, the same way this handoff's own claims were verified against real source rather than assumed. If something doesn't match what's described here (versions can drift), trust the actual code over this document and note the discrepancy.
- Run the full gate after each task independently, not just once at the very end: `npm run type-check && npm run lint && npm test && npm run build`. Committing Task 1 and Task 2 as separate commits (or even separate small commits within each) is worth doing given the risk level — easier to isolate a regression to one specific change if something breaks later.
- Update the plan doc's §13 entries for these two items once actually verified working — not before.
