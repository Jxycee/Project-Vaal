'use client';

// Checkpoint mutations (switch, reorder, rename, two-tap delete, add), shared
// between CheckpointsSheet (the test-grade full-screen editor the scratch
// `/tree` editor still uses) and CheckpointSwitcher's manage view (the build
// page, slice 3). Extracted verbatim from CheckpointsSheet's `run`, `move`,
// rename and delete handlers, plus its Add button's inline logic — no
// behaviour change, just one implementation instead of two that could drift.
//
// Every write goes through checkpointActions.ts's Server Functions via
// callAction (never lets a thrown action take the page down — see its own
// header comment). Those Server Functions call next/cache's refresh()
// themselves on success (they are Server Actions, so they can), which is what
// re-renders the current route with fresh checkpoint rows — this hook does
// NOT also call the client router's refresh(): CheckpointsSheet never did
// either, and the two would be redundant.
import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  addCheckpoint,
  deleteCheckpoint,
  renameCheckpoint,
  reorderCheckpoints,
  type CheckpointStateInput,
} from '@/app/(dashboard)/builds/checkpointActions';
import type { BuildCheckpoint } from '@/lib/build/checkpointState';
import { callAction } from '@/lib/callAction';

export function useCheckpointActions({
  buildId,
  checkpoints,
  activeId,
  currentState,
  checkpointHref,
  onNavigate,
}: {
  /**
   * Undefined for a scratch session that has never saved (CheckpointsSheet's
   * only caller with no build yet — its own `!buildId` branch keeps the
   * content that would call into this hook from ever rendering in that case,
   * so `move`/`add` below only need to no-op defensively, not throw).
   */
  buildId: string | undefined;
  checkpoints: BuildCheckpoint[];
  activeId: string | undefined;
  /** The editor's tree, gear and gems right now, unsaved edits included — what `add` copies. Null before the tree has reported its state. */
  currentState: CheckpointStateInput | null;
  /** Where switching to (or opening) a checkpoint navigates. */
  checkpointHref: (checkpointId: string | null) => string;
  /** Runs after a successful navigation (switch or add) — e.g. close the menu. */
  onNavigate?: () => void;
}): {
  pending: boolean;
  error: string | null;
  goTo(id: string): void;
  move(index: number, delta: -1 | 1): void;
  rename(id: string, name: string, onDone?: () => void): void;
  armedDeleteId: string | null;
  requestDelete(id: string): void;
  add(name: string, level: number, onDone?: () => void): void;
} {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [armedDeleteId, setArmedDeleteId] = useState<string | null>(null);

  const goTo = useCallback(
    (checkpointId: string) => {
      router.push(checkpointHref(checkpointId));
      onNavigate?.();
    },
    [router, checkpointHref, onNavigate],
  );

  /** Runs one action, shows its error if it fails, and runs `after` on success. */
  const run = useCallback(
    (action: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => {
      setError(null);
      startTransition(async () => {
        const result = await callAction(action);
        if (!result.ok) {
          setError(result.error ?? 'Something went wrong.');
          return;
        }
        after?.();
      });
    },
    [],
  );

  const move = useCallback(
    (index: number, delta: -1 | 1) => {
      if (!buildId) return;
      const ids = checkpoints.map((c) => c.id);
      const target = index + delta;
      if (target < 0 || target >= ids.length) return;
      [ids[index], ids[target]] = [ids[target], ids[index]];
      run(() => reorderCheckpoints(buildId, ids));
    },
    [buildId, checkpoints, run],
  );

  const rename = useCallback(
    (id: string, name: string, onDone?: () => void) => {
      run(() => renameCheckpoint(id, name), onDone);
    },
    [run],
  );

  // Two taps, like the builds list: the first arms, the second deletes.
  const requestDelete = useCallback(
    (id: string) => {
      if (armedDeleteId !== id) {
        setArmedDeleteId(id);
        return;
      }
      setArmedDeleteId(null);
      run(() => deleteCheckpoint(id));
    },
    [armedDeleteId, run],
  );

  const add = useCallback(
    (name: string, level: number, onDone?: () => void) => {
      if (!buildId) return;
      setError(null);
      startTransition(async () => {
        const result = await callAction(() => addCheckpoint(buildId, name, level, activeId, currentState ?? undefined));
        if (!result.ok) {
          setError(result.error);
          return;
        }
        // Restores CheckpointsSheet's pre-refactor behaviour: it used to
        // clear its name field itself right here, before navigating. The
        // hook doesn't own that field (form fields are UI, not this hook's
        // job — see the file header), so it's the caller's job via `onDone`;
        // dropped by accident in the original extraction (fix round 1, final
        // review) because CheckpointManager's own success path (closing the
        // menu) hid the missed reset, but CheckpointsSheet stays mounted
        // across opens and would carry a stale name into the next one.
        onDone?.();
        goTo(result.id);
      });
    },
    [buildId, activeId, currentState, goTo],
  );

  return { pending, error, goTo, move, rename, armedDeleteId, requestDelete, add };
}
