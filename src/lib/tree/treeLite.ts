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

/** One passive near a jewel socket: its id, its distance from the socket, and its kind (0 notable, 1 small). */
export type JewelRadiusNode = [id: number, distance: number, kind: 0 | 1];

export interface TreeLite {
  nodes: Record<string, TreeLiteNode>;
  jewelSlots: (string | number)[];
  classes: TreeLiteClass[];
  /**
   * Per jewel socket id, every notable and small passive within JEWEL_RADIUS_REACH of it (the Time-Lost jewels'
   * "Notable / Small Passive Skills in Radius also grant ..." lines read it; stats/collect.ts). Optional: a lite
   * file written before it existed simply names the radius jewels it cannot count.
   */
  jewelRadius?: Record<string, JewelRadiusNode[]>;
  /**
   * Every notable, keystone, mastery and jewel socket id: the passives that are NOT plain small ones. "N% increased effect
   * of Small Passive Skills" (Hulking Form) scales only the plain small ones, and the lite nodes carry no type flag, so the
   * stats engine needs this list. Optional: a file written before it existed leaves the small-passive effect uncounted (named).
   */
  notSmall?: number[];
}

/**
 * The largest radius a fixed Time-Lost jewel can reach: PoB2 Very Large = 1500 x PassiveTreeJewelDistanceMultiplier 1.2
 * (Data.lua jewelRadii "0_1", misc-constants.json). The smaller rings are read off the stored distances.
 */
export const JEWEL_RADIUS_REACH = 1800;

interface RadiusSourceNode {
  x?: number;
  y?: number;
  isNotable?: boolean;
  isKeystone?: boolean;
  isMastery?: boolean;
  isJewelSocket?: boolean;
  isGenericAttribute?: boolean;
  isBlighted?: boolean;
  isAscendancyStart?: boolean;
  isMultipleChoiceOption?: boolean;
}

/**
 * Notables and smalls near each jewel socket. PoB2's node types: Notable, and Normal-and-not-an-attribute for
 * Small (ModParser.lua "^(%w+) Passive Skills in Radius also grant"); sockets, keystones, masteries, blighted
 * nodes and attribute passives are never in either set (PassiveTree.lua nodesInRadius skips blighted and mastery).
 */
export function projectJewelRadius(nodes: Record<string, unknown>): Record<string, JewelRadiusNode[]> {
  const all = Object.entries(nodes).filter(([id]) => id !== 'root') as [string, RadiusSourceNode][];
  const out: Record<string, JewelRadiusNode[]> = {};
  for (const [socketId, socket] of all) {
    if (!socket.isJewelSocket || socket.x === undefined || socket.y === undefined) continue;
    const near: JewelRadiusNode[] = [];
    for (const [id, n] of all) {
      if (id === socketId || n.x === undefined || n.y === undefined) continue;
      if (n.isKeystone || n.isMastery || n.isJewelSocket || n.isBlighted || n.isGenericAttribute || n.isAscendancyStart || n.isMultipleChoiceOption) continue;
      const distance = Math.hypot(n.x - socket.x, n.y - socket.y);
      if (distance <= JEWEL_RADIUS_REACH) near.push([Number(id), Math.round(distance * 10) / 10, n.isNotable ? 0 : 1]);
    }
    out[socketId] = near.sort((a, b) => a[0] - b[0]);
  }
  return out;
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
  type Kinds = { isNotable?: boolean; isKeystone?: boolean; isMastery?: boolean; isJewelSocket?: boolean };
  const notSmall = Object.entries(full.nodes)
    .filter(([id, raw]) => id !== 'root' && [(raw as Kinds).isNotable, (raw as Kinds).isKeystone, (raw as Kinds).isMastery, (raw as Kinds).isJewelSocket].some((f) => f === true))
    .map(([id]) => Number(id))
    .sort((a, b) => a - b);
  return { nodes, jewelSlots: full.jewelSlots ?? [], classes, jewelRadius: projectJewelRadius(full.nodes as Record<string, unknown>), notSmall };
}
