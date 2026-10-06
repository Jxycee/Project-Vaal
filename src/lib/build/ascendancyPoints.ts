// src/lib/build/ascendancyPoints.ts
// =============================================================================
// Ascendancy POINTS spent, as opposed to ascendancy nodes stored. A choice
// notable (Deadeye's Projectile Proximity Specialisation) is saved as the
// parent PLUS the picked option (Point Blank), but costs one point: PoB2's
// PassiveSpec.lua:1067-1074 (CountAllocNodes) skips every `isMultipleChoiceOption`
// node, and Build.lua:1055 warns only when that count passes 8. PoB2 is MIT.
// =============================================================================

/** The slice of the GGG tree export this needs; `GggTreeJson` satisfies it. */
export interface OptionLookup {
  nodes: Record<string, unknown>;
}

/** Points spent for the given ascendancy node ids. Without tree data every node counts. */
export function ascendancyPointCount(nodeIds: readonly number[], tree?: OptionLookup | null): number {
  if (!tree) return nodeIds.length;
  return nodeIds.filter((id) => !(tree.nodes[String(id)] as { isMultipleChoiceOption?: boolean } | undefined)?.isMultipleChoiceOption).length;
}
