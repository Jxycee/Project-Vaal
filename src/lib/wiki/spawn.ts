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
