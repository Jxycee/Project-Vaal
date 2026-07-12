'use client';

// Desktop-only floating tooltip, anchored to the hovered node's screen
// position. Real hover only exists for a mouse — see the state-model note in
// PassiveTree.tsx for why touch needs NodeInfoPanel instead. Purely
// presentational: PassiveTree owns the hovered-node state via onNodeHover.
import { parseStatText } from '@/lib/tree/statText';

export interface HoveredNode {
  name: string;
  stats: string[];
  x: number;
  y: number;
}

export default function NodeTooltip({ node }: { node: HoveredNode | null }) {
  if (!node) return null;

  return (
    <div
      className="pointer-events-none absolute z-20 max-w-xs -translate-x-1/2 -translate-y-full rounded-md border border-border bg-card px-3 py-2 text-xs shadow-lg"
      style={{ left: node.x, top: node.y - 12 }}
    >
      <p className="font-heading text-sm text-foreground">{node.name}</p>
      {node.stats.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-muted-foreground">
          {node.stats.map((s, i) => (
            <li key={i}>{parseStatText(s)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
