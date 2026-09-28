// src/components/buildpage/session/sessionTypes.ts
// =============================================================================
// The value shape `BuildSession.tsx`'s context exposes. Split into its own
// file so consumers (BuildPage's tabs, the sheets they open) can import just
// the types without pulling in the provider's implementation.
//
// Ported from task-2-brief.md's interface, with two deliberate deviations —
// both because the brief's inline shapes don't match the real return types
// they were describing (see the brief's own "use the real type names" note):
//
// - `jewels` uses the actual `JewelsSummary` (from jewelState.ts), not the
//   brief's inline `{ sockets, orphans }` — `summarizeJewels` also returns
//   `filledCount`, which `JewelsChip` needs (see TreeBuildSession's
//   `jewelsSummary` usage). Dropping it would force a second call to
//   `summarizeJewels` just to recover a field the first call already
//   computed.
// - `BuildWarning` is imported from `@/lib/build/validate` (its declared
//   export point — see validate/index.ts's `export type { BuildWarning, ... }
//   from './types'`), matching the brief's own instruction to use
//   `GearSheet`'s real prop type.
// =============================================================================
import type { GggTreeJson } from '@poe2-toolkit/tree-core/ggg';
import type { WeaponSet } from '@poe2-toolkit/tree-core';
import type { BuildEditorState, PassiveState } from '@/lib/build/types';
import type { GearItem, GearSlot } from '@/lib/build/gearSlots';
import type { GearState } from '@/lib/build/gearState';
import type { GemState } from '@/lib/build/gemState';
import type { BuildWarning } from '@/lib/build/validate';
import type { JewelsSummary } from '@/lib/build/jewelState';
import type { ReservedSpiritResult } from '@/components/build/useReservedSpirit';
import type { Sheets } from '../HeaderStats';

/**
 * The header/save-panel fields. Deliberately NOT part of `BuildDraftState`
 * (drafts hold only tree/gear/gems) — see the controller ruling in the plan:
 * name/level/league/notes have the same protection the old editor gave them
 * (BuildSavePanel's fields were never drafted either), which is the `dirty`
 * guard alone, not a localStorage safety net.
 */
export interface BuildMeta {
  name: string;
  level: number;
  league: string;
  notes: string;
}

export interface BuildSessionValue {
  /** True for the build's owner. False makes every write helper below a no-op. */
  canEdit: boolean;
  /** The tree export, once the shared page's lazy fetch resolves. */
  tree: GggTreeJson | null;
  treeError: string | null;
  /** Always present — seeded from the checkpoint on mount, never null. */
  treeState: BuildEditorState;
  /** Bump to force whatever `PassiveTree` a consumer renders (keyed by this) to remount and re-seed. */
  treeSeedKey: number;
  livePassive: PassiveState;
  gear: GearState;
  gems: GemState;
  meta: BuildMeta;
  // ---- derived ----
  warnings: readonly BuildWarning[];
  offHandOccupied: Record<WeaponSet, GearItem | null>;
  /** null until the tree export loads (summarizeJewels needs it). */
  jewels: JewelsSummary | null;
  sheets: Sheets;
  reserved: ReservedSpiritResult | null;
  // ---- editing ----
  dirty: boolean;
  saving: boolean;
  saveError: string | null;
  savedAt: string | null;
  draftPromptOpen: boolean;
  /** Ignored while `!canEdit` — a read-only PassiveTree still reports its seeded state on mount. */
  setTreeState(next: BuildEditorState): void;
  setMeta(patch: Partial<BuildMeta>): void;
  setGearSlot(slot: GearSlot, item: GearItem | null): void;
  pickJewel(socketId: string, item: GearItem): void;
  clearJewel(socketId: string): void;
  gemActions: {
    add(): void;
    remove(id: string): void;
    setSkill(id: string, item: GearItem | null): void;
    addSupport(id: string, item: GearItem): void;
    removeSupport(id: string, index: number): void;
    setSets(id: string, sets: readonly WeaponSet[]): void;
    setPrimary(id: string): void;
    setLevel(id: string, level: number): void;
    setQuality(id: string, quality: number): void;
  };
  /** true on success. No-op (returns false) when `!canEdit`. */
  save(): Promise<boolean>;
  /** Back to the last saved state: tree/gear/gems/meta reset from baseline, draft cleared, tree re-seeded. */
  discard(): void;
  /** Applies the stored draft's tree/gear/gems, re-seeds the tree, closes the prompt. */
  restoreDraft(): void;
  /** "Discard" on the draft notice: clears the draft, closes the prompt. Does NOT touch current state. */
  dismissDraft(): void;
}
