'use client';

// Passive tree viewer — thin wrapper over @poe2-toolkit.
// tree-core computes the geometry (faithful arcs/orbits, ascendancy hub) and
// owns allocation (BFS pathing, weapon-set + ascendancy rules); tree-react
// draws it and owns pan/pinch/wheel-zoom. We own UI state + the art/asset
// wiring + the mobile control panel.
//
// State model: main-tree allocation (with weapon-set tags) and the active
// ascendancy's allocation are kept as SEPARATE slices and only merged for
// `buildScene`. toggleAllocationInMode's own graph is main-tree-only, so
// mixing ascendancy ids into its input isn't a documented-safe operation;
// keeping them apart avoids relying on unspecified pruning behaviour.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildAscendancyGraph,
  buildScene,
  buildTreeGraph,
  toggleAllocationInMode,
  toggleAscendancyAllocation,
} from '@poe2-toolkit/tree-core';
import type { AllocMode, TreeData, WeaponSetAllocation } from '@poe2-toolkit/tree-core';
import { normalizeGggTree, type GggTreeJson } from '@poe2-toolkit/tree-core/ggg';
import { TreeView, type AllocationPreview } from '@poe2-toolkit/tree-react';
import TreeControls, { type PickerClass } from '@/components/tree/TreeControls';
import NodeTooltip, { type HoveredNode } from '@/components/tree/NodeTooltip';
import NodeInfoPanel, { type SelectedNode } from '@/components/tree/NodeInfoPanel';
import { useTreeResources, useClassCentreSprites } from '@/lib/tree/resources';

const TREE_VERSION = '0_5';
const ASSET_VERSION = '0.5.2';

const EMPTY_MAIN: WeaponSetAllocation = { allocated: [], weaponSets: {} };

// Edge key format (`min-max` of the two node ids) — matches
// tree-react's internal viewport.ts, but that helper isn't part of the
// package's public export surface, so it's reimplemented here rather than
// deep-importing an internal path.
function edgeKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

// Touch has no hover, so it needs an explicit preview-then-confirm step that
// desktop (which already gets NodeTooltip for free on hover) doesn't. Checked
// once via a standard matchMedia query, not per-render.
function useIsTouch(): boolean {
  const [isTouch, setIsTouch] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
  );

  useEffect(() => {
    const mql = window.matchMedia('(pointer: coarse)');
    const handler = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isTouch;
}

export default function PassiveTree({ raw }: { raw: GggTreeJson }) {
  const data: TreeData = useMemo(() => normalizeGggTree(raw, TREE_VERSION), [raw]);
  const mainGraph = useMemo(() => buildTreeGraph(data), [data]);

  // Default to the first real class (one with released ascendancies) —
  // index 0 in the raw export is "Marauder", a legacy attribute-origin slot
  // with none, and we never vendored centre art for it.
  const [classId, setClassId] = useState(
    () => data.classes.find((c) => c.ascendancies.length > 0)?.id ?? 0,
  );
  const [ascendancyId, setAscendancyId] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<AllocMode>(0);
  const [main, setMain] = useState<WeaponSetAllocation>(EMPTY_MAIN);
  const [ascendancyNodes, setAscendancyNodes] = useState<number[]>([]);

  // Tooltips: real pointer hover only fires for a mouse (touch always starts
  // a drag ref on pointerdown, so onNodeHover never fires on tap — traced in
  // tree-react's own pointer handling, not an assumption). So hover drives a
  // floating desktop tooltip, while every tap ALSO pins the tapped node's
  // info into a persistent panel that works on both input types.
  const [hoveredNode, setHoveredNode] = useState<HoveredNode | null>(null);
  // The skill id backing `hoveredNode` — kept separate since NodeTooltip only
  // needs name/stats/screen position, but the preview computation below needs
  // the raw id to dry-run the toggle. Desktop-only in practice (see
  // `previewTarget`): touch never fires onNodeHover (traced in tree-react's
  // pointer handling — a tap starts a drag ref on pointerdown), so this stays
  // null on touch and previewTarget falls through to pendingSkill instead.
  const [hoveredSkill, setHoveredSkill] = useState<number | null>(null);
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Touch-only: the tapped-but-not-yet-committed node. null on desktop always
  // (mouse commits immediately, see handleNodeClick). Tapping a different
  // node just overwrites this — no forced confirm/cancel.
  const [pendingSkill, setPendingSkill] = useState<number | null>(null);
  const isTouch = useIsTouch();

  // What the preview below should dry-run: touch previews the pending tap
  // (see handleNodeClick), desktop previews whatever's currently hovered —
  // this is what puts a predictive path on the tree as you hover an
  // unallocated node, mirroring the reference tree's hover behaviour.
  const previewTarget = isTouch ? pendingSkill : hoveredSkill;

  const startNode = data.classes[classId]?.startNode ?? 0;
  const activeClass = data.classes[classId];
  // The selected ascendancy's own def, and the ascendancy id whose actual node
  // graph it uses for pathing/rendering. Usually the same as its own id, but
  // an ascendancy that reuses another's exact graph (e.g. "Abyssal Lich" over
  // "Lich" — same nodes, 13 swapped display overrides) exposes `graphId`:
  // its real nodes are tagged with the BASE ascendancy's display name, not its
  // own, so buildAscendancyGraph/TreeView's `activeAscendancy` must resolve
  // through this or they'd search for a name that matches nothing.
  const activeAscendancyDef = activeClass?.ascendancies.find((a) => a.id === ascendancyId);
  const graphAscendancyId = activeAscendancyDef?.graphId ?? ascendancyId;

  // mainGraph keeps every class's start node walkable (buildTreeGraph is built
  // once from `data` alone, shared across whichever class ends up active — see
  // its own dependency array), so pathToNode's BFS is free to shortcut through
  // an INACTIVE class's start node as a bridge to wherever's fewest hops away.
  // tree-core's own isWalkable comment calls this out as exactly the failure
  // mode it means to prevent ("a path could shortcut across the centre...
  // even another class's, so it looks like it starts at 'the nearest point of
  // the circle'") — its fix only excludes the synthetic hub-root node, not the
  // other real class-start nodes, which stay fully connected to the shared
  // tree and reachable in one hop from ordinary passives on both sides. Confirmed
  // live: allocating on Witch produced a path that ran straight through node
  // 50459 ("RANGER", Ranger/Huntress's own start) to shave a couple of hops off
  // a legitimate 25-hop route — this is that "wrong starting location" bug.
  // Prune every OTHER class's start node out of the graph before it reaches
  // pathToNode; classes that share a start with the active one (e.g. Witch and
  // Sorceress both root at the same node) are matched by node id, not class id,
  // so a shared gateway stays walkable for either.
  const pathingGraph = useMemo(() => {
    const otherStarts = new Set(
      data.classes.map((c) => c.startNode).filter((id): id is number => id !== undefined && id !== startNode),
    );
    if (otherStarts.size === 0) return mainGraph;
    const filtered: typeof mainGraph = new Map();
    for (const [id, neighbours] of mainGraph) {
      if (otherStarts.has(id)) continue;
      filtered.set(id, new Set([...neighbours].filter((n) => !otherStarts.has(n))));
    }
    return filtered;
  }, [mainGraph, data.classes, startNode]);

  const ascGraph = useMemo(
    () => (graphAscendancyId ? buildAscendancyGraph(data, graphAscendancyId) : null),
    [data, graphAscendancyId],
  );

  const allocated = useMemo(() => [...main.allocated, ...ascendancyNodes], [main, ascendancyNodes]);

  // Points spent per paint mode, for the budget readout in TreeControls.
  // weaponSets only tags nodes actually painted into a set (mode 0/basic
  // nodes, including ones a set's path had to cross, are never keyed in it —
  // see toggleAllocationInMode), so basic count is just "everything else".
  const pointCounts = useMemo(() => {
    let setI = 0;
    let setII = 0;
    for (const set of Object.values(main.weaponSets)) {
      if (set === 1) setI++;
      else if (set === 2) setII++;
    }
    return { basic: main.allocated.length - setI - setII, setI, setII };
  }, [main]);

  const scene = useMemo(
    () =>
      buildScene(data, {
        allocation: { classId, ascendId: ascendancyId, allocated, weaponSets: main.weaponSets },
      }),
    [data, classId, ascendancyId, allocated, main.weaponSets],
  );

  // Dry-run of what toggling `previewTarget` would do — the pending tap on
  // touch, or whatever's hovered on desktop — computed via the same toggle
  // functions handleNodeClick already commits with, but never fed into
  // setMain/setAscendancyNodes here — that's exactly what makes it safe to
  // preview without side effects (both toggles return a NEW allocation rather
  // than mutating their input). Recomputes whenever any of its inputs change,
  // so `commit` below is always in sync with latest state — no stale-closure
  // risk from capturing `main`/`ascendancyNodes` at hover/tap time.
  const preview = useMemo(() => {
    if (previewTarget === null) return null;
    const node = data.nodes[previewTarget];
    if (!node) return null;

    const oldSet = new Set(allocated);
    let newSet: Set<number>;
    let commit: () => void;

    if (node.ascendancyName) {
      if (!ascGraph) return null; // ascendancy node targeted with none active — nothing to preview
      const next = toggleAscendancyAllocation(data, node.ascendancyName, oldSet, previewTarget, ascGraph);
      newSet = new Set(next);
      commit = () => {
        const mainSet = new Set(main.allocated);
        setAscendancyNodes(next.filter((id) => !mainSet.has(id)));
      };
    } else {
      const prospective = toggleAllocationInMode(data, startNode, main, previewTarget, mode, pathingGraph);
      newSet = new Set([...prospective.allocated, ...ascendancyNodes]);
      commit = () => setMain(prospective);
    }

    const kind: 'add' | 'remove' = newSet.size > oldSet.size ? 'add' : 'remove';
    const changedNodes =
      kind === 'add'
        ? [...newSet].filter((id) => !oldSet.has(id))
        : [...oldSet].filter((id) => !newSet.has(id));

    const edges = new Set<string>();
    for (const conn of scene.connections) {
      const wasActive = oldSet.has(conn.from) && oldSet.has(conn.to);
      const willBeActive = newSet.has(conn.from) && newSet.has(conn.to);
      const flips = kind === 'add' ? willBeActive && !wasActive : wasActive && !willBeActive;
      if (flips) edges.add(edgeKey(conn.from, conn.to));
    }

    const allocationPreview: AllocationPreview = { kind, nodes: new Set(changedNodes), edges };
    return { kind, preview: allocationPreview, commit };
  }, [previewTarget, data, allocated, ascGraph, main, ascendancyNodes, startNode, mode, pathingGraph, scene.connections]);

  // Commits the pending touch tap. Desktop never calls this — its preview
  // (hover-driven) has no confirm step; a mouse click commits immediately via
  // handleNodeClick, same as it always has.
  const handleConfirmPending = useCallback(() => {
    if (!preview) return;
    preview.commit();
    setPendingSkill(null);
  }, [preview]);

  // Main-tree extent for the initial fit. mainBounds is the extent of the
  // WHOLE main tree (ascendancy discs excluded, per tree-core's own docs) —
  // it does NOT vary by class or allocation, only by the underlying tree data
  // itself. So this is just scene.mainBounds off the scene we've already
  // built — no second buildScene() call needed.
  //
  // (Previously called buildScene() a second time with allocated: [] just to
  // read this off a throwaway scene — needless full geometry pass. Then
  // briefly tried classBounds(scene, classId) to scope this per-class, which
  // was the wrong fix: mainBounds was never class-scoped to begin with, and
  // classBounds's "closest bearing" sector assignment can't disambiguate two
  // classes that share the exact same start node — which happens for every
  // class pair in this tree, and breaks in practice for Witch/Sorceress and
  // Ranger/Huntress specifically, since they're the only two pairs where both
  // classes are real/selectable rather than one being an unreleased legacy
  // slot filtered out of the picker.)
  //
  // Dependency is [data, classId] to match the original recompute cadence
  // exactly, even though mainBounds doesn't actually need classId — `scene`
  // isn't listed on purpose, so `frame` keeps a stable reference across
  // allocation changes, matching TreeView's mount-once framing assumption.
  const frame = useMemo(
    () => scene.mainBounds,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, classId],
  );

  const highlightSet = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    const hits = new Set<number>();
    for (const placed of scene.nodes) {
      const node = data.nodes[placed.skill];
      if (node && node.name.toLowerCase().includes(q)) hits.add(placed.skill);
    }
    return hits.size > 0 ? hits : null;
  }, [searchQuery, scene, data]);

  const creditLabels = useMemo(() => {
    const { centre, ring } = scene.centre;
    return [
      {
        x: centre.x + ring.frameRadius + 80,
        y: centre.y,
        text: 'Tree rendering via @poe2-toolkit — thanks, rajtik76',
      },
    ];
    // Computed once; the patched TreeView only places worldLabels at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resources = useTreeResources(ASSET_VERSION);
  const centreSprites = useClassCentreSprites(
    ASSET_VERSION,
    activeClass?.name ?? '',
    activeAscendancyDef?.internalId,
    (activeClass?.ascendancies.length ?? 0) > 0,
  );

  const handleNodeClick = useCallback(
    (skill: number) => {
      const node = data.nodes[skill];
      if (!node) return;

      // An ascendancy that borrows another's graph (e.g. Abyssal Lich over
      // Lich) shows its own name/stats over the shared nodes it swaps —
      // everything else about the node (geometry, pathing) stays the base's.
      const override = activeAscendancyDef?.nodeOverrides?.[skill];
      setSelectedNode({ name: override?.name ?? node.name, stats: override?.stats ?? node.stats });

      // Touch has no hover, so it previews via `preview` above (driven by
      // pendingSkill) and commits only on the panel's explicit Allocate/Remove
      // button. Desktop keeps committing immediately — it already gets a free
      // preview from hover, so an extra confirm step would be a regression.
      if (isTouch) {
        setPendingSkill(skill);
        return;
      }

      if (node.ascendancyName) {
        if (!ascGraph) return; // clicked an ascendancy node with none active — ignore
        const next = toggleAscendancyAllocation(data, node.ascendancyName, new Set(allocated), skill, ascGraph);
        const mainSet = new Set(main.allocated);
        setAscendancyNodes(next.filter((id) => !mainSet.has(id)));
      } else {
        setMain((cur) => toggleAllocationInMode(data, startNode, cur, skill, mode, pathingGraph));
      }
    },
    [data, allocated, main.allocated, ascGraph, startNode, mode, pathingGraph, isTouch, activeAscendancyDef],
  );

  const handleNodeHover = useCallback(
    (skill: number | null, screen?: { x: number; y: number }) => {
      setHoveredSkill(skill);
      if (skill === null || !screen) {
        setHoveredNode(null);
        return;
      }
      const node = data.nodes[skill];
      if (!node) {
        setHoveredNode(null);
        return;
      }
      // See handleNodeClick — same ascendancy-borrowed-graph display override.
      const override = activeAscendancyDef?.nodeOverrides?.[skill];
      setHoveredNode({ name: override?.name ?? node.name, stats: override?.stats ?? node.stats, x: screen.x, y: screen.y });
    },
    [data, activeAscendancyDef],
  );

  const handleClass = useCallback((id: number) => {
    setClassId(id);
    setAscendancyId(undefined);
    setMode(0);
    setMain(EMPTY_MAIN);
    setAscendancyNodes([]);
    setSelectedNode(null);
    setHoveredNode(null);
    setHoveredSkill(null);
    setPendingSkill(null);
  }, []);

  const handleAscendancy = useCallback((id: string | undefined) => {
    setAscendancyId(id);
    setAscendancyNodes([]); // a build paths one ascendancy at a time
    setPendingSkill(null);
  }, []);

  const handleReset = useCallback(() => {
    setMain(EMPTY_MAIN);
    setAscendancyNodes([]);
    setSelectedNode(null);
    setHoveredNode(null);
    setHoveredSkill(null);
    setPendingSkill(null);
  }, []);

  const pickerClasses: PickerClass[] = useMemo(
    () =>
      data.classes
        .filter((c) => c.ascendancies.length > 0) // the 8 real PoE2 classes
        .map((c) => ({ id: c.id, name: c.name, ascendancies: c.ascendancies.map((a) => ({ id: a.id, name: a.name })) })),
    [data.classes],
  );

  return (
    <div className="relative h-full w-full">
      <TreeControls
        classes={pickerClasses}
        classId={classId}
        ascendancyId={ascendancyId}
        mode={mode}
        pointCounts={pointCounts}
        searchQuery={searchQuery}
        hasAllocations={allocated.length > 0}
        onClass={handleClass}
        onAscendancy={handleAscendancy}
        onMode={setMode}
        onSearchChange={setSearchQuery}
        onReset={handleReset}
      />
      <TreeView
        scene={scene}
        resources={resources ?? undefined}
        centreSprites={centreSprites ?? undefined}
        activeClassId={classId}
        activeAscendancy={graphAscendancyId}
        wheelZoom
        focus={frame}
        worldLabels={creditLabels}
        highlight={highlightSet}
        preview={preview?.preview}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        style={{ width: '100%', height: '100%' }}
      />
      <NodeTooltip node={hoveredNode} />
      <NodeInfoPanel
        node={selectedNode}
        pendingKind={isTouch ? preview?.kind : undefined}
        onConfirm={isTouch && preview ? handleConfirmPending : undefined}
        onDismiss={() => setSelectedNode(null)}
      />
    </div>
  );
}
