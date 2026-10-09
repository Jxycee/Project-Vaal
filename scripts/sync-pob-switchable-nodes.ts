/**
 * Writes src/lib/pob/data/switchable-nodes.json: the passives Path of Building 2 swaps for a class.
 *
 * PoB's tree (TreeData/<v>/tree.json, MIT) marks some nodes `isSwitchable` with `options[<class or ascendancy
 * name>]`. PassiveSpec.lua:1518 replaces the node by `options[class]`, else `options[ascendancy]`, else keeps
 * the base node. Druid, Witch, Huntress and Abyssal Lich have such nodes: a Druid's "Aura Skills have 5% increased
 * Magnitudes" is, for that class, "8% increased Damage". GGG's tree export lists only the base node, so a Druid's
 * aura nodes were counted as aura magnitude the in-game tree does not give her (ordinary-shaman-1: Purity of
 * Lightning 49.53 here, 39 in PoB, Lightning resistance 75 vs 72).
 *
 * Output: { treeVersion, nodes: { "<base node id>": { "<class or ascendancy>": { id, name, lines } | null } } }
 * `lines` is the option's display text as PoB prints it (no markup), read by the engine like any item line
 * (lineMods.readLine). An option PoB gives no id (an Abyssal Lich node that is simply removed) is `null`: the
 * node gives that ascendancy nothing. `ascendancyIds` maps the editor's ascendancy id ("Witch3b") to the name PoB keys
 * its options by ("Abyssal Lich"), for the names that are option keys; a PoB import stores the name itself.
 *
 * Re-run after PoB2 or the tree moves: npm run sync:pob-switchable-nodes
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { TREE_VERSION } from '../src/lib/tree/version';

const POB_TREE_VERSION = '0_5';
const URL = `https://raw.githubusercontent.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/dev/src/TreeData/${POB_TREE_VERSION}/tree.json`;

type PobNode = { skill: number; isSwitchable?: boolean; options?: Record<string, { id?: number; name?: string; stats?: string[] }> };
type Option = { id: number; name: string; lines: string[] } | null;

async function main(): Promise<void> {
  const response = await fetch(URL);
  if (!response.ok) throw new Error(`${URL}: ${response.status}`);
  const pob = (await response.json()) as { nodes: Record<string, PobNode> };

  const nodes: Record<string, Record<string, Option>> = {};
  for (const node of Object.values(pob.nodes)) {
    if (!node.isSwitchable || !node.options) continue;
    const entry: Record<string, Option> = {};
    for (const [who, option] of Object.entries(node.options)) {
      entry[who] = typeof option.id === 'number' ? { id: option.id, name: option.name ?? '', lines: option.stats ?? [] } : null;
    }
    nodes[String(node.skill)] = entry;
  }
  const keys = new Set(Object.values(nodes).flatMap((entry) => Object.keys(entry)));
  const tree = JSON.parse(readFileSync(path.join(process.cwd(), 'public', 'data', 'tree', TREE_VERSION, 'data.json'), 'utf8')) as { classes: { ascendancies?: { id: string; name: string }[] }[] };
  const ascendancyIds = Object.fromEntries(tree.classes.flatMap((c) => c.ascendancies ?? []).filter((a) => keys.has(a.name) && a.id !== a.name).map((a) => [a.id, a.name]));
  writeFileSync(path.join(process.cwd(), 'src', 'lib', 'pob', 'data', 'switchable-nodes.json'), JSON.stringify({ treeVersion: POB_TREE_VERSION, ascendancyIds, nodes }));
  console.log(`switchable-nodes.json: ${Object.keys(nodes).length} nodes`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
