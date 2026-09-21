# Tree Jewels — Design

**Date:** 2026-09-20
**Status:** Decided by the user 2026-09-20. Resolves the open question in `2026-09-20-gear-design.md` §5.
**Scope:** Ships alongside Task 2 (gear), because it reuses the gear item picker.

---

## The decision

> "Tree Jewels can be listed in a nice project vaal themed box somewhere close to the tree. It should be clear to the user that the box exists and what items are inside."

So: a persistent, discoverable panel on the tree canvas — not a hidden chip, and not a row buried in the gear sheet.

The companion question (whether two-handed talismans must block the off-hand slot) is **deferred**: v1 enforces two-handed occupancy for no weapon at all, so talismans are not a special case. Recorded so it is a deliberate choice rather than an oversight.

---

## What the tree data already gives us

Checked against `public/data/tree/0.5.2/data.json` on 2026-09-20. Jewels are not something we have to invent a model for — the export already carries the sockets.

```
data.jewelSlots        31 node ids
  ...resolvable in data.nodes   19
  ...dangling (no such node)    12
```

**Trap 1 — twelve of the thirty-one ids do not exist in `data.nodes`.** Iterating `jewelSlots` and dereferencing blindly yields `undefined` for nearly 40% of them. Always filter to ids present in `data.nodes`.

**Trap 2 — the socket names are raw GGG string tokens, not display text.** The 19 real sockets carry:

| Name as stored | Count |
|---|---|
| `[Jewel] Socket` | 12 |
| `[SinisterJewelSockets\|Sinister] [Jewel] Socket` | 5 |
| `Crystalline Phylactery` | 1 |
| `Zarokh's Gift` | 1 |

`[X]` and `[X|Y]` are GGG's markup, where the piped form means "render Y". Printing these verbatim shows users literal brackets and pipes. They must be normalised for display (`[Jewel] Socket` → "Jewel Socket"; `[SinisterJewelSockets|Sinister] [Jewel] Socket` → "Sinister Jewel Socket"). `parseStatText` in `src/lib/tree/statText.ts` already unwraps this token family for tree stat tooltips — reuse it rather than inventing a second parser. (**Corrected 2026-09-21:** this line originally pointed at `src/lib/wiki/mentions.ts`, which contains no bracket-token handling at all; the implementer found the real parser.)

None of the 19 sit on an ascendancy, so socket availability is a pure main-tree concern.

**What this means for the model.** A jewel goes in a socket, and a socket has to be *allocated* like any other passive. So the panel is not a free-form list of jewels — it is a list of the sockets this build has actually taken, each either empty or holding a jewel. That is both truer to the game and more useful: it tells the user how many sockets they have and how many they have filled.

---

## Where the state lives

`gear_state.jewels`, keyed by socket node id:

```ts
// gear_state
{
  ...slots,
  jewels: { [socketNodeId: string]: { slug, name, category, isUnique, iconUrl } }
}
```

**Not `passive_state`,** even though jewels are conceptually tree-side. `passive_state` has a strict validator (`isPassiveState` in `src/app/api/builds/route.ts`) requiring exactly `set1`, `set2` and `ascendancyNodes` as number arrays, plus the pure converters `toPassiveState`/`fromPassiveState` and their round-trip tests — the best-tested part of this feature. Adding a fourth key means changing the validator, both converters, and that test suite, to store something that is a *selected item*, exactly like every other item in `gear_state`. The stored shape is byte-for-byte the gear slot shape. It belongs with gear.

Keying by node id (rather than by index) means reallocating the tree cannot silently shuffle which jewel sits in which socket.

**Orphan rule.** Deallocating a socket must **not** delete the jewel assigned to it. Users respec constantly, and silently discarding a chosen item is the same class of bug this whole migration exists to remove. Keep the entry, stop showing it as active, and surface it as described below. Prune only on an explicit user action.

---

## The panel

**Placement.** It joins the existing notice column at `inset-x-3 top-16` in `TreeBuildSession`, as its last child, with `self-start` so it takes only its content width and the rest of the strip stays `pointer-events-none` for canvas drags.

That column already exists and already stacks with `flex flex-col gap-2`, which is what keeps it from colliding with the draft-restore prompt or the load-error notice. The alternative — another independently positioned `absolute` overlay — is precisely how overlapping chrome happened before, and `e2e/mobile-layout.spec.ts` now fails the build for it. The four corners are taken: `TreeControls` (left-3 top-3), `BuildSavePanel` (right-3 top-3), `NodeInfoPanel` (inset-x-3 bottom-3, transient).

**Always rendered, because the user asked for the box to be obviously there.** Three states:

| Condition | Reads |
|---|---|
| No jewel socket allocated | `Jewels — allocate a socket on the tree` |
| Sockets allocated, some empty | `Jewels 1/3` + icon of each filled one, empty ones as outlined placeholders |
| A jewel is assigned to a socket no longer allocated | An extra `1 unsocketed` marker |

Collapsed height stays within the `h-11` tap-target rule. Tapping opens the jewel sheet.

**Sheet.** One row per allocated socket: normalised socket name, and the jewel in it or "Empty". Tapping a row opens the **same picker component gear uses**, filtered to category `Jewel` (22 entries, 13 unique). Unsocketed jewels list below the sockets with a Remove action — visible, never silently dropped.

**Theming — this is the part with a hard constraint.** `AGENTS.md`: GGG art may only depict real in-game content, and is never a reference or template for Project Vaal's own chrome. So:

- The box, its border, and any ornament are **original Project Vaal design**, built from the existing token vocabulary (`bg-card/95`, `border-border`, `backdrop-blur`, the accent used elsewhere in the app). Not a recreation of the game's jewel panel, and not "inspired by" a screenshot of it.
- The **jewel icons inside it are real wiki item icons**, which is squarely inside the sanctioned exception — they depict actual in-game items, sourced from official patch data via `@poe2-toolkit`.

That split is the whole rule in one component: our frame, their items.

---

## Testing

- **Unit:** socket-name normalisation (all four stored forms above); filtering `jewelSlots` to ids present in `data.nodes`; the orphan rule — deallocating a socket keeps its jewel and reports it as unsocketed.
- **E2E:** the panel is visible on `/tree` at 375px in all three states; it does not overlap any other overlay (already enforced generically by `e2e/mobile-layout.spec.ts`); a jewel picked through the sheet survives save and reload.
- **Data regression:** assert the resolvable socket count so a tree-export bump that changes it is caught rather than silently shrinking the panel.
