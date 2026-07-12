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

  // Main-tree extent for the initial fit. Ring geometry is shared across every
  // class (only the portrait differs), so this — and the credit position
  // derived from it below — stays correct across class switches even though
  // our TreeView patch only places world labels once, at mount.
  const frame = useMemo(
    () => buildScene(data, { allocation: { classId, allocated: [] } }).mainBounds,
    [data, classId],
  );

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
        onClass={handleClass}
        onAscendancy={handleAscendancy}
        onMode={setMode}
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
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        style={{ width: '100%', height: '100%' }}
      />
      <NodeTooltip node={hoveredNode} />
      <NodeInfoPanel node={selectedNode} onDismiss={() => setSelectedNode(null)} />
    </div>
  );
}
