// Passive-tree domain types.
// Pinned interfaces (Milestone 1 plan) plus the parsed TreeModel.
// Node IDs are the numeric skill ids the export uses as object keys.

export type NodeId = number;
export type ClassId = number; // index into TreeModel.classes

// --- Allocation state (plan §6 JSONB shape, extended for ascendancies) ---
// Weapon set is per-node tagging (matches GGG .build): a node tagged to set 1
// lives in set1 only, set 2 in set2 only, untagged/both in both arrays.
export type WeaponSet = 'set1' | 'set2';
export interface PassiveState {
  set1: NodeId[];
  set2: NodeId[];
  ascendancyNodes: NodeId[];
}
export type AllocMode = 'both' | WeaponSet; // tap default: 'both' (untagged)
export type FocusMode = 'all' | WeaponSet;

// Most specific classification wins; see kindOf() precedence in parse.ts.
export type NodeKind =
  | 'classStart'
  | 'ascendancyStart'
  | 'keystone'
  | 'mastery'
  | 'jewelSocket'
  | 'notable'
  | 'attribute'
  | 'small';

export interface TreeNode {
  id: NodeId;
  name: string;
  icon: string; // game asset path, e.g. "Art/2DArt/SkillIcons/passives/X.png"
  x: number;
  y: number;
  group: number; // orbit group id — arc geometry keys off this + orbit
  orbit: number; // orbit ring within the group (0 = at the group centre)
  stats: string[]; // display strings with [Token|Text] markup; parsed in Stage 4
  kind: NodeKind;
  isNotable: boolean;
  isKeystone: boolean;
  isMastery: boolean;
  isJewelSocket: boolean;
  isAttribute: boolean;
  // Decoration = rendered (or invisible) but never allocatable / point-costed:
  // masteries (decorative in PoE2 0.5.x — no stats) and empty proxy connectors
  // (no name + no icon). Kept in the graph so pathing routes through proxies.
  isDecoration: boolean;
  isMultipleChoiceOption: boolean; // one option of a pick-one group
  multipleChoiceParent?: NodeId; // the group's parent node, when an option
  ascendancyId?: string; // present on ascendancy-tree nodes
  grantedStrength?: number;
  grantedDexterity?: number;
  grantedIntelligence?: number;
  grantedPassivePoints?: number;
  weaponPassivePointsGranted?: number;
  passivePointsGranted?: number;
  neighbors: NodeId[]; // undirected adjacency (out ∪ in), numeric, "root" excluded
}

export interface TreeClass {
  index: ClassId; // position in classes[]
  name: string;
  baseStr: number;
  baseDex: number;
  baseInt: number;
  ascendancies: string[]; // names; null entries dropped
  startNodeId: NodeId; // resolved via classStartIndex
}

export interface GroupCenter {
  x: number;
  y: number;
}
export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface TreeModel {
  nodes: Map<NodeId, TreeNode>;
  classes: TreeClass[]; // indexed by ClassId
  groups: Map<number, GroupCenter>; // orbit-group centres, for arc geometry
  bounds: Bounds; // actual node extents
}

// Renderer contract (Stage 1). Renderer consumes the model read-only and emits
// tap intents; the page owns PassiveState.
export interface TreeCanvasProps {
  model: TreeModel;
  state: PassiveState;
  mode: AllocMode;
  focus: FocusMode;
  onNodeTap(nodeId: NodeId): void;
}
