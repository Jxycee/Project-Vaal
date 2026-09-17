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
