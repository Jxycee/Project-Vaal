// src/lib/tree/testApi.ts
// Shape of the dev-only automation hook PassiveTree installs on `window`.
//
// Why it exists: TreeView is a pixi.js/WebGL canvas rendering 5,151 nodes with
// no DOM structure per node. An end-to-end test therefore has nothing to click
// and can only guess pixel coordinates — which is slow, flaky, and (worst of
// all) silently "passes" when a tap lands on empty space. Driving the editor by
// node id removes the guessing entirely.
//
// This type is shared by the component that installs the hook and the e2e specs
// that consume it, so the two cannot drift apart silently.
//
// The hook is installed only when `process.env.NODE_ENV === 'development'`.
// That comparison is inlined by the bundler, so the installing code is
// statically unreachable in a production build and is eliminated from the
// output. To re-check that after a bundler or config change:
//
//   npm run build && grep -r "__vaalTree" .next/static/ ; echo "exit $?"
//
// A match means the hook is shipping to users and the guard has stopped
// working. Verified absent on 2026-09-20.

export interface TreeTestState {
  classId: number;
  className: string;
  ascendancyId: string | undefined;
  /** Main-tree allocation, including nodes auto-pathed to reach a requested one. */
  allocated: number[];
  ascendancyNodes: number[];
}

export interface TreeTestApi {
  getState: () => TreeTestState;
  /**
   * The active class's start node, and the main-tree neighbours of any node.
   *
   * Deliberately thin reads of the normalized tree rather than something like
   * "give me N allocatable nodes": a test that needs a walk can do its own BFS
   * from these two, which keeps test-shaped logic out of the app. Ascendancy
   * and jewel-socket nodes are excluded, since those allocate under different
   * rules and are not what a "pick some passives" test wants.
   */
  startNode: () => number;
  neighbours: (skill: number) => number[];
  /**
   * Toggles one node through the same commit path a real click uses, including
   * BFS pathing to it. Returns false when the id is unknown, or is an
   * ascendancy node while no ascendancy is selected.
   */
  allocate: (skill: number) => boolean;
  setClass: (id: number) => void;
  setAscendancy: (id: string | undefined) => void;
  reset: () => void;
}
