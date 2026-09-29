'use client';

// Edit-mode sheet for ONE gem group — the build page's replacement for the
// full-screen all-groups GemsSheet. Holds the same per-group editor
// (GemLoadoutEditor) with every control and label unchanged, wired to the
// session's gemActions. Portaled to document.body at z-40 for the same reason
// as JewelsSheet/GemsSheet: an ancestor stacking context would otherwise sit
// this under the shell's sticky header.
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import GemLoadoutEditor from '@/components/build/GemLoadoutEditor';
import { mainSkillLoadout } from '@/lib/build/buildPage';
import type { GemLoadout } from '@/lib/build/gemState';
import { useBuildSession } from '../session/BuildSession';

export default function GemGroupSheet({
  loadout,
  index,
  onClose,
}: {
  /** The group being edited, or null when there is none (never opened, or it was just removed) — renders nothing. */
  loadout: GemLoadout | null;
  /** Display position in the rows, for the editor's "Skill n" / "Remove skill n" labels. */
  index: number;
  onClose: () => void;
}) {
  const { gems, gemActions } = useBuildSession();
  // Also gates the SSR pass, same reasoning as GearSheet/JewelsSheet.
  if (!loadout || typeof document === 'undefined') return null;
  const id = loadout.id;
  const isPrimary = mainSkillLoadout(gems)?.id === id;

  return createPortal(
    <div data-testid="gem-group-sheet" className="fixed inset-0 z-40 flex flex-col bg-background">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card/95 px-3 py-3 backdrop-blur">
        <span className="font-heading text-sm text-foreground">Skill group</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close skill group"
          className="flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground"
        >
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ul>
          <GemLoadoutEditor
            loadout={loadout}
            index={index}
            isPrimary={isPrimary}
            onSetSkill={(item) => gemActions.setSkill(id, item)}
            onAddSupport={(item) => gemActions.addSupport(id, item)}
            onRemoveSupport={(supportIndex) => gemActions.removeSupport(id, supportIndex)}
            // Removing the group also closes its sheet, so the tab drops its remembered id
            // rather than reopening this group if it ever comes back (e.g. after a Discard).
            onRemove={() => {
              gemActions.remove(id);
              onClose();
            }}
            onSetSets={(sets) => gemActions.setSets(id, sets)}
            onSetPrimary={() => gemActions.setPrimary(id)}
            onSetLevel={(level) => gemActions.setLevel(id, level)}
            onSetQuality={(quality) => gemActions.setQuality(id, quality)}
          />
        </ul>
      </div>
    </div>,
    document.body,
  );
}
