// src/lib/build/gemLevels.ts
// =============================================================================
// A skill gem cannot exceed the gem level its character level allows: gem
// level N needs character level >= levelRequirement[N - 1]. A Path of Building
// import holds ONE skill set for every checkpoint, so the final checkpoint's
// level-20 gems sit on a level-31 checkpoint; the numbers read at that
// checkpoint (Spirit reserved, skill-granted buffs, the Skills tab) use the
// EFFECTIVE level instead. The stored level is never changed or saved.
//
// Failure modes (each degrades to "use the stored level", never throws):
//   1. Unknown slug (not in the table): ungated, stored level returned.
//   2. Support gem: omitted from the table by the sync script, so ungated.
//   3. Stored level 0, negative, or non-integer: returned as it came (the
//      callers already treat it as they did before); only a level >= 1 is gated.
//   4. Stored level above the requirement array's length: levels past the end
//      need what the last entry needs (PoB's table plateaus there), so a stored
//      45 on a 40-entry array is kept when the last entry is met.
//   5. Table missing or its fetch failed (null/undefined): every gem unchanged.
//   6. Malformed table (bySlug index out of range, array not numbers): that
//      gem is ungated.
//   7. Character level 1: the largest N whose requirement is <= 1 (at least 1).
//   8. Character level 100 (or any level above the requirements): stored level
//      returned unchanged; gating only ever lowers.
//   9. Character level not finite (NaN, Infinity, undefined): unchanged.
//  10. Empty loadout (no skill): left as is. Empty gem state: returned as an
//      equal copy.
//  11. A skill whose requirement array is empty: ungated (no level data).
//  12. The input GemState is never mutated; the copy shares unchanged loadouts.
// =============================================================================

import type { GemLoadout, GemState } from './gemState';

/** public/data/wiki/<version>/gem-level-requirements.json (scripts/sync-gem-level-requirements.ts). */
export interface GemLevelTable {
  /** arrays[i][n - 1] = the character level gem level n needs. */
  arrays: number[][];
  /** Active skill gem slug -> index into `arrays`. Support gems are absent. */
  bySlug: Record<string, number>;
}

/** The highest gem level `characterLevel` allows, never above `storedLevel`, never below 1 (unless the stored level is). */
export function effectiveGemLevel(
  table: GemLevelTable | null | undefined,
  slug: string,
  storedLevel: number,
  characterLevel: number,
): number {
  if (!table || !Number.isFinite(characterLevel) || !Number.isFinite(storedLevel) || storedLevel < 1) return storedLevel;
  const idx = Object.prototype.hasOwnProperty.call(table.bySlug, slug) ? table.bySlug[slug] : undefined;
  const req = idx === undefined ? undefined : table.arrays[idx];
  if (!Array.isArray(req) || req.length === 0 || !req.every((n) => typeof n === 'number' && Number.isFinite(n))) return storedLevel;
  for (let n = Math.floor(storedLevel); n >= 1; n--) {
    if (req[Math.min(n, req.length) - 1] <= characterLevel) return n;
  }
  return 1;
}

/**
 * `gems` with each skill's level clamped to what `characterLevel` allows. Supports carry no level. Never mutates:
 * a changed state is a new object, and an unchanged one is returned as is (a stable identity for memoised callers).
 */
export function gemsAtCharacterLevel(gems: GemState, table: GemLevelTable | null | undefined, characterLevel: number): GemState {
  if (!table || !Number.isFinite(characterLevel)) return gems;
  let changed = false;
  const loadouts = gems.loadouts.map((l): GemLoadout => {
    if (!l.skill) return l;
    const level = effectiveGemLevel(table, l.skill.slug, l.level, characterLevel);
    if (level === l.level) return l;
    changed = true;
    return { ...l, level };
  });
  return changed ? { ...gems, loadouts } : gems;
}
