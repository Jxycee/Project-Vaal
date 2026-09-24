// src/lib/pob/mapTree.ts
// =============================================================================
// One PoB tree spec -> our PassiveState, plus what could not come across.
//
// Pure. The rules, each verified before it was written (see the Slice 2 plan):
//
// - Weapon sets. PoB's <Spec nodes> lists every node, and <WeaponSet1/2>
//   list the set-specific ones again (PassiveSpec.lua Save); a node in
//   neither is shared. Our storage spells "shared" as "in both set1 and set2"
//   (passiveState.ts), so shared nodes go in both.
// - Start nodes are omitted, silently. PoB lists the class start and the
//   ascendancy start; our editor stores neither, because tree-core's
//   pathToNode excludes the start it paths from. Keeping them would put state
//   in the build the editor never produces — and on the real build it would
//   push the ascendancy count from 8 to 9, over the cap. Nothing is lost, so
//   nothing is reported.
// - Ascendancy nodes are always shared, never in a weapon set — tree-core
//   forces them basic, matching PoB — and only the build's own ascendancy's
//   nodes are kept.
// - Unknown nodes (the real build loses one, 15671, across a patch boundary)
//   and attribute choices (our model has no field for them) are dropped and
//   REPORTED, never discarded silently.
// =============================================================================

import type { PassiveState } from '@/lib/build/types';
import type { Catalogue } from './catalogue';
import type { PobSpec } from './parse';
import type { ReportEntry } from './report';

export type TreeLookup = Pick<Catalogue['tree'], 'hasNode' | 'ascendancyOf' | 'isStartNode'>;

function listIds(ids: number[]): string {
  return ids.join(', ');
}

/**
 * @param ascendancyId the build's ascendancy in our vocabulary (e.g.
 *   'Mercenary2'), or null when the build has none.
 * @param checkpoint the 1-based PoB spec number, carried onto report entries.
 */
export function mapTree(
  spec: PobSpec,
  ascendancyId: string | null,
  tree: TreeLookup,
  checkpoint: number,
): { value: PassiveState; report: ReportEntry[] } {
  const inSet1 = new Set(spec.weaponSet1);
  const inSet2 = new Set(spec.weaponSet2);

  const set1: number[] = [];
  const set2: number[] = [];
  const ascendancyNodes: number[] = [];
  const unknown: number[] = [];
  const otherAscendancy: number[] = [];

  for (const id of new Set(spec.nodes)) {
    if (!tree.hasNode(id)) {
      unknown.push(id);
      continue;
    }
    if (tree.isStartNode(id)) continue;

    const nodeAscendancy = tree.ascendancyOf(id);
    if (nodeAscendancy !== null) {
      if (nodeAscendancy === ascendancyId) ascendancyNodes.push(id);
      else otherAscendancy.push(id);
      continue;
    }

    // A node can only have one weapon-set mode in PoB; were one ever listed
    // under both, "shared" is the reading that loses nothing.
    const onlySet1 = inSet1.has(id) && !inSet2.has(id);
    const onlySet2 = inSet2.has(id) && !inSet1.has(id);
    if (!onlySet2) set1.push(id);
    if (!onlySet1) set2.push(id);
  }

  const report: ReportEntry[] = [];
  if (unknown.length > 0) {
    report.push({
      kind: 'dropped',
      area: 'tree',
      checkpoint,
      message: `${unknown.length} passive node(s) are not in this patch's tree and were left out: ${listIds(unknown)}.`,
    });
  }
  if (otherAscendancy.length > 0) {
    report.push({
      kind: 'dropped',
      area: 'tree',
      checkpoint,
      message: ascendancyId
        ? `${otherAscendancy.length} ascendancy node(s) belong to a different ascendancy and were left out: ${listIds(otherAscendancy)}.`
        : `${otherAscendancy.length} ascendancy node(s) were left out because the build has no ascendancy: ${listIds(otherAscendancy)}.`,
    });
  }

  const attributeChoices =
    spec.attributeOverrides.str.length + spec.attributeOverrides.dex.length + spec.attributeOverrides.int.length;
  if (attributeChoices > 0) {
    report.push({
      kind: 'dropped',
      area: 'tree',
      checkpoint,
      message: `${attributeChoices} attribute choice(s) (which attribute each "+attribute" passive was set to) were not kept — Project Vaal does not store them yet. The passives themselves are allocated.`,
    });
  }

  return { value: { set1, set2, ascendancyNodes }, report };
}
