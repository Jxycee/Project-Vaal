// src/lib/build/gemSlots.ts
// =============================================================================
// Gem pseudo-slot vocabulary and its skill-index category mapping.
//
// Gems live in the SKILL index, whose `category` vocabulary is disjoint from
// the item index's — which is why these are pseudo-slots carrying a wiki
// KIND as well as a category list (see GET /api/wiki/items'
// `filterForParam`). Same trick as gearSlots.ts's JEWEL_PSEUDO_SLOT, one
// level more general.
//
// Category strings verified against public/data/wiki/2026-08-25/skill-index
// .json on 2026-09-22: the only four values in that file are 'Active Skill
// Gem' (419), 'Support Gem' (616), 'Spirit Gem' (39) and 'Unused / Removed'
// (44). 'Unused / Removed' is cut content ([DNT-UNUSED] names) and is never
// offered.
// =============================================================================

/** A skill socket takes an active gem or a Meta/Spirit gem. */
export const GEM_SKILL_PSEUDO_SLOT = 'gem_skill';
/** A support socket takes a support gem. */
export const GEM_SUPPORT_PSEUDO_SLOT = 'gem_support';

export type GemPseudoSlot = typeof GEM_SKILL_PSEUDO_SLOT | typeof GEM_SUPPORT_PSEUDO_SLOT;

// 'Spirit Gem' is NOT "the gems that reserve Spirit" — all 39 of its entries
// carry the `Meta` tag (Cast on Shock, Blasphemy, …) and only 20 of them
// reserve anything, while 59 reserving gems sit under 'Active Skill Gem'.
// It is included here because Meta gems are socketed and supported exactly
// like active skills, not because of reservation. See this plan's "Where the
// spec is wrong" §1 (docs/superpowers/plans/2026-09-22-task3-gems.md).
const GEM_SKILL_CATEGORIES = ['Active Skill Gem', 'Spirit Gem'] as const;
const GEM_SUPPORT_CATEGORIES = ['Support Gem'] as const;

export function isGemPseudoSlot(value: string): value is GemPseudoSlot {
  return value === GEM_SKILL_PSEUDO_SLOT || value === GEM_SUPPORT_PSEUDO_SLOT;
}

export function categoriesForGemSlot(slot: GemPseudoSlot): readonly string[] {
  return slot === GEM_SKILL_PSEUDO_SLOT ? GEM_SKILL_CATEGORIES : GEM_SUPPORT_CATEGORIES;
}

/**
 * Support sockets per skill: starts at 2, maxes at 5 (1 active + 5 supports
 * = the classic six-link, entirely local to the skill).
 *
 * Sourced from docs/research/poe2/gems-and-skills.md §1 and §4, which agree
 * — but that doc's citations are community wikis and
 * docs/research/poe2/verified-corrections.md never re-verified this against
 * extracted game data the way it did the ascendancy cap. Kept as one named
 * constant so a correction is a one-line change.
 */
export const MAX_SUPPORTS_PER_SKILL = 5;
