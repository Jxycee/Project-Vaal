'use client';

// The passive tree tab. Read-only for a reader or a viewer not in edit mode;
// editable for the owner with `?edit=1` — same PassiveTree component either
// way, driven entirely by the BuildSession (tree export, seeded editor
// state, and the setter it reports allocations back through).
import dynamic from 'next/dynamic';
import { useBuildSession } from '../session/BuildSession';

// Module scope, pixi/WebGL is heavy and browser-only.
const PassiveTree = dynamic(() => import('@/components/tree/PassiveTree'), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading passive tree…</div>,
});

export default function TreeTab({ edit }: { edit: boolean }) {
  const { tree, treeError, treeState, treeSeedKey, meta, setTreeState } = useBuildSession();
  return (
    <div
      id="tree-tab"
      role="tabpanel"
      data-testid="tree-tab"
      className="relative h-[calc(100dvh-17rem)] min-h-[22rem] w-full touch-none select-none overflow-hidden rounded-lg border border-border md:h-[calc(100dvh-13rem)]"
    >
      {treeError ? (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-destructive">Couldn&apos;t load the passive tree ({treeError}).</div>
      ) : !tree ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading passive tree…</div>
      ) : (
        <PassiveTree
          // Bumped by BuildSession's discard()/restoreDraft() to force a
          // fresh seed from `treeState` — see treeSeedKey's doc comment in
          // sessionTypes.ts. Switching away from this tab and back already
          // remounts TreeTab (BuildPage renders it only while active), which
          // re-seeds from the current `treeState` naturally; this key exists
          // for the case where Tree stays mounted underneath a discard.
          key={treeSeedKey}
          raw={tree}
          initialState={treeState}
          readOnly={!edit}
          onStateChange={edit ? setTreeState : undefined}
          level={meta.level}
        />
      )}
    </div>
  );
}
