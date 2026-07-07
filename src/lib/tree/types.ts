// Passive-tree domain types.
// Pinned interfaces (from the Milestone 1 plan) plus the parsed TreeModel.
// Node IDs are the numeric skill ids the export uses as object keys.

export type NodeId = number;
export type ClassId = number; // index into TreeModel.classes

// --- Allocation state (matches plan §6 JSONB shape) ---
export type WeaponSet = 'set1' | 'set2';
export interface PassiveState {
  set1: NodeId[];
  set2: NodeId[];
}
export type AllocMode = 'global' | WeaponSet; // tap default: 'global'
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
  stats: string[]; // display strings with [Token|Text] markup; parsed in Stage 4
  kind: NodeKind;
  isNotable: boolean;
  isKeystone: boolean;
  isMastery: boolean;
  isJewelSocket: boolean;
  isAttribute: boolean;
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

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface TreeModel {
  nodes: Map<NodeId, TreeNode>;
  classes: TreeClass[]; // indexed by ClassId
  bounds: Bounds; // actual node extents
}

// Renderer contract (Stage 1). The renderer consumes the model read-only and
// emits tap intents; the page owns PassiveState.
export interface TreeCanvasProps {
  model: TreeModel;
  state: PassiveState;
  mode: AllocMode;
  focus: FocusMode;
  onNodeTap(nodeId: NodeId): void;
}
