'use client';

// TEST-GRADE UI. Functional only, deliberately unstyled beyond the existing
// sheet shell, so leveling checkpoints can be exercised by hand and by e2e
// before the UI session designs the real thing. Replace, do not polish.
//
// Every operation goes through checkpointActions.ts (Server Functions that
// re-check the session and ownership) or, for switching, a navigation to
// ?checkpoint= — the /tree page is the only thing that decides which
// checkpoint is being edited, so a switch always re-reads fresh rows from the
// server rather than trusting whatever this component last held.
//
// Unsaved work is not lost on a switch: drafts are keyed per checkpoint
// (draft.ts), so switching away leaves the draft in place and switching back
// offers to restore it.
//
// Shell copied from JewelsSheet: a portal at z-40 with a 44px close button,
// which is also what e2e/mobile-layout.spec.ts's tap-target scan measures.
import { useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import {
  addCheckpoint,
  deleteCheckpoint,
  renameCheckpoint,
  reorderCheckpoints,
  type CheckpointStateInput,
} from '@/app/(dashboard)/builds/checkpointActions';
import type { BuildCheckpoint } from '@/lib/build/checkpointState';
import { callAction } from '@/lib/callAction';

const BUTTON = 'flex h-11 min-w-11 items-center justify-center rounded-md border border-border px-3 text-sm text-foreground disabled:opacity-50';

export default function CheckpointsSheet({
  open,
  buildId,
  loadedWithBuild,
  checkpoints,
  activeId,
  currentLevel,
  currentState,
  onClose,
}: {
  open: boolean;
  /** The saved build, if any. Undefined until a scratch session saves once. */
  buildId: string | undefined;
  /** False for a scratch session, which has no checkpoint list even after its first save. */
  loadedWithBuild: boolean;
  checkpoints: BuildCheckpoint[];
  activeId: string | undefined;
  /** The level in the save panel right now — the default for a new checkpoint. */
  currentLevel: number;
  /**
   * The editor's tree, gear and gems right now, unsaved edits included — what
   * a new checkpoint copies. Null before the tree has reported its state.
   */
  currentState: CheckpointStateInput | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newLevel, setNewLevel] = useState<number>(currentLevel);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [armedDeleteId, setArmedDeleteId] = useState<string | null>(null);

  // This component stays mounted while closed (it renders null), so the
  // useState seed above only ever sees the level from the first render.
  // Re-seed on each open so a new checkpoint defaults to the level in the
  // save panel NOW. Adjusting state during render on a prop change is React's
  // documented alternative to an effect here.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setNewLevel(currentLevel);
  }

  // Also gates the SSR pass, same reasoning as JewelsSheet.
  if (!open || typeof document === 'undefined') return null;

  const goTo = (checkpointId: string) => {
    router.push(`/tree?build=${buildId}&checkpoint=${checkpointId}`);
    onClose();
  };

  /** Runs one action, shows its error if it fails, and returns whether it succeeded. */
  const run = (action: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => {
    setError(null);
    startTransition(async () => {
      const result = await callAction(action);
      if (!result.ok) {
        setError(result.error ?? 'Something went wrong.');
        return;
      }
      after?.();
    });
  };

  const move = (index: number, delta: -1 | 1) => {
    if (!buildId) return;
    const ids = checkpoints.map((c) => c.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    run(() => reorderCheckpoints(buildId, ids));
  };

  return createPortal(
    <div className="fixed inset-0 z-40 flex flex-col bg-background" data-testid="checkpoints-sheet">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card/95 px-3 py-3 backdrop-blur">
        <span className="font-heading text-sm text-foreground">Checkpoints (test UI)</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close checkpoints sheet"
          className="flex h-11 w-11 items-center justify-center text-muted-foreground"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {!buildId ? (
          <p className="text-sm text-muted-foreground">Save the build first to add checkpoints.</p>
        ) : !loadedWithBuild ? (
          // A scratch session's first save created the build, but this page
          // was not loaded with ?build=, so it has no checkpoint rows to show.
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">Open the saved build to manage its checkpoints.</p>
            <a href={`/tree?build=${buildId}`} className={BUTTON}>
              Open saved build
            </a>
          </div>
        ) : (
          <>
            {error ? (
              <p role="alert" className="mb-3 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <ul className="flex flex-col gap-3" data-testid="checkpoint-list">
              {checkpoints.map((checkpoint, index) => {
                const isActive = checkpoint.id === activeId;
                return (
                  <li
                    key={checkpoint.id}
                    data-testid="checkpoint-row"
                    data-checkpoint-id={checkpoint.id}
                    className="flex flex-col gap-2 rounded-md border border-border p-2"
                  >
                    <div className="text-sm text-foreground">
                      <span className="font-medium">{checkpoint.name}</span> — level {checkpoint.level}
                      {isActive ? <span className="ml-2 text-xs text-muted-foreground">(editing)</span> : null}
                    </div>

                    {renamingId === checkpoint.id ? (
                      <div className="flex flex-wrap gap-2">
                        <input
                          aria-label="New checkpoint name"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          maxLength={80}
                          className="h-11 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-sm"
                        />
                        <button
                          type="button"
                          className={BUTTON}
                          disabled={pending}
                          onClick={() =>
                            run(() => renameCheckpoint(checkpoint.id, renameValue), () => setRenamingId(null))
                          }
                        >
                          Save name
                        </button>
                        <button type="button" className={BUTTON} onClick={() => setRenamingId(null)}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {!isActive ? (
                          <button type="button" className={BUTTON} disabled={pending} onClick={() => goTo(checkpoint.id)}>
                            Edit
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className={BUTTON}
                          aria-label={`Move ${checkpoint.name} up`}
                          disabled={pending || index === 0}
                          onClick={() => move(index, -1)}
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          className={BUTTON}
                          aria-label={`Move ${checkpoint.name} down`}
                          disabled={pending || index === checkpoints.length - 1}
                          onClick={() => move(index, 1)}
                        >
                          Down
                        </button>
                        <button
                          type="button"
                          className={BUTTON}
                          disabled={pending}
                          onClick={() => {
                            setRenamingId(checkpoint.id);
                            setRenameValue(checkpoint.name);
                          }}
                        >
                          Rename
                        </button>
                        {/* Two taps, like the builds list: the first arms, the second deletes. */}
                        <button
                          type="button"
                          className={BUTTON}
                          disabled={pending}
                          onClick={() => {
                            if (armedDeleteId !== checkpoint.id) {
                              setArmedDeleteId(checkpoint.id);
                              return;
                            }
                            setArmedDeleteId(null);
                            run(() => deleteCheckpoint(checkpoint.id));
                          }}
                        >
                          {armedDeleteId === checkpoint.id ? 'Confirm delete' : 'Delete'}
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3">
              <p className="text-sm font-medium text-foreground">Add a checkpoint (copy of the one being edited)</p>
              <input
                aria-label="Checkpoint name"
                placeholder={`Level ${newLevel}`}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={80}
                className="h-11 rounded-md border border-border bg-background px-2 text-sm"
              />
              <input
                aria-label="Checkpoint level"
                type="number"
                min={1}
                max={100}
                value={newLevel}
                onChange={(e) => setNewLevel(Number(e.target.value))}
                className="h-11 rounded-md border border-border bg-background px-2 text-sm"
              />
              <button
                type="button"
                className={BUTTON}
                disabled={pending}
                onClick={() => {
                  const name = newName.trim() || `Level ${newLevel}`;
                  setError(null);
                  startTransition(async () => {
                    const result = await callAction(() => addCheckpoint(buildId, name, newLevel, activeId, currentState ?? undefined));
                    if (!result.ok) {
                      setError(result.error);
                      return;
                    }
                    setNewName('');
                    goTo(result.id);
                  });
                }}
              >
                Add checkpoint
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
