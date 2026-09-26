// src/lib/build/validate/reservation.ts
// =============================================================================
// Spirit reserved by a checkpoint's gem loadouts, per weapon set — the raw
// total, BEFORE reservation multipliers or efficiency. Comparing it with the
// character's Spirit waits for the Slice 5 engine: Spirit comes from quests,
// item bases, flat and % passives, and nodes that derive it from body-armour
// ES/Evasion or Life, halve it, or remove it — see
// plans/2026-09-24-slice3-structural-validation.md.
//
// A support's own reservation ADDS to its skill's: PoB2 turns a support's
// `spiritReservationFlat` into an `ExtraSpirit` BASE mod on the skill
// (src/Modules/CalcActiveSkill.lua).
//
// Pure: the caller fetches each gem's `scaling[]` and passes it in.
// =============================================================================

import type { GemState } from '../gemState';

/** The two fields of a skill record's `scaling[]` entry this module reads. */
export interface ScalingEntry {
  level: number;
  reservation: number | null;
}

export interface ReservedSpirit {
  set1: number;
  set2: number;
  /** Slugs whose scaling data was absent or empty — their reservation is unknown, not zero. */
  missing: string[];
}

/** The entry for `level`, else the nearest lower level, else the lowest one there is. */
function entryAt(scaling: readonly ScalingEntry[], level: number): ScalingEntry {
  const sorted = [...scaling].sort((a, b) => a.level - b.level);
  let found = sorted[0];
  for (const entry of sorted) {
    if (entry.level <= level) found = entry;
  }
  return found;
}

export function reservedSpirit(gems: GemState, scalingBySlug: ReadonlyMap<string, readonly ScalingEntry[]>): ReservedSpirit {
  const result: ReservedSpirit = { set1: 0, set2: 0, missing: [] };

  const reservationOf = (slug: string, level: number): number => {
    const scaling = scalingBySlug.get(slug);
    if (!scaling || scaling.length === 0) {
      if (!result.missing.includes(slug)) result.missing.push(slug);
      return 0;
    }
    return entryAt(scaling, level).reservation ?? 0;
  };

  for (const loadout of gems.loadouts) {
    if (!loadout.skill) continue;
    // Supports carry no level of their own (every Support Gem caps at 1 in our data).
    const total =
      reservationOf(loadout.skill.slug, loadout.level) + loadout.supports.reduce((sum, s) => sum + reservationOf(s.slug, 1), 0);
    if (loadout.sets.includes(1)) result.set1 += total;
    if (loadout.sets.includes(2)) result.set2 += total;
  }
  return result;
}
