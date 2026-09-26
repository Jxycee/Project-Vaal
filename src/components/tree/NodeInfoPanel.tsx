'use client';

// Persistent bottom info panel for the last-tapped node — the universal
// (desktop + mobile) counterpart to NodeTooltip. Real pointer hover doesn't
// fire on touch (see PassiveTree.tsx's state-model note), so tapping a node
// both allocates it AND pins its description here, rather than relying on a
// hover that mobile users would never see.
import { X } from 'lucide-react';
import type { AttributeChoice } from '@poe2-toolkit/tree-core';
import { parseStatText } from '@/lib/tree/statText';

export interface SelectedNode {
  skill: number;
  name: string;
  stats: string[];
}

const ATTRIBUTE_LABELS: Record<AttributeChoice, string> = { str: 'Strength', dex: 'Dexterity', int: 'Intelligence' };

export default function NodeInfoPanel({
  node,
  pendingKind,
  onConfirm,
  attribute,
  onDismiss,
}: {
  node: SelectedNode | null;
  /** Set (touch-only) when this node has an unconfirmed preview pending. */
  pendingKind?: 'add' | 'remove';
  /** Commits the pending preview. Only passed alongside `pendingKind`. */
  onConfirm?: () => void;
  /**
   * Slice 5: set when the node is an ALLOCATED generic "+5 to any Attribute"
   * node. `onChoose` is absent in read-only mode, where the choice is shown
   * but cannot change. TEST-GRADE buttons until the UI pass.
   */
  attribute?: { current: AttributeChoice | undefined; onChoose?: (choice: AttributeChoice) => void };
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
      {attribute ? (
        attribute.onChoose ? (
          <div className="mt-2 flex gap-1.5" data-testid="attribute-choice">
            {(['str', 'dex', 'int'] as const).map((choice) => (
              <button
                key={choice}
                type="button"
                aria-pressed={attribute.current === choice}
                onClick={() => attribute.onChoose!(choice)}
                className={`flex h-11 flex-1 items-center justify-center rounded-md border border-border text-xs ${
                  attribute.current === choice ? 'bg-primary text-primary-foreground' : ''
                }`}
              >
                {ATTRIBUTE_LABELS[choice]}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">
            {attribute.current ? `Set to ${ATTRIBUTE_LABELS[attribute.current]}` : 'No attribute chosen'}
          </p>
        )
      ) : null}
      {pendingKind && onConfirm ? (
        <button
          type="button"
          onClick={onConfirm}
          className={`mt-2 w-full rounded-md px-3 py-1.5 text-xs font-heading ${
            pendingKind === 'add'
              ? 'bg-primary text-primary-foreground'
              : 'bg-destructive text-destructive-foreground'
          }`}
        >
          {pendingKind === 'add' ? 'Allocate' : 'Remove'}
        </button>
      ) : null}
    </div>
  );
}
