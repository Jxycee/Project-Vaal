import type { WeaponSet } from '@poe2-toolkit/tree-core'

/**
 * Vaal's stored `builds.passive_state` shape (see supabase/schema.sql) and
 * its reconciliation with `@poe2-toolkit/tree-core`'s runtime
 * `BuildAllocation` — the open item this resolves was originally logged in
 * docs/superpowers/plans/poe2-console-hub-plan7_12_2026.md §13, written
 * before `@poe2-toolkit` was adopted (2026-07-11) and before its actual
 * `BuildAllocation`/`ClassDef`/`AscendancyDef` shapes had been read
 * directly. Resolved 2026-08-28 against the installed package's real
 * `dist/types.d.ts`, not assumption.
 *
 * DB: `{ set1: number[], set2: number[] }`. A node in both arrays is
 * shared/basic (active regardless of equipped weapon set); a node in only
 * one is specific to that set.
 *
 * tree-core: `BuildAllocation.allocated` is every allocated node id across
 * both sets plus shared nodes; `weaponSets` maps a node id to `1 | 2` ONLY
 * when it's set-specific — a shared node gets no entry at all. tree-core's
 * own doc comment on `weaponSets` states "Keystones, jewel sockets and
 * ascendancy nodes are always basic" — i.e. there is no separate ascendancy
 * array anywhere in `BuildAllocation`. An earlier revision of the planning
 * doc's `passive_state` example included an `ascendancyNodes` field; it was
 * never actually implemented in the live schema (confirmed against the live
 * default via Supabase), and per tree-core's own model it shouldn't be —
 * ascendancy nodes fold into the exact same "shared" case as any other
 * basic node, which this two-array shape already represents correctly with
 * no third array needed.
 */
export interface PassiveState {
  set1: number[]
  set2: number[]
}

/** The two `BuildAllocation` fields this module resolves. */
export interface AllocationCore {
  allocated: number[]
  weaponSets: Record<number, WeaponSet>
}

/** DB -> tree-core's runtime shape. */
export function toBuildAllocation(state: PassiveState): AllocationCore {
  const inSet1 = new Set(state.set1)
  const inSet2 = new Set(state.set2)
  const allocated = new Set<number>([...state.set1, ...state.set2])
  const weaponSets: Record<number, WeaponSet> = {}
  for (const id of allocated) {
    const set1 = inSet1.has(id)
    const set2 = inSet2.has(id)
    if (set1 && !set2) weaponSets[id] = 1
    else if (set2 && !set1) weaponSets[id] = 2
    // else: in both -> shared/basic, no entry (matches tree-core's own
    // "absent = shared" convention).
  }
  return { allocated: [...allocated], weaponSets }
}

/** tree-core's runtime shape -> DB. Inverse of {@link toBuildAllocation}. */
export function fromBuildAllocation(allocation: AllocationCore): PassiveState {
  const set1: number[] = []
  const set2: number[] = []
  for (const id of allocation.allocated) {
    const set = allocation.weaponSets[id]
    if (set === 1) set1.push(id)
    else if (set === 2) set2.push(id)
    else {
      // Shared/basic (including ascendancy nodes) — present in both.
      set1.push(id)
      set2.push(id)
    }
  }
  return { set1, set2 }
}

/**
 * `BuildAllocation.classId` per tree-core's own `ClassDef.id` doc comment:
 * "Integer class id = index in GGG's `classes` array (Witch = 1)". Derivable
 * directly from the vendored tree data — the caller passes in the already-
 * fetched `classes` array (this module doesn't fetch; see the console-hub
 * plan's "passive tree JSON is a runtime-fetched /public asset, never
 * import-ed" decision) — no need to run tree-core's own parser just to
 * resolve an id.
 */
export function resolveClassId(classes: { name: string }[], className: string): number | undefined {
  const index = classes.findIndex((c) => c.name === className)
  return index === -1 ? undefined : index
}

/**
 * `BuildAllocation.ascendId` is NOT a separate lookup: tree-core's
 * `AscendancyDef.id` doc comment defines it as "Display name, also the
 * build's ascendancy key" — the same display string already stored in
 * `builds.ascendancy` (e.g. "Deadeye"), distinct from `AscendancyDef.
 * internalId` (GGG's own `Ranger1`-style key, which `.build` export uses
 * instead — see docs/superpowers/specs/2026-08-28-builds-feature-research.md
 * §2). `ascendId: build.ascendancy ?? undefined` is the whole conversion —
 * not worth a function.
 */
