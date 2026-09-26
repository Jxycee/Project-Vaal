// src/lib/build/checkpointState.ts
// =============================================================================
// Checkpoint list helpers — the leveling-journey analogue of gearState.ts and
// gemState.ts.
//
// A build is a sequence of named, leveled snapshots (competitor gap #5),
// stored one row per checkpoint in public.build_checkpoints rather than as
// jsonb on the builds row: they are queried ordered, inserted and deleted
// individually, and a share-link reader reaches them through their own
// SECURITY DEFINER function (get_build_checkpoints_by_share_token).
//
// Pure module: no React, no fetch. This is the unit-test target for
// everything checkpoint-related that is not wiring.
// =============================================================================

import { parsePassiveState } from './passiveState';
import type { PassiveState } from './types';

export interface BuildCheckpoint {
  id: string;
  /** Zero-based display order. UNIQUE per build in the database. */
  position: number;
  name: string;
  level: number;
  passive_state: PassiveState;
  /**
   * Raw jsonb as it comes off the row — validate with `parseGearState`
   * (`@/lib/build/gearState`) before use, never trust it directly. Left
   * `unknown` for exactly the reason `SavedBuild.gear_state` is: validating
   * it here too would make this module a second source of truth for a shape
   * gearState.ts already owns.
   */
  gear_state: unknown;
  /** Raw jsonb, same reasoning as `gear_state`. Validate with `parseGemState`. */
  gem_state: unknown;
}

function isFiniteInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Raw rows (from the table or from the share-token RPC) -> typed, ordered
 * checkpoints.
 *
 * Defensive in the same way `parseGearState` and `parseGemState` are: one
 * malformed entry is dropped on its own rather than throwing or discarding
 * the whole list, because a single bad row must not blank a user's build.
 *
 * The line between "drop" and "repair" is deliberate. Identity and ordering
 * (`id`, `position`, `name`, `level`) cannot be invented, so an entry missing
 * any of them is dropped. A malformed `passive_state` is repaired to
 * all-empty by `parsePassiveState`, because the checkpoint still exists and
 * the user still named it — showing it with an empty tree is honest, while
 * dropping it silently loses the fact that they made it.
 */
export function parseCheckpoints(raw: unknown): BuildCheckpoint[] {
  if (!Array.isArray(raw)) return [];

  const parsed: BuildCheckpoint[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const v = entry as Record<string, unknown>;

    if (!isNonEmptyString(v.id)) continue;
    if (!isNonEmptyString(v.name)) continue;
    if (!isFiniteInteger(v.position)) continue;
    if (!isFiniteInteger(v.level)) continue;

    parsed.push({
      id: v.id,
      position: v.position,
      name: v.name,
      level: v.level,
      passive_state: parsePassiveState(v.passive_state),
      gear_state: v.gear_state,
      gem_state: v.gem_state,
    });
  }

  return parsed.sort((a, b) => a.position - b.position);
}

/**
 * The checkpoint the editor is currently showing.
 *
 * Falls back to the first rather than returning null when `id` does not
 * match, because an unknown id is the ordinary case immediately after
 * deleting the active checkpoint — the selection points at a row that no
 * longer exists, and blanking the editor there would look like data loss.
 */
export function activeCheckpoint(
  list: BuildCheckpoint[],
  id: string | null,
): BuildCheckpoint | null {
  if (list.length === 0) return null;
  if (id !== null) {
    const found = list.find((c) => c.id === id);
    if (found) return found;
  }
  return list[0];
}

/**
 * The `position` a newly added checkpoint should take.
 *
 * `max(position) + 1`, never `length`. `(build_id, position)` is UNIQUE, so
 * after deleting a middle checkpoint — leaving, say, positions 0 and 2 —
 * `length` would return 2 and collide with the row already there.
 */
export function nextPosition(list: BuildCheckpoint[]): number {
  if (list.length === 0) return 0;
  return Math.max(...list.map((c) => c.position)) + 1;
}

/** Rewrites `position` to be contiguous from zero, preserving current order. */
export function renumber(list: BuildCheckpoint[]): BuildCheckpoint[] {
  return list.map((checkpoint, index) => ({ ...checkpoint, position: index }));
}

/**
 * Moves one checkpoint and renumbers the result contiguously from zero.
 *
 * Returns a new array; never mutates the input, since callers hold it as
 * React state. An out-of-range index returns the list unchanged rather than
 * throwing — a drag that ends outside the list is a no-op, not an error.
 */
export function reorder(list: BuildCheckpoint[], from: number, to: number): BuildCheckpoint[] {
  if (from < 0 || from >= list.length) return list;
  if (to < 0 || to >= list.length) return list;
  if (from === to) return list;

  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return renumber(next);
}

/**
 * The checkpoint a /tree session edits: the one the URL chose among the loaded
 * list — or, when the list failed to load, the checkpoint the build row
 * mirrors (builds.active_checkpoint_id), because that row's state is what the
 * editor is then showing. Saving and drafting under it is exact; with no id
 * at all, a multi-checkpoint build could not be saved and its drafts went
 * under a key no normal load reads (review 2026-09-26).
 */
export function editingCheckpointId(
  build: { active_checkpoint_id?: string | null } | null,
  list: BuildCheckpoint[],
  param: string | null,
): string | undefined {
  if (!build) return undefined;
  if (list.length > 0) return activeCheckpoint(list, param)?.id;
  return build.active_checkpoint_id ?? undefined;
}
