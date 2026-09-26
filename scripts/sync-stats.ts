/**
 * Typed-stats sync (Slice 5, docs/superpowers/plans/2026-09-25-slice5-defence-engine.md).
 *
 * Decodes four GGPK tables with `pathofexile-dat` — PassiveSkills, Stats,
 * BaseItemTypes, Mods — from GGG's patch CDN (read-only) and writes:
 *
 *   public/data/tree/<TREE_VERSION>/node-stats.json
 *       { patch, extracted, nodes: { "<nodeId>": [[statId, value], …] } }
 *   public/data/wiki/<WIKI_DATA_VERSION>/implicit-stats.json
 *       { patch, extracted, bases: { "<base name>": [[[statId, min, max], …], …] } }
 *   public/data/wiki/<WIKI_DATA_VERSION>/unique-stats.json
 *       { extracted, uniques: { "<unique name>": { baseType, lines: [[statId, …] | null, …] } } }
 *       — derived from our own wiki item and mod files, no GGPK read (see
 *       typedStats.ts buildUniqueStats).
 *
 * Kept apart from `sync:wiki`, which rewrites a whole dataset version. The
 * patch is PINNED to the one behind the current wiki data (the last
 * `sync:wiki` extracted 4.5.5.3), so the tree, implicit and affix stats all
 * come from one patch. Pass `--patch <version>` to override.
 *
 * Run: npm run sync:stats
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { TREE_VERSION } from '../src/lib/tree/version';
import { WIKI_DATA_VERSION } from '../src/lib/wiki/types';
import { buildImplicitStats, buildNodeStats, buildUniqueStats } from './typedStats';

const PINNED_PATCH = '4.5.5.3';
const EXTRACT_DIR = path.join(process.cwd(), 'scripts', 'wiki', '.extract-stats');

const TABLES = [
  { name: 'PassiveSkills', columns: ['Id', 'PassiveSkillGraphId', 'Stats', 'Stat1Value', 'Stat2Value', 'Stat3Value', 'Stat4Value', 'Stat5Value', 'Stat6Value', 'Stat7Value'] },
  { name: 'Stats', columns: ['Id'] },
  { name: 'BaseItemTypes', columns: ['Name', 'Implicit_Mods'] },
  {
    name: 'Mods',
    columns: ['Id', 'Stat1', 'Stat2', 'Stat3', 'Stat4', 'Stat5', 'Stat6', 'Stat1Value', 'Stat2Value', 'Stat3Value', 'Stat4Value', 'Stat5Value', 'Stat6Value'],
  },
];

function patchArg(): string {
  const at = process.argv.indexOf('--patch');
  return at !== -1 && process.argv[at + 1] ? process.argv[at + 1] : PINNED_PATCH;
}

function readTable<T>(tablesDir: string, name: string): T[] {
  return JSON.parse(readFileSync(path.join(tablesDir, `${name}.json`), 'utf8')) as T[];
}

function main(): void {
  const patch = patchArg();
  const tablesDir = path.join(EXTRACT_DIR, patch, 'tables', 'English');
  if (!existsSync(tablesDir)) {
    const runDir = path.join(EXTRACT_DIR, patch);
    mkdirSync(runDir, { recursive: true });
    writeFileSync(path.join(runDir, 'config.json'), JSON.stringify({ patch, translations: ['English'], files: [], tables: TABLES }, null, 2));
    // Windows: npx resolves to npx.cmd, which execFileSync cannot spawn
    // without shell: true — the same call sync-wiki.ts makes.
    execFileSync('npx', ['pathofexile-dat'], { cwd: runDir, stdio: 'inherit', shell: true });
  }

  const stats = readTable<{ _index: number; Id: string }>(tablesDir, 'Stats');
  const extracted = new Date().toISOString();

  const tree = JSON.parse(readFileSync(path.join(process.cwd(), 'public', 'data', 'tree', TREE_VERSION, 'data.json'), 'utf8')) as {
    nodes: Record<string, unknown>;
  };
  const treeNodeIds = Object.keys(tree.nodes).filter((k) => /^\d+$/.test(k)).map(Number);
  const nodes = buildNodeStats(readTable(tablesDir, 'PassiveSkills'), stats, treeNodeIds);
  const missing = treeNodeIds.filter((id) => !Object.hasOwn(nodes, String(id)));
  if (missing.length > 0) throw new Error(`${missing.length} tree nodes have no PassiveSkills row (first: ${missing.slice(0, 5).join(', ')})`);
  writeFileSync(
    path.join(process.cwd(), 'public', 'data', 'tree', TREE_VERSION, 'node-stats.json'),
    JSON.stringify({ patch, extracted, nodes }),
  );
  console.log(`node-stats.json: ${Object.keys(nodes).length} nodes from patch ${patch}`);

  const bases = buildImplicitStats(readTable(tablesDir, 'BaseItemTypes'), readTable(tablesDir, 'Mods'), stats);
  writeFileSync(
    path.join(process.cwd(), 'public', 'data', 'wiki', WIKI_DATA_VERSION, 'implicit-stats.json'),
    JSON.stringify({ patch, extracted, bases }),
  );
  console.log(`implicit-stats.json: ${Object.keys(bases).length} bases from patch ${patch}`);

  const wikiDir = path.join(process.cwd(), 'public', 'data', 'wiki', WIKI_DATA_VERSION);
  const readDir = (kind: string) =>
    readdirSync(path.join(wikiDir, kind)).map((f) => JSON.parse(readFileSync(path.join(wikiDir, kind, f), 'utf8')));
  const uniques = buildUniqueStats(readDir('items'), readDir('mods'));
  writeFileSync(path.join(wikiDir, 'unique-stats.json'), JSON.stringify({ extracted, uniques }));
  const lines = Object.values(uniques).flatMap((u) => u.lines);
  console.log(`unique-stats.json: ${Object.keys(uniques).length} uniques, ${lines.filter(Boolean).length} of ${lines.length} lines typed`);
}

main();
