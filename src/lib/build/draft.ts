// src/lib/build/draft.ts
// In-progress editor state, kept so a refresh mid-edit does not discard an
// unsaved allocation, gear pick, or gem loadout. This is NOT the save
// mechanism – it is a safety net that the server save clears on success.
//
// Keyed by BUILD CONTEXT (buildId ?? 'scratch'), not by classId/ascendancyId.
// The old key scheme could never be restored: neither classId nor
// ascendancyId is known until PassiveTree reports its seeded state upward via
// onStateChange — and that first report fires on MOUNT, before any restore
// logic could run, immediately overwriting whatever draft was stored under
// the key it was about to compute. buildId is known at mount (it's a prop),
// so TreeBuildSession reads the draft in a lazy `useState` initialiser during
// the first render, before PassiveTree's mount effect ever fires.
//
// The draft carries the WHOLE editing session — tree allocation, gear and
// gems — not just the tree. A draft that only remembered the tree made two
// kinds of work vanish silently: a gear/gem-only edit never marked the
// session dirty (draftDiffersFrom had nothing to compare), and even when the
// tree *did* differ, restoring it brought back nodes while quietly dropping
// any gear or gems picked in the same session. See
// docs/superpowers/specs/2026-09-20-jewels-design.md and the gems plan for
// why gear/gem state is shaped the way `gearState.ts`/`gemState.ts` parse it.
import type { BuildEditorState } from '@/lib/build/types';
import { parseGearState, type GearState } from '@/lib/build/gearState';
import { parseGemState, type GemState } from '@/lib/build/gemState';
import { parseAttributeChoices } from '@/lib/build/passiveState';

export interface BuildDraftState {
  tree: BuildEditorState;
  gear: GearState;
  gem: GemState;
}

/**
 * The localStorage key for one editing session's draft.
 *
 * Scoped per checkpoint once a build has them: without that, switching from
 * checkpoint A to B would restore A's unsaved draft into B, and the next save
 * would write A's tree over B's. With no checkpoint the key is byte-identical
 * to the pre-checkpoint format, so drafts written before checkpoints existed —
 * and every scratch-mode draft — keep resolving.
 */
export function draftKey(buildId: string | undefined, checkpointId?: string): string {
  const base = `vaal:tree-draft:${buildId ?? 'scratch'}`;
  return checkpointId ? `${base}:${checkpointId}` : base;
}

export function saveDraft(buildId: string | undefined, draft: BuildDraftState, checkpointId?: string): void {
  try {
    localStorage.setItem(draftKey(buildId, checkpointId), JSON.stringify(draft));
  } catch {
    // Private window, blocked site data, or quota exceeded. A draft is a
    // convenience; losing it must never break the editor.
  }
}

// Validates the parsed shape rather than casting it. A draft written under
// the OLD key scheme, or hand-edited localStorage, must yield null rather
// than a malformed object that reaches PassiveTree as `initialState`.
function isValidTree(value: unknown): value is BuildEditorState {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.classId !== 'number') return false;
  if (typeof v.className !== 'string') return false;
  if (v.ascendancyId !== undefined && typeof v.ascendancyId !== 'string') return false;
  if (!Array.isArray(v.ascendancyNodes)) return false;
  const main = v.main;
  if (!main || typeof main !== 'object') return false;
  if (!Array.isArray((main as Record<string, unknown>).allocated)) return false;
  return true;
}

/**
 * `loadDraft` accepts two on-disk shapes:
 *
 * - The CURRENT shape: `{ tree, gear, gem }`.
 * - The OLD (pre-gear/gem) shape: a `BuildEditorState` sitting directly at
 *   the top level, with no `tree` key at all.
 *
 * An old-shape draft is migrated in place rather than rejected: the tree
 * allocation it holds is exactly as restorable as it ever was, and `gear`/
 * `gem` legitimately have nothing to restore — the old scheme never captured
 * them, so defaulting to empty loses nothing that the draft actually held.
 * This is a full restore of everything the draft carries, not a half one.
 * Rejecting instead would throw away a still-valid tree allocation for no
 * benefit. Both shapes are covered in draft.test.ts.
 *
 * `gear`/`gem`, when present, are run through the same defensive parsers the
 * server payload uses (`parseGearState`/`parseGemState`) — a malformed sub-
 * part degrades to empty independently rather than invalidating the whole
 * draft, same "one bad slot must not blank the others" rule those modules
 * already follow.
 */
function isValidDraftShape(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function loadDraft(buildId: string | undefined, checkpointId?: string): BuildDraftState | null {
  try {
    const raw = localStorage.getItem(draftKey(buildId, checkpointId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isValidDraftShape(parsed)) return null;

    const treeCandidate = 'tree' in parsed ? parsed.tree : parsed;
    if (!isValidTree(treeCandidate)) return null;

    // isValidTree checks the fields a restore needs; attributeChoices is read
    // defensively like gear and gems, or a junk entry fails every later save.
    const { attributeChoices, ...tree } = treeCandidate;
    const choices = parseAttributeChoices(attributeChoices);
    return {
      tree: Object.keys(choices).length > 0 ? { ...tree, attributeChoices: choices } : tree,
      gear: parseGearState('gear' in parsed ? parsed.gear : undefined),
      gem: parseGemState('gem' in parsed ? parsed.gem : undefined),
    };
  } catch {
    return null;
  }
}

export function clearDraft(buildId: string | undefined, checkpointId?: string): void {
  try {
    localStorage.removeItem(draftKey(buildId, checkpointId));
  } catch {
    // See saveDraft.
  }
}
