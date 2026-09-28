'use client';

// The editor's defence sheet: a full-screen portal around StatsPanel.
// Portaled to document.body at z-40 for the stacking-context reason
// GearSheet.tsx's header gives.
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import StatsPanel from '@/components/build/StatsPanel';
import type { ReservedSpiritResult } from '@/components/build/useReservedSpirit';
import type { SetResult } from '@/components/build/useDefenceSheets';

export default function StatsSheet({
  open,
  sheets,
  reserved,
  onClose,
}: {
  open: boolean;
  sheets: { 1: SetResult; 2: SetResult } | { error: string } | null;
  reserved: ReservedSpiritResult | null;
  onClose: () => void;
}) {
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-40 flex flex-col bg-background" data-testid="stats-sheet">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card/95 px-3 py-3 backdrop-blur">
        <span className="font-heading text-sm text-foreground">Stats</span>
        <button type="button" onClick={onClose} aria-label="Close stats sheet" className="flex h-11 w-11 items-center justify-center text-muted-foreground">
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <StatsPanel sheets={sheets} reserved={reserved} />
      </div>
    </div>,
    document.body,
  );
}
