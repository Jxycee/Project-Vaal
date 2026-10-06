// src/lib/wiki/spawn.ts
// =============================================================================
// Whether a mod can spawn on a base — PoB2's first-match rule
// (src/Classes/Item.lua, ItemClass:GetModSpawnWeight): walk the mod's
// spawnWeights IN ORDER; the first tag the base carries decides, and weight 0
// excludes. No matching tag also excludes. Shared by the mod picker
// (modCatalogue.ts) and the validator (build/validate/affixRules.ts) so the
// two can never disagree. Pure.
// =============================================================================

export interface SpawnWeight {
  tag: string;
  weight: number;
}

export function canSpawn(spawnWeights: readonly SpawnWeight[], tags: ReadonlySet<string>): boolean {
  for (const { tag, weight } of spawnWeights) {
    if (tags.has(tag)) return weight > 0;
  }
  return false;
}

export type ModSource = 'normal' | 'desecrated' | 'essence';

/**
 * Where a mod can come from on a base — null if it cannot be on it at all.
 *
 * Three real sources exist on an `Item`-domain base, and the data carries them
 * differently (checked on public/data/wiki/2026-08-25/mods, 2026-10-05):
 * - normal: same domain, and the first-match spawn rule passes.
 * - desecrated: domain "Unveiled" (the Abyss / Desecration pool). It names its
 *   item classes with weight-1 tags beside a god tag (amulet + amanamu_mod), so
 *   the same first-match rule decides the class. Items only: an Unveiled jewel
 *   mod sits on bases of another domain and is excluded by that.
 * - essence: an `Item` mod whose only weight is `default: 0` — nothing rolls it
 *   naturally. Our data does not say which class an essence suits, so any
 *   Item-domain base is allowed; the id says "Essence". The other 600-odd
 *   zero-weight Item mods (handwraps/alloy/genesis leftovers) are not
 *   obtainable that way and stay excluded.
 */
export function modEligibility(
  mod: { slug: string; domain: string; spawnWeights: readonly SpawnWeight[] },
  base: { modDomain: string | null; tags: ReadonlySet<string> },
): ModSource | null {
  if (base.modDomain === null) return null;
  if (mod.domain === 'Unveiled') {
    return base.modDomain === 'Item' && canSpawn(mod.spawnWeights, base.tags) ? 'desecrated' : null;
  }
  if (mod.domain !== base.modDomain) return null;
  if (canSpawn(mod.spawnWeights, base.tags)) return 'normal';
  if (mod.domain === 'Item' && /essence/.test(mod.slug) && mod.spawnWeights.every((w) => w.weight === 0 && w.tag === 'default')) return 'essence';
  return null;
}
