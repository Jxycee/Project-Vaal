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
//   `filledCount`, which the jewels section needs (see the session's
//   `jewels` usage). Dropping it would force a second call to
//   `summarizeJewels` just to recover a field the first call already
//   computed.
// - `BuildWarning` is imported from `@/lib/build/validate` (its declared
//   export point — see validate/index.ts's `export type { BuildWarning, ... }
//   from './types'`), matching the brief's own instruction to use
//   the gear editor's real prop type.
// =============================================================================
import type { GggTreeJson } from '@poe2-toolkit/tree-core/ggg';
import type { WeaponSet } from '@poe2-toolkit/tree-core';
import type { BuildEditorState, PassiveState } from '@/lib/build/types';
import type { GearItem, GearSlot } from '@/lib/build/gearSlots';
import type { GearState } from '@/lib/build/gearState';
import type { BuildConfig } from '@/lib/build/stats/buildConfig';
import type { GemState } from '@/lib/build/gemState';
import type { BuildWarning } from '@/lib/build/validate';
import type { JewelsSummary } from '@/lib/build/jewelState';
import type { ReservedSpiritResult } from '@/components/build/useReservedSpirit';
import type { Sheets } from '../HeaderStats';

/**
 * The header/save-panel fields. Deliberately NOT part of `BuildDraftState`
 * (drafts hold only tree/gear/gems) — see the controller ruling in the plan:
 * name/level/league/notes have the same protection the old editor gave them
 * (the old save panel's fields were never drafted either), which is the `dirty`
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
  /** The scratch planner (`/tree`): no saved row behind the session, so the first `save()` creates one and replaces the URL with its page. */
  scratch: boolean;
  /** The FULL tree export (5 MB), null until the Tree tab calls `requestFullTree`. Only the canvas reads it; everything else uses the lite file inside the session. */
  tree: GggTreeJson | null;
  /** Error from the full-export fetch; never affects the stats rail or warnings. */
  treeError: string | null;
  /** Starts the full-export fetch (idempotent). TreeTab calls it on mount. */
  requestFullTree: () => void;
  /** Always present — seeded from the checkpoint on mount, never null. */
  treeState: BuildEditorState;
  /** Bump to force whatever `PassiveTree` a consumer renders (keyed by this) to remount and re-seed. */
  treeSeedKey: number;
  livePassive: PassiveState;
  /** Quest id -> chosen option id; the same map livePassive carries as `questChoices`. */
  questChoices: Record<string, string>;
  /** The build's PoB Configuration as edited (undefined = none; conditional modifiers are then named, not counted). */
  buildConfig: BuildConfig | undefined;
  gear: GearState;
  gems: GemState;
  meta: BuildMeta;
  // ---- derived ----
  warnings: readonly BuildWarning[];
  offHandOccupied: Record<WeaponSet, GearItem | null>;
  /** null until the lite tree file loads (summarizeJewels needs it). */
  jewels: JewelsSummary | null;
  sheets: Sheets;
  reserved: ReservedSpiritResult | null;
  // ---- editing ----
  dirty: boolean;
  /**
   * True when name/level/league/notes differ from baseline, specifically —
   * NOT the same as `dirty`, which also covers tree/gear/gems. The checkpoint
   * switcher (slice 3) needs this split: meta is not drafted (see `BuildMeta`
   * above), so switching checkpoints loses a meta-only edit that a tree/gear/
   * gem edit would survive as a draft. The switcher's dirty hint tells the two
   * apart.
   */
  metaDirty: boolean;
  saving: boolean;
  saveError: string | null;
  savedAt: string | null;
  draftPromptOpen: boolean;
  /** Ignored while `!canEdit` — a read-only PassiveTree still reports its seeded state on mount. */
  setTreeState(next: BuildEditorState): void;
  setMeta(patch: Partial<BuildMeta>): void;
  /** Owner-only (a no-op otherwise). `null` clears the quest's choice; an id that is not that quest's option is dropped. */
  setQuestChoice(questId: string, optionId: string | null): void;
  /** Owner-only (a no-op otherwise). Ticks or unticks a PoB condition; flags the panel has no toggle for are kept. */
  setConfigCondition(name: string, on: boolean): void;
  /** Owner-only (a no-op otherwise). Sets a multiplier's count (whole, clamped; 0 removes it). */
  setConfigMultiplier(name: string, count: number): void;
  /**
   * The build's name was just saved to the database by something other than
   * `save()` (the settings menu's rename, which calls `renameBuild`). Sets the
   * live name AND the saved baseline to it, so the header shows it and the
   * session does not count it as an unsaved edit. Ignored while `!canEdit`.
   */
  applySavedName(name: string): void;
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
