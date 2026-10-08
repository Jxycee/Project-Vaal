'use client';

// The checkpoint switcher's manage view (slice 3, task 3): add/rename/
// reorder/two-tap-delete, moved out of a full-screen sheet into
// the header's menu. Owner edit mode only — CheckpointSwitcher never mounts
// this without a `manage` bundle. Every mutation goes through
// useCheckpointActions (task 2), the hook that owns the checkpoint mutations, so
// behaviour lives in one place.
import { useState } from 'react';
import Link from 'next/link';
import type { CheckpointStateInput } from '@/app/(dashboard)/builds/checkpointActions';
import type { BuildCheckpoint } from '@/lib/build/checkpointState';
import { useCheckpointActions } from '@/components/build/useCheckpointActions';

const ROW_BUTTON =
  'flex h-11 min-w-11 items-center justify-center rounded-md border border-border px-3 text-sm text-foreground disabled:opacity-50';

/**
 * The rename form's state, OWNED BY THE SWITCHER (not this component) — fix
 * round 1, final review: this view unmounts whenever `managing` goes false
 * (Done managing, a switch, Escape, an outside click), so state that lived
 * only in here was unrecoverable the instant any of those fired mid-rename.
 * Lifting it lets CheckpointSwitcher's Escape/outside-click handlers see and
 * protect an in-progress rename before deciding whether to close.
 */
export interface CheckpointRenameState {
  id: string | null;
  value: string;
  start(id: string, name: string): void;
  setValue(value: string): void;
  cancel(): void;
}

export default function CheckpointManager({
  buildId,
  checkpoints,
  activeId,
  currentLevel,
  currentState,
  checkpointHref,
  onNavigate,
  renaming,
}: {
  buildId: string;
  /** Full rows (tree/gear/gems included) — what `add` copies from and `move`/`rename`/`requestDelete` act on. */
  checkpoints: BuildCheckpoint[];
  activeId: string | undefined;
  /** The session's current level — the new-checkpoint form's default. */
  currentLevel: number;
  currentState: CheckpointStateInput | null;
  checkpointHref: (checkpointId: string | null) => string;
  /** Closes the menu (and exits manage view) — a switch or a successful add. */
  onNavigate: () => void;
  renaming: CheckpointRenameState;
}) {
  const [newName, setNewName] = useState('');
  const [newLevel, setNewLevel] = useState<number>(currentLevel);

  const { pending, error, move, rename, armedDeleteId, requestDelete, add, duplicate } = useCheckpointActions({
    buildId,
    checkpoints,
    activeId,
    currentState,
    checkpointHref,
    onNavigate,
  });

  return (
    <div data-testid="checkpoint-manager" className="flex shrink-0 flex-col gap-2 pt-1">
      {error ? (
        <p role="alert" className="px-3 py-1 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {checkpoints.map((checkpoint, index) => (
          <li
            key={checkpoint.id}
            data-testid="checkpoint-row"
            data-checkpoint-id={checkpoint.id}
            className="flex flex-col gap-2 rounded-md border border-border p-2"
          >
            {renaming.id === checkpoint.id ? (
              <div className="flex flex-wrap gap-2">
                <input
                  aria-label="New checkpoint name"
                  value={renaming.value}
                  onChange={(e) => renaming.setValue(e.target.value)}
                  maxLength={80}
                  className="h-11 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-sm"
                />
                <button
                  type="button"
                  className={ROW_BUTTON}
                  disabled={pending}
                  onClick={() => rename(checkpoint.id, renaming.value, renaming.cancel)}
                >
                  Save name
                </button>
                <button type="button" className={ROW_BUTTON} onClick={renaming.cancel}>
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <Link
                  role="menuitem"
                  data-testid="checkpoint-option"
                  data-checkpoint-id={checkpoint.id}
                  aria-current={checkpoint.id === activeId ? 'true' : undefined}
                  href={checkpointHref(checkpoint.id)}
                  onClick={onNavigate}
                  className={`flex h-11 min-w-11 items-center justify-between gap-3 rounded-md px-3 text-sm ${
                    checkpoint.id === activeId ? 'bg-accent text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <span className="truncate">{checkpoint.name}</span>
                  <span className="shrink-0 tabular-nums">Lvl {checkpoint.level}</span>
                </Link>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={ROW_BUTTON}
                    aria-label={`Move ${checkpoint.name} up`}
                    disabled={pending || index === 0}
                    onClick={() => move(index, -1)}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    className={ROW_BUTTON}
                    aria-label={`Move ${checkpoint.name} down`}
                    disabled={pending || index === checkpoints.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    className={ROW_BUTTON}
                    disabled={pending}
                    onClick={() => renaming.start(checkpoint.id, checkpoint.name)}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className={ROW_BUTTON}
                    aria-label={`Duplicate ${checkpoint.name}`}
                    disabled={pending}
                    onClick={() => duplicate(checkpoint.id)}
                  >
                    Duplicate
                  </button>
                  {/* Two taps, like the builds list and the sheet: the first arms, the second deletes. */}
                  <button
                    type="button"
                    className={ROW_BUTTON}
                    disabled={pending}
                    onClick={() => requestDelete(checkpoint.id)}
                  >
                    {armedDeleteId === checkpoint.id ? 'Confirm delete' : 'Delete'}
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2 border-t border-border pt-2">
        <p className="px-1 text-sm font-medium text-foreground">Add a checkpoint (copy of the one being edited)</p>
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
          className={ROW_BUTTON}
          disabled={pending}
          onClick={() => add(newName.trim() || `Level ${newLevel}`, newLevel, () => setNewName(''))}
        >
          Add checkpoint
        </button>
      </div>
    </div>
  );
}
