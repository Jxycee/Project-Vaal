// Pure helpers for the build page (/builds/[shareToken]). No React, no fetch.
// Spec: docs/superpowers/specs/2026-09-27-build-profile-redesign-design.md §4-§5.
import type { WeaponSet } from '@poe2-toolkit/tree-core';
import { GEAR_SLOTS, type GearItem, type GearSlot } from './gearSlots';
import type { GearState } from './gearState';
import type { GemLoadout, GemState } from './gemState';

export const BUILD_TABS = ['overview', 'gear', 'skills', 'tree', 'stats'] as const;
export type BuildTab = (typeof BUILD_TABS)[number];

export const BUILD_TAB_LABELS: Record<BuildTab, string> = {
  overview: 'Overview',
  gear: 'Gear',
  skills: 'Skills',
  tree: 'Tree',
  stats: 'Stats',
};

/** `?tab=` → a tab. Anything unknown (including other casings) is Overview, the default. */
export function parseTab(raw: string | null | undefined): BuildTab {
  return (BUILD_TABS as readonly string[]).includes(raw ?? '') ? (raw as BuildTab) : 'overview';
}

/**
 * The main skill's loadout, by deriveMainSkill's rule (gemState.ts, the single
 * definition of what builds.main_skill means): the primary loadout if it holds
 * a skill, else the first loadout that does. Null when no loadout has a skill.
 */
export function mainSkillLoadout(gems: GemState): GemLoadout | null {
  const primary = gems.loadouts.find((l) => l.id === gems.primaryId);
  if (primary?.skill) return primary;
  return gems.loadouts.find((l) => l.skill !== null) ?? null;
}

/** Main skill first, everything else in stored order. */
export function loadoutsMainFirst(gems: GemState): GemLoadout[] {
  const main = mainSkillLoadout(gems);
  return main ? [main, ...gems.loadouts.filter((l) => l !== main)] : gems.loadouts;
}

/** The weapon set the header's stats describe: the main skill's first tagged set, else Set I. */
export function headlineSet(gems: GemState): WeaponSet {
  return mainSkillLoadout(gems)?.sets[0] ?? 1;
}

const OTHER_SET_WEAPONS: Record<WeaponSet, readonly GearSlot[]> = {
  1: ['weapon2_main', 'weapon2_off'],
  2: ['weapon1_main', 'weapon1_off'],
};
const SET_WEAPONS: Record<WeaponSet, readonly GearSlot[]> = {
  1: ['weapon1_main', 'weapon1_off'],
  2: ['weapon2_main', 'weapon2_off'],
};

/** What Overview shows as "key items": this set's weapons, then every unique (gear, then jewels), each once. */
export function keyItems(gear: GearState, set: WeaponSet): GearItem[] {
  const out: GearItem[] = [];
  const add = (i: GearItem | null) => {
    if (i && !out.includes(i)) out.push(i);
  };
  for (const slot of SET_WEAPONS[set]) add(gear[slot]);
  for (const slot of GEAR_SLOTS) {
    if (OTHER_SET_WEAPONS[set].includes(slot)) continue;
    const i = gear[slot];
    if (i?.isUnique) add(i);
  }
  for (const i of Object.values(gear.jewels)) if (i.isUnique) add(i);
  return out;
}

/**
 * The checkpoint switcher's trigger label (slice 3): the checkpoint's name,
 * with `· Lvl N` appended only if the name doesn't already spell out that
 * level number — otherwise a checkpoint named "Level 20" would show the
 * redundant "Level 20 · Lvl 20". A word-boundary match so "Level 120" isn't
 * mistaken for containing "12" at level 12.
 */
export function checkpointLabel(name: string, level: number): string {
  const hasLevel = new RegExp(`(?:^|\\D)${level}(?:\\D|$)`).test(name);
  return hasLevel ? name : `${name} · Lvl ${level}`;
}

/** `search` with `patch` applied (null deletes). Returns '' or a string starting with '?'. */
export function patchQuery(search: string, patch: Record<string, string | null>): string {
  const params = new URLSearchParams(search);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}
