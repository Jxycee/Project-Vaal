// src/lib/build/stats/switchableNodes.ts
// =============================================================================
// Class-switchable passives. Path of Building 2's tree marks 78 nodes `isSwitchable` with `options[<class or
// ascendancy name>]`; PassiveSpec.lua:1518 swaps the node for options[class], else options[ascendancy], else keeps
// the base. A Druid's three "Aura Skills have 5% increased Magnitudes" nodes are "8% increased Damage" for her; a
// Witch's "Energy Shield Delay" nodes are "Minions have 10% increased maximum Life". GGG's export (what the planner's
// tree holds) lists only the base node, so without this a Druid is credited aura magnitude she does not have
// (ordinary-shaman-1: Purity of Lightning 49.53 here, 39 in PoB, Lightning resistance 75 against PoB's 72).
// Data: data/switchable-nodes.json (scripts/sync-pob-switchable-nodes.ts, from PoB's TreeData tree.json).
//
// FAILURE MODES (decided before the code; the multi-build oracle exercises them end to end):
//   1. No class given (an old caller, a test with no character): the base node, today's behaviour. Never a guess.
//   2. The class has no option on this node (every node of a class that is not Druid / Witch / Huntress, and most
//      nodes of those three): undefined, the base node.
//   3. Class and ascendancy both have an option: the class wins, as in PassiveSpec.lua.
//   4. An option PoB gives no stats to (an Abyssal Lich node that is simply removed): `lines` is empty, so the node
//      contributes nothing, not the base node's stats.
//   5. The ascendancy arrives as the editor's id ("Witch3b") rather than the name PoB keys options by ("Abyssal Lich"):
//      the data carries the id -> name table for the names that are option keys; any other value is matched as given.
//   6. An option line the defence reader has no template for (offence: "8% increased Damage") adds nothing, as the
//      same line on an item adds nothing. A line it recognises but cannot model is named by the caller (notCounted).
// The replaced node keeps its place in the tree: small / notable / attribute status and jewel radius are the base
// node's (PoB's ReplaceNode copies only the name, stats and modifiers).
// =============================================================================

import switchable from '@/lib/pob/data/switchable-nodes.json';

interface Option {
  id: number;
  name: string;
  lines: string[];
}

const NODES = switchable.nodes as unknown as Record<string, Record<string, Option | null>>;
const ASCENDANCY_NAMES = switchable.ascendancyIds as Record<string, string>;

/** What a switchable node is for this character: undefined = the base node stands. */
export function switchedNode(id: number, className: string | undefined, ascendancy: string | null | undefined): { name: string; lines: string[] } | undefined {
  const options = NODES[String(id)];
  if (!options || className === undefined) return undefined;
  const ascendancyName = ascendancy ? (ASCENDANCY_NAMES[ascendancy] ?? ascendancy) : undefined;
  const key = Object.hasOwn(options, className) ? className : ascendancyName !== undefined && Object.hasOwn(options, ascendancyName) ? ascendancyName : undefined;
  if (key === undefined) return undefined;
  const option = options[key];
  return option === null ? { name: '', lines: [] } : { name: option.name, lines: option.lines };
}
