// src/lib/build/draftCompare.ts
// Is a restored draft actually different from what's already on the page?
//
// Without this, EVERY visit to a saved build shows a bogus "unsaved changes"
// prompt: PassiveTree's mount effect reports its freshly-seeded state
// upward, TreeBuildSession's draft-save effect writes that straight into
// localStorage, and the next load-check finds a draft that is byte-for-byte
// what the build itself already holds. A pure comparison, run once against
// the draft read at mount, is what tells "genuinely unsaved work" apart from
// "the draft is just an echo of the build".
import { toPassiveState } from '@/lib/build/passiveState';
import type { BuildEditorState, SavedBuild } from '@/lib/build/types';

function sortedNumbers(nums: number[]): number[] {
  return [...nums].sort((a, b) => a - b);
}

// Array order is not meaningful for any of these sets, and the
// draft<->passive_state converters (toPassiveState/fromPassiveState) make no
// ordering guarantee — so a raw index-by-index comparison would report a
// difference that isn't one. Sort numerically first.
function sameNumberSet(a: number[], b: number[]): boolean {
  const sa = sortedNumbers(a);
  const sb = sortedNumbers(b);
  if (sa.length !== sb.length) return false;
  return sa.every((n, i) => n === sb[i]);
}

export function draftDiffersFrom(
  draft: BuildEditorState,
  build: Pick<SavedBuild, 'class' | 'ascendancy' | 'passive_state'> | null,
): boolean {
  if (build === null) {
    // Scratch mode: an untouched session (nothing allocated) has nothing
    // worth restoring, and must not prompt.
    return draft.main.allocated.length > 0 || draft.ascendancyNodes.length > 0;
  }

  if (draft.className !== build.class) return true;
  if ((draft.ascendancyId ?? null) !== build.ascendancy) return true;

  const draftState = toPassiveState(draft.main, draft.ascendancyNodes);
  const savedState = build.passive_state;

  return (
    !sameNumberSet(draftState.set1, savedState.set1) ||
    !sameNumberSet(draftState.set2, savedState.set2) ||
    !sameNumberSet(draftState.ascendancyNodes, savedState.ascendancyNodes)
  );
}
