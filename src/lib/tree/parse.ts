// The only module that touches the raw GGG export JSON.
// Produces a clean TreeModel; everything downstream depends on this shape,
// never on the raw file. Node-id keys are numeric strings equal to `skill`;
// the special "root" key is the structural graph root and is excluded.

import type {
  Bounds,
  ClassId,
  GroupCenter,
  NodeId,
  NodeKind,
  TreeClass,
  TreeModel,
  TreeNode,
} from './types';

const ROOT_KEY = 'root';

interface RawNode {
  skill?: number;
  name?: string;
  icon?: string;
  x?: number;
  y?: number;
  group?: number;
  orbit?: number;
  stats?: string[];
  isNotable?: boolean;
  isKeystone?: boolean;
  isMastery?: boolean;
  isJewelSocket?: boolean;
  isGenericAttribute?: boolean;
  isAscendancyStart?: boolean;
  isMultipleChoiceOption?: boolean;
  multipleChoiceParent?: number;
  classStartIndex?: number[];
  ascendancyId?: string;
  grantedStrength?: number;
  grantedDexterity?: number;
  grantedIntelligence?: number;
  grantedPassivePoints?: number;
  weaponPassivePointsGranted?: number;
  passivePointsGranted?: number;
  out?: string[];
  in?: string[];
}

interface RawGroup {
  x?: number;
  y?: number;
}

interface RawClass {
  name?: string;
  base_str?: number;
  base_dex?: number;
  base_int?: number;
  ascendancies?: Array<{ name?: string } | string | null>;
}

interface RawTree {
  nodes?: Record<string, RawNode>;
  groups?: Record<string, RawGroup>;
  classes?: RawClass[];
}

/** Numeric skill id from an object key; null for "root" or any non-integer key. */
function toNumericId(key: string): NodeId | null {
  if (key === ROOT_KEY) return null;
  const n = Number(key);
  return Number.isInteger(n) ? n : null;
}

/** Undirected neighbours = unique numeric ids from out ∪ in ("root" dropped). */
function neighborsOf(raw: RawNode): NodeId[] {
  const set = new Set<NodeId>();
  for (const s of [...(raw.out ?? []), ...(raw.in ?? [])]) {
    const n = Number(s);
    if (Number.isInteger(n)) set.add(n);
  }
  return [...set];
}

// Precedence is intentional and tested. A node can carry several flags; it gets
// the most specific kind. classStart / ascendancyStart win (unique frames);
// then keystone > mastery > jewelSocket > notable > attribute > small.
function kindOf(raw: RawNode): NodeKind {
  if (raw.classStartIndex && raw.classStartIndex.length > 0) return 'classStart';
  if (raw.isAscendancyStart) return 'ascendancyStart';
  if (raw.isKeystone) return 'keystone';
  if (raw.isMastery) return 'mastery';
  if (raw.isJewelSocket) return 'jewelSocket';
  if (raw.isNotable) return 'notable';
  if (raw.isGenericAttribute) return 'attribute';
  return 'small';
}

// Decoration = rendered/invisible but never allocatable: masteries (decorative
// in PoE2 0.5.x — no stats) and empty proxy connectors (no name AND no icon).
function isDecorationNode(raw: RawNode): boolean {
  if (raw.isMastery) return true;
  return !raw.name && !raw.icon;
}

function ascendancyNames(raw: RawClass): string[] {
  return (raw.ascendancies ?? [])
    .map((a) => (typeof a === 'string' ? a : a?.name))
    .filter((n): n is string => typeof n === 'string' && n.length > 0);
}

function boundsOf(nodes: Map<NodeId, TreeNode>): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes.values()) {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x > maxX) maxX = n.x;
    if (n.y > maxY) maxY = n.y;
  }
  return { minX, minY, maxX, maxY };
}

function parseGroups(raw: RawTree): Map<number, GroupCenter> {
  const groups = new Map<number, GroupCenter>();
  for (const [gid, g] of Object.entries(raw.groups ?? {})) {
    const id = Number(gid);
    if (!Number.isInteger(id)) continue;
    if (typeof g.x === 'number' && typeof g.y === 'number') {
      groups.set(id, { x: g.x, y: g.y });
    }
  }
  return groups;
}

export function parseTreeExport(raw: unknown): TreeModel {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('parseTreeExport: root is not an object');
  }
  const root = raw as RawTree;
  const rawNodes = root.nodes;
  if (!rawNodes || typeof rawNodes !== 'object') {
    throw new Error('parseTreeExport: missing "nodes"');
  }

  const nodes = new Map<NodeId, TreeNode>();
  const startNodeByClassIndex = new Map<ClassId, NodeId>();

  for (const [key, rn] of Object.entries(rawNodes)) {
    const id = toNumericId(key);
    if (id === null) continue; // skips "root" and any non-numeric key

    if (typeof rn.x !== 'number' || typeof rn.y !== 'number') {
      // Every node (incl. proxy connectors) has a position; if this fires, the schema changed.
      throw new Error(`parseTreeExport: node ${key} has no coordinates`);
    }

    const node: TreeNode = {
      id,
      name: rn.name ?? '',
      icon: rn.icon ?? '',
      x: rn.x,
      y: rn.y,
      group: rn.group ?? -1,
      orbit: rn.orbit ?? 0,
      stats: Array.isArray(rn.stats) ? rn.stats : [],
      kind: kindOf(rn),
      isNotable: !!rn.isNotable,
      isKeystone: !!rn.isKeystone,
      isMastery: !!rn.isMastery,
      isJewelSocket: !!rn.isJewelSocket,
      isAttribute: !!rn.isGenericAttribute,
      isDecoration: isDecorationNode(rn),
      isMultipleChoiceOption: !!rn.isMultipleChoiceOption,
      neighbors: neighborsOf(rn),
    };
    if (rn.multipleChoiceParent !== undefined) node.multipleChoiceParent = rn.multipleChoiceParent;
    if (rn.ascendancyId !== undefined) node.ascendancyId = rn.ascendancyId;
    if (rn.grantedStrength !== undefined) node.grantedStrength = rn.grantedStrength;
    if (rn.grantedDexterity !== undefined) node.grantedDexterity = rn.grantedDexterity;
    if (rn.grantedIntelligence !== undefined) node.grantedIntelligence = rn.grantedIntelligence;
    if (rn.grantedPassivePoints !== undefined) node.grantedPassivePoints = rn.grantedPassivePoints;
    if (rn.weaponPassivePointsGranted !== undefined) {
      node.weaponPassivePointsGranted = rn.weaponPassivePointsGranted;
    }
    if (rn.passivePointsGranted !== undefined) node.passivePointsGranted = rn.passivePointsGranted;

    nodes.set(id, node);

    // One start node can serve several class indices (e.g. Marauder + Warrior).
    if (rn.classStartIndex) {
      for (const ci of rn.classStartIndex) startNodeByClassIndex.set(ci, id);
    }
  }

  if (nodes.size === 0) throw new Error('parseTreeExport: no numeric nodes parsed');

  const rawClasses = root.classes ?? [];
  const classes: TreeClass[] = rawClasses.map((rc, index) => {
    const startNodeId = startNodeByClassIndex.get(index);
    if (startNodeId === undefined) {
      throw new Error(
        `parseTreeExport: class ${index} (${rc.name ?? '?'}) has no start node`,
      );
    }
    return {
      index,
      name: rc.name ?? '',
      baseStr: rc.base_str ?? 0,
      baseDex: rc.base_dex ?? 0,
      baseInt: rc.base_int ?? 0,
      ascendancies: ascendancyNames(rc),
      startNodeId,
    };
  });

  return { nodes, classes, groups: parseGroups(root), bounds: boundsOf(nodes) };
}
