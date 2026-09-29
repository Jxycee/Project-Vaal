'use client';

// Full-screen gems sheet: one stacked card per skill loadout (active/meta
// gem + up to MAX_SUPPORTS_PER_SKILL supports + weapon-set tags + a Main
// skill toggle). See docs/superpowers/plans/2026-09-22-task3-gems.md.
//
// Mobile interaction, concretely at 375px: one vertical scroll of stacked
// cards, no tabs, no two-pane anything, no horizontal scroll strip — the
// competitor recon's "single most copyable failure mode" for a build
// planner's item picker (2026-09-20-competitor-build-planner-recon.md:85).
// Each card is a GemLoadoutEditor, which owns its own skill/support pickers
// (ItemPickerSheet: a full-width, single-column, search-first list).
//
// Portaled to document.body for the same reason as GearSheet.tsx/
// JewelsSheet.tsx (read GearSheet's header comment): /tree's canvas wrapper
// is `position: fixed`, which always creates its own stacking context, so a
// plain `fixed inset-0 z-*` here would sit under the shell's `sticky z-20`
// mobile header no matter its z-index.
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { WeaponSet } from '@poe2-toolkit/tree-core';
import GemLoadoutEditor from '@/components/build/GemLoadoutEditor';
import { useReservedSpirit } from '@/components/build/useReservedSpirit';
import type { GearItem } from '@/lib/build/gearSlots';
import type { GemState } from '@/lib/build/gemState';

/**
 * TEST-GRADE (Slice 3, plans/2026-09-24-slice3-structural-validation.md):
 * plain text, functional only — the UI pass after Slice 5 replaces it. The
 * raw reserved total per weapon set; the Stats sheet (Slice 5) compares it
 * with the character's Spirit.
 */
function ReservedSpiritLine({ gemState }: { gemState: GemState }) {
  const reserved = useReservedSpirit(gemState);
  if (reserved === null) {
    return <p className="px-3 pt-3 text-xs text-muted-foreground">Spirit reserved: calculating…</p>;
  }
  return (
    <div className="px-3 pt-3 text-xs text-muted-foreground">
      <p data-testid="spirit-reserved" className="text-sm text-foreground">
        Spirit reserved — Set I: {reserved.total.set1} · Set II: {reserved.total.set2}
      </p>
      <p>Before reservation modifiers; compared with your Spirit on the Stats sheet.</p>
      {reserved.missingNames.length > 0 ? <p>Data missing for: {reserved.missingNames.join(', ')}</p> : null}
    </div>
  );
}

export default function GemsSheet({
  open,
  gemState,
  onAddLoadout,
  onRemoveLoadout,
  onSetSkill,
  onAddSupport,
  onRemoveSupport,
  onSetSets,
  onSetPrimary,
  onSetLevel,
  onSetQuality,
  onClose,
}: {
  open: boolean;
  gemState: GemState;
  onAddLoadout: () => void;
  onRemoveLoadout: (id: string) => void;
  onSetSkill: (id: string, item: GearItem | null) => void;
  onAddSupport: (id: string, item: GearItem) => void;
  onRemoveSupport: (id: string, supportIndex: number) => void;
  onSetSets: (id: string, sets: readonly WeaponSet[]) => void;
  onSetPrimary: (id: string) => void;
  onSetLevel: (id: string, level: number) => void;
  onSetQuality: (id: string, quality: number) => void;
  onClose: () => void;
}) {
  // Also gates the SSR pass, same reasoning as GearSheet/JewelsSheet.
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card/95 px-3 py-3 backdrop-blur">
        <span className="flex min-w-0 flex-col">
          <span className="font-heading text-sm text-foreground">Gems</span>
          <span className="text-xs text-muted-foreground">Main skill is what other players filter by.</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close gems sheet"
          className="flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <ReservedSpiritLine gemState={gemState} />
        {gemState.loadouts.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">No skills yet.</p>
        ) : (
          <ul>
            {gemState.loadouts.map((loadout, index) => (
              <GemLoadoutEditor
                key={loadout.id}
                loadout={loadout}
                index={index}
                isPrimary={gemState.primaryId === loadout.id}
                onSetSkill={(item) => onSetSkill(loadout.id, item)}
                onAddSupport={(item) => onAddSupport(loadout.id, item)}
                onRemoveSupport={(supportIndex) => onRemoveSupport(loadout.id, supportIndex)}
                onRemove={() => onRemoveLoadout(loadout.id)}
                onSetSets={(sets) => onSetSets(loadout.id, sets)}
                onSetPrimary={() => onSetPrimary(loadout.id)}
                onSetLevel={(level) => onSetLevel(loadout.id, level)}
                onSetQuality={(quality) => onSetQuality(loadout.id, quality)}
              />
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={onAddLoadout}
          className="mx-3 my-3 flex h-11 w-[calc(100%-1.5rem)] items-center justify-center rounded-lg border border-dashed border-border/70 text-sm font-medium text-muted-foreground"
        >
          + Add skill
        </button>
      </div>
    </div>,
    document.body,
  );
}
