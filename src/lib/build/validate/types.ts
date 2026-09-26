// src/lib/build/validate/types.ts
// =============================================================================
// What the structural validator returns. Derived from a checkpoint's state on
// every render and never stored — a warning is a signal, never a block (see
// plans/2026-09-24-slice3-structural-validation.md, "Why warn, not block").
// =============================================================================

import type { GearSlot } from '../gearSlots';

export type WarningCode =
  | 'two-handed-occupied'
  | 'offhand-not-allowed'
  | 'quiver-needs-bow'
  | 'handedness-unknown'
  | 'slot-category-mismatch'
  | 'weapon-set-points-over'
  | 'ascendancy-points-over'
  // Slice 4 — item craft (validate/affixRules.ts)
  | 'affix-over-limit'
  | 'affix-duplicate-group'
  | 'affix-unknown'
  | 'affix-wrong-kind'
  | 'affix-not-eligible'
  | 'affix-above-item-level'
  | 'roll-out-of-range'
  | 'runes-over-limit'
  | 'rune-unknown';

/** Where a warning belongs, so a surface can mark the offending row rather than only list it. */
export type WarningTarget = { kind: 'gear'; slot: GearSlot } | { kind: 'jewel'; nodeId: string } | { kind: 'tree' };

export interface BuildWarning {
  code: WarningCode;
  /** `note` = something we cannot decide from our data, said rather than guessed. */
  severity: 'warning' | 'note';
  target: WarningTarget;
  message: string;
}
