/**
 * Writes src/lib/pob/data/switchable-nodes.json: the passives Path of Building 2 swaps for a class.
 *
 * PoB's tree (TreeData/<v>/tree.json, MIT) marks some nodes `isSwitchable` with `options[<class or ascendancy
 * name>]`. PassiveSpec.lua:1518 replaces the node by `options[class]`, else `options[ascendancy]`, else keeps
 * the base node. Druid, Witch, Huntress and Abyssal Lich have such nodes: e.g. a Druid's "Aura Skills have 5%
 * increased Magnitudes" is, for that class, "8% increased Damage". GGG's tree export lists only the base node,
 * so a Druid's aura nodes were counted as aura magnitude the in-game tree does not give her.
 *
 * Output: { treeVersion, nodes: { "<base node id>": { "<class or ascendancy>": { id, name, stats: [[statId, value], ...] } } } }
 * Stats are typed from the same GGPK PassiveSkills + Stats tables sync-stats.ts reads (keyed by PassiveSkillGraphId =
 * the option's id), so they join the same vocabulary as node-stats.json. An option with no id (Abyssal Lich nodes
 * that are simply removed) is written as `null`: the node gives nothing for that class.
 *
 * Re-run after PoB2 or the tree moves: npm run sync:pob-switchable-nodes
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildNodeStats, type NodeStat } from './typedStats';

const POB_TREE_VERSION = '0_5';
const URL = `https://raw.githubusercontent.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/dev/src/TreeData/${POB_TREE_VERSION}/tree.json`;
const PATCH = '4.5.5.3';
const EXTRACT_DIR = path.join(process.cwd(), 'scripts', 'wiki', '.extract-stats');
const TABLES = [
  { name: 'PassiveSkills', columns: ['Id', 'PassiveSkillGraphId', 'Stats', 'Stat1Value', 'Stat2Value', 'Stat3Value', 'Stat4Value', 'Stat5Value', 'Stat6Value', 'Stat7Value'] },
  { name: 'Stats', columns: ['Id'] },
];

type PobNode = { skill: number; isSwitchable?: boolean; options?: Record<string, { id?: number; name?: string }> };
type Option = { id: number; name: string; stats: NodeStat[] } | null;

function readTable<T>(dir: string, name: string): T[] {
  return JSON.parse(readFileSync(path.join(dir, `${name}.json`), 'utf8')) as T[];
}

async function main(): Promise<void> {
  const response = await fetch(URL);
  if (!response.ok) throw new Error(`${URL}: ${response.status}`);
  const pob = (await response.json()) as { nodes: Record<string, PobNode> };

  const tablesDir = path.join(EXTRACT_DIR, PATCH, 'tables', 'English');
  if (!existsSync(tablesDir)) {
    const runDir = path.join(EXTRACT_DIR, PATCH);
    mkdirSync(runDir, { recursive: true });
    writeFileSync(path.join(runDir, 'config.json'), JSON.stringify({ patch: PATCH, translations: ['English'], files: [], tables: TABLES }, null, 2));
    execFileSync('npx', ['pathofexile-dat'], { cwd: runDir, stdio: 'inherit', shell: true });
  }

  const switchable = Object.values(pob.nodes).filter((n) => n.isSwitchable && n.options);
  const optionIds = switchable.flatMap((n) => Object.values(n.options!).map((o) => o.id)).filter((id): id is number => typeof id === 'number');
  const typed = buildNodeStats(readTable(tablesDir, 'PassiveSkills'), readTable(tablesDir, 'Stats'), optionIds);

  const nodes: Record<string, Record<string, Option>> = {};
  for (const node of switchable) {
    const entry: Record<string, Option> = {};
    for (const [who, option] of Object.entries(node.options!)) {
      if (typeof option.id !== 'number') {
        entry[who] = null;
        continue;
      }
      const stats = typed[String(option.id)];
      if (!stats) throw new Error(`option ${option.id} (${who} on node ${node.skill}) has no PassiveSkills row`);
      entry[who] = { id: option.id, name: option.name ?? '', stats };
    }
    nodes[String(node.skill)] = entry;
  }
  writeFileSync(path.join(process.cwd(), 'src', 'lib', 'pob', 'data', 'switchable-nodes.json'), JSON.stringify({ treeVersion: POB_TREE_VERSION, nodes }));
  console.log(`switchable-nodes.json: ${Object.keys(nodes).length} nodes`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
