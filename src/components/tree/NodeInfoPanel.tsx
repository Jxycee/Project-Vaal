'use client';

// Persistent bottom info panel for the last-tapped node — the universal
// (desktop + mobile) counterpart to NodeTooltip. Real pointer hover doesn't
// fire on touch (see PassiveTree.tsx's state-model note), so tapping a node
// both allocates it AND pins its description here, rather than relying on a
// hover that mobile users would never see.
import { X } from 'lucide-react';
import { parseStatText } from '@/lib/tree/statText';

export interface SelectedNode {
  name: string;
  stats: string[];
}

export default function NodeInfoPanel({
  node,
  onDismiss,
}: {
  node: SelectedNode | null;
  onDismiss: () => void;
}) {
  if (!node) return null;

  return (
    <div className="absolute inset-x-3 bottom-3 z-10 rounded-lg border border-border bg-card/95 p-3 backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <p className="font-heading text-sm text-foreground">{node.name}</p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 text-muted-foreground"
        >
          <X size={16} />
        </button>
      </div>
      {node.stats.length > 0 ? (
        <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
          {node.stats.map((s, i) => (
            <li key={i}>{parseStatText(s)}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">No effect.</p>
      )}
    </div>
  );
}
