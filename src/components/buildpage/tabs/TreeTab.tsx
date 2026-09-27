'use client';

// Read-only passive tree, sized to the space under the header and tabs.
import dynamic from 'next/dynamic';
import type { GggTreeJson } from '@poe2-toolkit/tree-core/ggg';
import { fromPassiveState } from '@/lib/build/passiveState';
import type { PassiveState } from '@/lib/build/types';

// Module scope, same reasoning as TreeEditor.tsx: pixi/WebGL is heavy and browser-only.
const PassiveTree = dynamic(() => import('@/components/tree/PassiveTree'), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading passive tree…</div>,
});

export default function TreeTab({
  tree,
  error,
  className,
  ascendancyId,
  passiveState,
  level,
}: {
  tree: GggTreeJson | null;
  error: string | null;
  className: string;
  ascendancyId: string | null;
  passiveState: PassiveState;
  level: number;
}) {
  return (
    <div
      id="tree-tab"
      role="tabpanel"
      data-testid="tree-tab"
      className="relative h-[calc(100dvh-17rem)] min-h-[22rem] w-full touch-none select-none overflow-hidden rounded-lg border border-border md:h-[calc(100dvh-13rem)]"
    >
      {error ? (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-destructive">Couldn&apos;t load the passive tree ({error}).</div>
      ) : !tree ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading passive tree…</div>
      ) : (
        <PassiveTree
          raw={tree}
          initialState={{ className, ascendancyId: ascendancyId ?? undefined, ...fromPassiveState(passiveState) }}
          readOnly
          level={level}
        />
      )}
    </div>
  );
}
