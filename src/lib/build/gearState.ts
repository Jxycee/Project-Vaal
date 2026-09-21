// src/lib/build/gearState.ts
// =============================================================================
// Gear state storage helpers — the gear-slot analogue of passiveState.ts.
//
// Stored in builds.gear_state as a jsonb object keyed by slot. The column is
// NOT NULL with a `{}` default (see src/types/database.ts), and — unlike
// passive_state — a slot simply absent from the object means "empty," so
// there is no "always write all 17 keys" requirement the way passiveState.ts
// has for set1/set2/ascendancyNodes. parseGearState defensively validates
// whatever jsonb comes back (a hand-edited row, a future migration, a slug
// that no longer parses as valid JSON) rather than trusting the database.
// =============================================================================

import { GEAR_SLOTS, isGearSlot, type GearItem, type GearSlot } from './gearSlots';

export type GearState = Record<GearSlot, GearItem | null>;

/** All 17 slots empty — the starting state for a build with no gear yet. */
export function emptyGearState(): GearState {
  const state = {} as GearState;
  for (const slot of GEAR_SLOTS) state[slot] = null;
  return state;
}

/** Shape-check for one stored gear item. Guards against a malformed jsonb value reaching the UI as a crash instead of an empty slot. */
export function isGearItem(value: unknown): value is GearItem {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.slug === 'string' &&
    typeof v.name === 'string' &&
    typeof v.category === 'string' &&
    typeof v.isUnique === 'boolean' &&
    (v.iconUrl === null || typeof v.iconUrl === 'string')
  );
}

/**
 * `builds.gear_state` (raw jsonb) -> typed, fully-keyed `GearState`.
 *
 * Every one of the 17 slots is present in the result even if the stored
 * object is missing keys entirely (a brand-new build) or is malformed (each
 * bad slot falls back to `null` independently — one corrupt slot must not
 * blank the other 16).
 */
export function parseGearState(raw: unknown): GearState {
  const state = emptyGearState();
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return state;
  const v = raw as Record<string, unknown>;
  for (const key of Object.keys(v)) {
    if (!isGearSlot(key)) continue;
    const item = v[key];
    if (item === null) {
      state[key] = null;
    } else if (isGearItem(item)) {
      state[key] = item;
    }
    // Anything else (wrong shape) is left at the `null` default from emptyGearState.
  }
  return state;
}
