// src/lib/tree/treeLite.ts
// =============================================================================
// The slice of the 5.1 MB GGG tree export that everything OUTSIDE the tree
// canvas reads: node names + two flags (stats engine, ascendancy points),
// jewelSlots (jewel sockets) and each class's base attributes (defence sheet).
// Generated into public/data/tree/<v>/lite.json by `npm run sync:tree-lite`;
// tests/treeLite.data.test.ts pins it to data.json. Only the canvas needs the
// full file.
// =============================================================================
import type { GggTreeJson } from '@poe2-toolkit/tree-core/ggg';

export interface TreeLiteNode {
  name?: string;
  isGenericAttribute?: true;
  isMultipleChoiceOption?: true;
}

export interface TreeLiteClass {
  name: string;
  base_str: number;
  base_dex: number;
  base_int: number;
}

export interface TreeLite {
  nodes: Record<string, TreeLiteNode>;
  jewelSlots: (string | number)[];
  classes: TreeLiteClass[];
}

export function projectTreeLite(full: GggTreeJson): TreeLite {
  const nodes: Record<string, TreeLiteNode> = {};
  for (const [id, raw] of Object.entries(full.nodes)) {
    if (id === 'root') continue;
    const n = raw as { name?: string; isGenericAttribute?: boolean; isMultipleChoiceOption?: boolean };
    const out: TreeLiteNode = {};
    if (n.name) out.name = n.name;
    if (n.isGenericAttribute) out.isGenericAttribute = true;
    if (n.isMultipleChoiceOption) out.isMultipleChoiceOption = true;
    nodes[id] = out;
  }
  const classes = (full.classes as unknown as TreeLiteClass[]).map((c) => ({
    name: c.name,
    base_str: c.base_str,
    base_dex: c.base_dex,
    base_int: c.base_int,
  }));
  return { nodes, jewelSlots: full.jewelSlots ?? [], classes };
}
