// src/lib/build/weaponSetColors.ts
// =============================================================================
// Single source of truth for the Set I / Set II colour language, shared by
// TreeControls' weapon-set paint mode and GearSheet's weapon-set switch. The
// gear design doc requires the gear sheet reuse "the tree's existing colour
// language for sets rather than inventing a second vocabulary" — pulling the
// two literals out to one module is what keeps that true if either one ever
// changes, instead of two files with the same hex codes typed twice.
// =============================================================================

import type { WeaponSet } from '@poe2-toolkit/tree-core';

/** Tailwind `bg-*` class per weapon set, for a small colour dot. */
export const WEAPON_SET_DOT: Record<WeaponSet, string> = {
  1: 'bg-[#e5484d]',
  2: 'bg-[#46a758]',
};
