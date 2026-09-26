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

/**
 * What a base's implicit lines change about crafting it. Two kinds exist in
 * our data (checked 2026-09-26): "+1 Prefix Modifier allowed" /
 * "-2 Suffix Modifiers allowed" on the Dusk, Gloam, Penumbra, Tenebrous,
 * Absent, Distorted, Lament, Portent and Twisted amulets and rings, and
 * "Can roll Ring Modifiers" on the Grasping Mail bodies.
 *
 * The limit shifts are read from the text exactly as PoB2 reads them
 * (src/Classes/Item.lua:1263-1267) and applied per rarity by the caller
 * (see affixLimits). PoB2 has no rule for "Can roll Ring Modifiers"; here it
 * gives the base the `ring` spawn tag as well, so ring mods pass the same
 * first-match rule a ring does.
 */
export interface BaseCraftRules {
  prefixDelta: number;
  suffixDelta: number;
  extraTags: string[];
}

export function craftRulesOf(implicitLines: readonly string[]): BaseCraftRules {
  const rules: BaseCraftRules = { prefixDelta: 0, suffixDelta: 0, extraTags: [] };
  for (const line of implicitLines) {
    const shift = /^([+-]\d+) (Prefix|Suffix) Modifiers? allowed$/i.exec(line.trim());
    if (shift) {
      if (shift[2].toLowerCase() === 'prefix') rules.prefixDelta += Number(shift[1]);
      else rules.suffixDelta += Number(shift[1]);
    }
    if (/^Can roll Ring Modifiers$/i.test(line.trim()) && !rules.extraTags.includes('ring')) rules.extraTags.push('ring');
  }
  return rules;
}

/** A base's spawn tags plus any its implicits add (craftRulesOf). */
export function spawnTagsOf(tags: readonly string[], implicitLines: readonly string[]): Set<string> {
  return new Set([...tags, ...craftRulesOf(implicitLines).extraTags]);
}
