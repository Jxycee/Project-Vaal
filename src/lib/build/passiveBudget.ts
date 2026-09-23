// src/lib/build/passiveBudget.ts
// =============================================================================
// Character level -> passive-point budget. Pure module, no React.
//
// Previously TreeControls.tsx hardcoded MAX_BASIC_POINTS = 123 — the budget
// of a level-100 character (99 levelling points, levels 2-100, + 24 quest
// points) — regardless of what level the build actually claimed. That made
// `level` inert metadata: nothing on `/tree` read it. This module derives
// the SAME formula from the build's actual level, so a level-40 build's
// budget reads 63, not 123.
// =============================================================================

/**
 * Passive points awarded by quest completions, independent of level.
 * Verified in TreeControls.tsx's prior comment: the reference tree's budget
 * readout is 99 (levelling, levels 2-100) + 24 (quest) = 123 at level 100 —
 * so 24 is the level-independent term or the formula wouldn't land on 123
 * at exactly level 100. Fixed game constant, not derived from any save data.
 */
export const QUEST_PASSIVE_POINTS = 24;

/**
 * Passive points obtainable at a given character level: one point per level
 * past 1 (levels 2-100 each grant one) plus the fixed quest total. Matches
 * the previous hardcoded MAX_BASIC_POINTS=123 exactly at level 100:
 * (100 - 1) + 24 = 123.
 *
 * Levels outside 1-100 are clamped first — `builds.level` is validated to
 * 1-100 by POST /api/builds, but this is also called from client state that
 * can transiently hold something else (an in-progress edit in
 * BuildSavePanel), so clamping here (rather than trusting the caller) keeps
 * the budget always meaningful.
 */
export function derivePassiveBudget(level: number): number {
  const clamped = Number.isFinite(level) ? Math.min(100, Math.max(1, Math.trunc(level))) : 1;
  return clamped - 1 + QUEST_PASSIVE_POINTS;
}
