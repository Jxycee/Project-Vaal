'use client';

// The checkpoint chip: "Lvl 94 · Endgame ▾". Choosing one is a server
// navigation (<Link>), so the page re-reads that checkpoint's rows and
// BuildPage remounts (it is keyed by checkpoint). The current tab is kept.
//
// Slice 3: management (add/rename/reorder/delete) lives in this menu's
// "Manage" view (the scratch planner has no checkpoints, so no manage view).
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { checkpointLabel, patchQuery } from '@/lib/build/buildPage';
import type { BuildCheckpoint } from '@/lib/build/checkpointState';
import type { CheckpointStateInput } from '@/app/(dashboard)/builds/checkpointActions';
import CheckpointManager from './CheckpointManager';
import { useBuildSession } from './session/BuildSession';

export interface CheckpointManageProps {
  buildId: string;
  /** Full checkpoint rows (tree/gear/gems included) — what the manage view acts on. */
  fullCheckpoints: BuildCheckpoint[];
  /** The editor's tree, gear and gems right now, unsaved edits included — what "Add checkpoint" copies. */
  currentState: CheckpointStateInput | null;
  /** The session's current level — the add form's default. */
  currentLevel: number;
  dirty: boolean;
  metaDirty: boolean;
}

/**
 * Builds the switcher's `manage` prop from the session, for whichever of
 * BuildHeader (full header) or BuildPage (compact sticky bar) is rendering a
 * switcher right now. `undefined` outside owner edit mode — a reader, or an
 * owner in view mode, gets the plain switch list only.
 */
export function useCheckpointManage(
  edit: boolean,
  buildId: string,
  fullCheckpoints: BuildCheckpoint[],
): CheckpointManageProps | undefined {
  const { gear, gems, livePassive, meta, dirty, metaDirty } = useBuildSession();
  if (!edit) return undefined;
  return {
    buildId,
    fullCheckpoints,
    currentState: { passive_state: livePassive, gear_state: gear, gem_state: gems },
    currentLevel: meta.level,
    dirty,
    metaDirty,
  };
}

export default function CheckpointSwitcher({
  shareToken,
  checkpoints,
  activeCheckpointId,
  fallbackLevel,
  align = 'left',
  compact = false,
  testId = 'checkpoint-switcher',
  manage,
}: {
  shareToken: string;
  checkpoints: { id: string; name: string; level: number }[];
  activeCheckpointId: string | undefined;
  /** Shown when checkpoints failed to load. */
  fallbackLevel: number;
  /**
   * Which edge the menu hangs from. 'right' keeps the menu on-screen when the
   * trigger sits toward the right of a narrow container (the compact sticky
   * bar) — anchoring from 'left' there runs the menu off the viewport edge.
   */
  align?: 'left' | 'right';
  /** Caps the trigger's own width so a long checkpoint name truncates instead of pushing neighbours off-screen — the compact bar. */
  compact?: boolean;
  /** The two switchers on screen at once (full header + compact bar) must not share a test id, or Playwright's strict mode trips. */
  testId?: string;
  /** Present only in owner edit mode — adds the "Manage"/"Done managing" toggle and its view. See `useCheckpointManage`. */
  manage?: CheckpointManageProps;
}) {
  const [open, setOpen] = useState(false);
  const [managing, setManaging] = useState(false);
  // Lifted out of CheckpointManager (fix round 1, final review) so Escape and
  // outside-click handlers below can see whether a rename is in progress
  // before deciding to close the whole menu — CheckpointManager unmounts
  // whenever `managing` goes false, and closing the menu always sets
  // `managing` false too, so state that lived only inside it was unrecoverable
  // the instant either fired mid-rename.
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const active = checkpoints.find((c) => c.id === activeCheckpointId) ?? checkpoints[0];
  const label = active ? checkpointLabel(active.name, active.level) : `Lvl ${fallbackLevel}`;

  const checkpointHref = (id: string | null) =>
    `/builds/${shareToken}${patchQuery(searchParams.toString(), { checkpoint: id })}`;

  const cancelRename = useCallback(() => {
    setRenamingId(null);
    setRenameValue('');
  }, []);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setManaging(false);
    cancelRename();
  }, [cancelRename]);

  const renaming = {
    id: renamingId,
    value: renameValue,
    start: (id: string, name: string) => {
      setRenamingId(id);
      setRenameValue(name);
    },
    setValue: setRenameValue,
    cancel: cancelRename,
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      // A rename with unsaved text (different from the checkpoint's saved
      // name it was prefilled with) survives an outside click — only the
      // click is swallowed, nothing closes. A rename with no edits yet, or no
      // rename open at all, behaves as before.
      const original = renamingId ? manage?.fullCheckpoints.find((c) => c.id === renamingId)?.name : undefined;
      if (renamingId !== null && renameValue !== original) return;
      closeMenu();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Escape always cancels an in-progress rename first, whether or not
      // its text changed — it never also closes the menu in the same press.
      if (renamingId !== null) {
        cancelRename();
        return;
      }
      closeMenu();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, renamingId, renameValue, manage, closeMenu, cancelRename]);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        data-testid={testId}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-11 min-w-11 items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 text-sm font-medium text-foreground ${
          compact ? 'max-w-[9.5rem]' : 'max-w-full'
        }`}
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={16} className="shrink-0 text-muted-foreground" />
      </button>
      {open ? (
        <div
          role="menu"
          data-testid="checkpoint-menu"
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-12 z-30 flex max-h-[70dvh] w-[min(18rem,calc(100vw-2rem))] flex-col overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-lg`}
        >
          {manage && manage.dirty ? (
            <p className="shrink-0 px-3 py-1 text-xs text-muted-foreground">
              Unsaved changes stay as a draft on this checkpoint.
              {manage.metaDirty ? ' Save first to keep name and notes changes.' : ''}
            </p>
          ) : null}

          {manage ? (
            // shrink-0: this menu overflows past max-h-[70dvh] with 8+
            // checkpoints (the whole point of overflow-y-auto below it) —
            // without it, flexbox's default shrink algorithm squashes this
            // button's cross-size down toward its text's line-height (~20px,
            // it has no vertical padding) well under the 44px tap-target
            // floor, since it's a direct child of the flex-col menu that the
            // scrollable rows list also lives in (2026-09-28 review).
            <button
              type="button"
              onClick={() => setManaging((m) => !m)}
              className="flex h-11 min-w-11 shrink-0 items-center justify-start rounded-md px-3 text-sm text-muted-foreground"
            >
              {managing ? 'Done managing' : 'Manage'}
            </button>
          ) : null}

          {manage && managing ? (
            <CheckpointManager
              buildId={manage.buildId}
              checkpoints={manage.fullCheckpoints}
              activeId={activeCheckpointId}
              currentLevel={manage.currentLevel}
              currentState={manage.currentState}
              checkpointHref={checkpointHref}
              onNavigate={closeMenu}
              renaming={renaming}
            />
          ) : (
            checkpoints.map((c) => (
              <Link
                key={c.id}
                role="menuitem"
                data-testid="checkpoint-option"
                data-checkpoint-id={c.id}
                aria-current={c.id === active?.id ? 'true' : undefined}
                href={checkpointHref(c.id)}
                onClick={closeMenu}
                className={`flex h-11 min-w-11 shrink-0 items-center justify-between gap-3 rounded-md px-3 text-sm ${
                  c.id === active?.id ? 'bg-accent text-foreground' : 'text-muted-foreground'
                }`}
              >
                <span className="truncate">{c.name}</span>
                <span className="shrink-0 tabular-nums">Lvl {c.level}</span>
              </Link>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
