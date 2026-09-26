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

import { parseCraft } from './craft';
import { GEAR_SLOTS, isGearSlot, type GearItem, type GearSlot } from './gearSlots';
import { isAllowedIconUrl, isSafeItemSlug } from './iconUrl';

/**
 * `jewels` rides alongside the 17 gear slots in the same jsonb column but is
 * keyed differently: by socket NODE ID (a string, since it round-trips
 * through jsonb), not by one of the 17 `GearSlot` keys — jewels aren't a gear
 * slot at all (see gearSlots.ts's `JEWEL_PSEUDO_SLOT`). Keying by node id
 * rather than array index or socket order means reallocating the tree can
 * never shuffle which jewel sits in which socket.
 *
 * An entry survives its socket being deallocated — the orphan rule in
 * docs/superpowers/specs/2026-09-20-jewels-design.md: respeccing must never
 * silently discard a chosen item. Neither this module nor jewelState.ts's
 * `summarizeJewels` ever prunes an entry; only an explicit user action
 * (JewelsSheet's Clear/Remove, wired in TreeBuildSession) does.
 */
export type GearState = Record<GearSlot, GearItem | null> & {
  jewels: Record<string, GearItem>;
};

/** All 17 slots empty and no jewels — the starting state for a build with no gear yet. */
export function emptyGearState(): GearState {
  const state = {} as GearState;
  for (const slot of GEAR_SLOTS) state[slot] = null;
  state.jewels = {};
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
    if (key === 'jewels') continue; // handled separately below — not a GearSlot
    if (!isGearSlot(key)) continue;
    const item = v[key];
    if (item === null) {
      state[key] = null;
    } else if (isGearItem(item) && isSafeItemSlug(item.slug)) {
      state[key] = withParsedCraft(withSafeIcon(item));
    }
    // Anything else (wrong shape) is left at the `null` default from emptyGearState.
  }
  state.jewels = parseJewelsRecord(v.jewels);
  return state;
}

/**
 * Defensive parse for `gear_state.jewels`. A malformed top-level value (not a
 * plain object — an array, a string, a number, ...) drops to `{}` rather than
 * crashing; a malformed individual entry is skipped the same way a malformed
 * gear slot is above, so one bad jewel can't blank the others.
 */
function parseJewelsRecord(value: unknown): Record<string, GearItem> {
  const jewels: Record<string, GearItem> = {};
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return jewels;
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (isGearItem(item) && isSafeItemSlug(item.slug)) jewels[key] = withParsedCraft(withSafeIcon(item));
  }
  return jewels;
}

/**
 * The item with an icon URL the write gate would refuse blanked to null. The
 * item itself is kept — its icon is the only thing that could reach another
 * viewer's browser as a request. Shared with gemState.ts.
 */
export function withSafeIcon<T extends GearItem>(item: T): T {
  return item.iconUrl === null || isAllowedIconUrl(item.iconUrl) ? item : { ...item, iconUrl: null };
}

/**
 * A gear or jewel item with its Slice 4 `craft` read defensively. An item
 * with no craft is returned untouched, so rows saved before Slice 4 read
 * exactly as they always did.
 */
function withParsedCraft(item: GearItem): GearItem {
  const raw = (item as unknown as Record<string, unknown>).craft;
  if (raw === undefined) return item;
  if (raw === null) {
    // "No craft" is an absent key; a null one is refused by the write gate.
    const rest = { ...item };
    delete rest.craft;
    return rest;
  }
  return { ...item, craft: parseCraft(raw, item.isUnique) };
}
