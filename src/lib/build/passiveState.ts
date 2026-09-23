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

function isFiniteNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((n) => typeof n === 'number' && Number.isFinite(n));
}

/**
 * `builds.passive_state` (raw jsonb, as `get_build_by_share_token` returns it
 * — untyped `Json`, same reasoning `parseGearState`/`parseGemState` document)
 * -> validated `PassiveState`. Falls back to all-empty rather than throwing,
 * same "one bad column must not crash the page" rule the other two parsers
 * follow. `POST /api/builds` validates the same shape inline as a private
 * `isPassiveState` (it only ever needs the boolean, never a fallback value,
 * since a malformed body there is a 400) — this is the read-side, defensive
 * counterpart for a row already in the database.
 */
export function parsePassiveState(raw: unknown): PassiveState {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { set1: [], set2: [], ascendancyNodes: [] };
  }
  const v = raw as Record<string, unknown>;
  return {
    set1: isFiniteNumberArray(v.set1) ? v.set1 : [],
    set2: isFiniteNumberArray(v.set2) ? v.set2 : [],
    ascendancyNodes: isFiniteNumberArray(v.ascendancyNodes) ? v.ascendancyNodes : [],
  };
}
