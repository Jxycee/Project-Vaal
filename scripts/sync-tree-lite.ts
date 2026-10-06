/**
 * Writes public/data/tree/<TREE_VERSION>/lite.json: the small projection of
 * data.json that every build-page tab except the tree canvas reads
 * (src/lib/tree/treeLite.ts). Re-run after re-vendoring the tree.
 *
 * Run: npm run sync:tree-lite
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { GggTreeJson } from '@poe2-toolkit/tree-core/ggg';
import { TREE_VERSION } from '../src/lib/tree/version';
import { projectTreeLite } from '../src/lib/tree/treeLite';

const dir = path.join(process.cwd(), 'public', 'data', 'tree', TREE_VERSION);
const full = JSON.parse(readFileSync(path.join(dir, 'data.json'), 'utf8')) as GggTreeJson;
const out = JSON.stringify(projectTreeLite(full));
writeFileSync(path.join(dir, 'lite.json'), out);
console.log(`lite.json: ${out.length} bytes`);
