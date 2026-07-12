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

import { useCallback, useMemo, useState } from 'react';
import {
  buildAscendancyGraph,
  buildScene,
  buildTreeGraph,
  toggleAllocationInMode,
  toggleAscendancyAllocation,
} from '@poe2-toolkit/tree-core';
import type { AllocMode, TreeData, WeaponSetAllocation } from '@poe2-toolkit/tree-core';
import { normalizeGggTree, type GggTreeJson } from '@poe2-toolkit/tree-core/ggg';
import { TreeView } from '@poe2-toolkit/tree-react';
import TreeControls, { type PickerClass } from '@/components/tree/TreeControls';
import NodeTooltip, { type HoveredNode } from '@/components/tree/NodeTooltip';
import NodeInfoPanel, { type SelectedNode } from '@/components/tree/NodeInfoPanel';
import { useTreeResources, useClassCentreSprites } from '@/lib/tree/resources';

const TREE_VERSION = '0_5';
const ASSET_VERSION = '0.5.2';

const EMPTY_MAIN: WeaponSetAllocation = { allocated: [], weaponSets: {} };

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
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const startNode = data.classes[classId]?.startNode ?? 0;
  const activeClass = data.classes[classId];

  const ascGraph = useMemo(
    () => (ascendancyId ? buildAscendancyGraph(data, ascendancyId) : null),
    [data, ascendancyId],
  );

  const allocated = useMemo(() => [...main.allocated, ...ascendancyNodes], [main, ascendancyNodes]);

  const scene = useMemo(
    () =>
      buildScene(data, {
        allocation: { classId, ascendId: ascendancyId, allocated, weaponSets: main.weaponSets },
      }),
    [data, classId, ascendancyId, allocated, main.weaponSets],
  );

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
        x: centre.x + ring.frameRadius + 150,
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
    ascendancyId ? data.classes[classId]?.ascendancies.find((a) => a.id === ascendancyId)?.internalId : undefined,
    (activeClass?.ascendancies.length ?? 0) > 0,
  );

  const handleNodeClick = useCallback(
    (skill: number) => {
      const node = data.nodes[skill];
      if (!node) return;

      setSelectedNode({ name: node.name, stats: node.stats });

      if (node.ascendancyName) {
        if (!ascGraph) return; // clicked an ascendancy node with none active — ignore
        const next = toggleAscendancyAllocation(data, node.ascendancyName, new Set(allocated), skill, ascGraph);
        const mainSet = new Set(main.allocated);
        setAscendancyNodes(next.filter((id) => !mainSet.has(id)));
      } else {
        setMain((cur) => toggleAllocationInMode(data, startNode, cur, skill, mode, mainGraph));
      }
    },
    [data, allocated, main.allocated, ascGraph, startNode, mode, mainGraph],
  );

  const handleNodeHover = useCallback(
    (skill: number | null, screen?: { x: number; y: number }) => {
      if (skill === null || !screen) {
        setHoveredNode(null);
        return;
      }
      const node = data.nodes[skill];
      if (!node) {
        setHoveredNode(null);
        return;
      }
      setHoveredNode({ name: node.name, stats: node.stats, x: screen.x, y: screen.y });
    },
    [data],
  );

  const handleClass = useCallback((id: number) => {
    setClassId(id);
    setAscendancyId(undefined);
    setMode(0);
    setMain(EMPTY_MAIN);
    setAscendancyNodes([]);
    setSelectedNode(null);
    setHoveredNode(null);
  }, []);

  const handleAscendancy = useCallback((id: string | undefined) => {
    setAscendancyId(id);
    setAscendancyNodes([]); // a build paths one ascendancy at a time
  }, []);

  const handleReset = useCallback(() => {
    setMain(EMPTY_MAIN);
    setAscendancyNodes([]);
    setSelectedNode(null);
    setHoveredNode(null);
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
        activeAscendancy={ascendancyId}
        wheelZoom
        focus={frame}
        worldLabels={creditLabels}
        highlight={highlightSet}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        style={{ width: '100%', height: '100%' }}
      />
      <NodeTooltip node={hoveredNode} />
      <NodeInfoPanel node={selectedNode} onDismiss={() => setSelectedNode(null)} />
    </div>
  );
}
