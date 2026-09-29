'use client';

// The build's profile header. Full block at the top of the page; once it has
// scrolled out of view, a one-line sticky bar (name, checkpoint, action)
// takes its place above the tab strip — see BuildPage. In edit mode the
// name/level/league become inputs; class and ascendancy stay read-only text
// here (they only change on the Tree tab).
import { useState } from 'react';
import { headlineSet, mainSkillLoadout } from '@/lib/build/buildPage';
import { MAX_BUILD_LABEL_LENGTH, MAX_BUILD_NAME_LENGTH } from '@/lib/build/constants';
import type { SharedBuildRow, BuildVisibility } from '@/lib/build/types';
import { VISIBILITY_HINT, VISIBILITY_LABEL, isBuildVisibility } from '@/lib/build/visibility';
import { ascendancyLabel } from '@/lib/tree/ascendancyNames';
import CheckpointSwitcher, { useCheckpointManage } from './CheckpointSwitcher';
import BuildSettings from './BuildSettings';
import HeaderStats from './HeaderStats';
import UsernameHint from './UsernameHint';
import { useBuildSession } from './session/BuildSession';
import type { BuildCheckpoint } from '@/lib/build/checkpointState';

export interface HeaderProps {
  mode: 'owner' | 'reader';
  row: SharedBuildRow;
  authorName: string;
  ownerHasUsername?: boolean;
  tags: string[] | null;
  shareToken: string;
  checkpoints: { id: string; name: string; level: number }[];
  activeCheckpointId: string | undefined;
  fullCheckpoints: BuildCheckpoint[];
  /** Owner-only, whether `?edit=1` is active right now. Always false for a reader. */
  edit: boolean;
  onToggleEdit: () => void;
  onRequestDone: () => void;
}

/**
 * Buffers the level field as a string so a user can clear it or type a
 * partial number without it snapping back — clamped to 1-100 only once the
 * field loses focus, same shape as the old save panel's level handling.
 *
 * Seeded once (lazy initial state), not re-synced from `level` on every
 * render: the only way `level` changes while this input is mounted is this
 * input's own `commit` below. Every OTHER way `meta.level` can reset
 * (Discard, restoring a draft) always leaves edit mode as part of the same
 * action, which unmounts this input entirely — so there is no live case
 * where an external `level` change needs to be reflected into an
 * already-mounted instance, and adding a resync effect for it would just be
 * a setState-in-effect with nothing real to synchronize (react-hooks/
 * set-state-in-effect).
 */
function LevelInput({ level, onChange }: { level: number; onChange: (level: number) => void }) {
  const [raw, setRaw] = useState(() => String(level));

  function commit() {
    const parsed = Number.parseInt(raw, 10);
    const clamped = Number.isFinite(parsed) ? Math.min(100, Math.max(1, parsed)) : level;
    setRaw(String(clamped));
    if (clamped !== level) onChange(clamped);
  }

  return (
    <input
      id="build-level"
      inputMode="numeric"
      value={raw}
      onChange={(e) => setRaw(e.target.value)}
      onBlur={commit}
      className="h-11 w-full rounded-md border border-border bg-background px-2 text-sm"
    />
  );
}

/** Edit-mode name / level / league inputs plus the read-only class line. Shared by the saved-build header and the scratch one. */
function MetaFields({ ascendancyText }: { ascendancyText: string }) {
  const { meta, setMeta } = useBuildSession();
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="flex flex-col gap-1">
        <label htmlFor="build-name" className="text-xs text-muted-foreground">
          Name
        </label>
        <input
          id="build-name"
          value={meta.name}
          onChange={(e) => setMeta({ name: e.target.value })}
          maxLength={MAX_BUILD_NAME_LENGTH}
          className="h-11 w-full rounded-md border border-border bg-background px-2 text-sm"
        />
      </div>
      {/* Slice 3 task 4: level and league share one row (grid, not
          flex-wrap) — flex-wrap let League drop to its own line at
          375px, which was most of this header's height. */}
      <div className="grid grid-cols-[6rem_1fr] gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="build-level" className="text-xs text-muted-foreground">
            Level
          </label>
          <LevelInput level={meta.level} onChange={(level) => setMeta({ level })} />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="build-league" className="text-xs text-muted-foreground">
            League
          </label>
          <input
            id="build-league"
            value={meta.league}
            onChange={(e) => setMeta({ league: e.target.value })}
            maxLength={MAX_BUILD_LABEL_LENGTH}
            className="h-11 w-full rounded-md border border-border bg-background px-2 text-sm"
          />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{ascendancyText}</p>
    </div>
  );
}

/** The main skill's icon and name, when one is set. */
function MainSkillChip() {
  const { gems } = useBuildSession();
  const mainSkill = mainSkillLoadout(gems);
  if (!mainSkill?.skill) return null;
  return (
    <span className="flex min-w-0 items-center gap-2 text-sm text-foreground">
      <span className="h-7 w-7 shrink-0 overflow-hidden rounded border border-border bg-card/60">
        {mainSkill.skill.iconUrl ? (
          // Plain <img>: /data/wiki/ is auth-gated, which next/image's optimizer cannot follow.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mainSkill.skill.iconUrl} alt="" className="h-full w-full object-contain" />
        ) : null}
      </span>
      <span data-testid="build-main-skill" className="truncate">
        {mainSkill.skill.name}
      </span>
    </span>
  );
}

/**
 * The scratch planner's header (`/tree`, spec 7.3): the same card as
 * BuildHeader in edit mode, minus everything that needs a saved row (author,
 * visibility, checkpoint switcher, Copy link, settings, Edit/Done, tags).
 * The title reads "Untitled build" until a name is typed.
 */
export function ScratchHeader() {
  const { meta, treeState, gems, sheets, reserved } = useBuildSession();
  const set = headlineSet(gems);
  const ascendancyText = ascendancyLabel(treeState.className, treeState.ascendancyId ?? null);
  return (
    <header className="flex flex-col gap-3 rounded-lg border border-border bg-card/40 p-4">
      <h1 data-testid="scratch-title" className="line-clamp-2 break-words font-heading text-xl font-bold text-foreground">
        {meta.name.trim() || 'Untitled build'}
      </h1>
      <MetaFields ascendancyText={ascendancyText} />
      <MainSkillChip />
      <HeaderStats sheets={sheets} set={set} reserved={reserved} />
    </header>
  );
}

export function HeaderActions({
  mode,
  row,
  shareToken,
  tags = null,
  checkpointIds = [],
  compact = false,
  edit,
  onToggleEdit,
  onRequestDone,
}: Pick<HeaderProps, 'mode' | 'row' | 'shareToken' | 'edit' | 'onToggleEdit' | 'onRequestDone'> & {
  /** Every checkpoint id of the build, for the settings menu's delete (which clears each one's draft). */
  checkpointIds?: readonly string[];
  /** The owner's tags, for the settings menu. Not needed by the compact bar, which has no settings button. */
  tags?: string[] | null;
  /** The compact sticky bar has no room for Copy link below `sm` — Edit stays, Copy link hides; the settings button lives in the full header only. */
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const linkLive = row.visibility !== 'unlisted';
  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/builds/${shareToken}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }
  return (
    // flex-wrap + a max width below `sm`: with Copy link, settings and Edit
    // side by side the name column would be squeezed to a sliver at 375px.
    <div className="flex max-w-[11.5rem] shrink-0 flex-wrap items-center justify-end gap-2 sm:max-w-none">
      {linkLive ? (
        <button
          type="button"
          onClick={copy}
          className={`${compact ? 'hidden sm:flex' : 'flex'} h-11 min-w-11 items-center rounded-lg border border-border px-3 text-sm text-foreground`}
        >
          {copied ? 'Copied' : 'Copy link'}
        </button>
      ) : null}
      {mode === 'owner' && !compact ? (
        <BuildSettings buildId={row.id} visibility={row.visibility} tags={tags} edit={edit} checkpointIds={checkpointIds} />
      ) : null}
      {mode === 'owner' ? (
        <button
          type="button"
          onClick={edit ? onRequestDone : onToggleEdit}
          className="flex h-11 min-w-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          {edit ? 'Done' : 'Edit'}
        </button>
      ) : null}
    </div>
  );
}

export default function BuildHeader(props: HeaderProps) {
  const { mode, row, authorName, ownerHasUsername = true, tags, shareToken, checkpoints, activeCheckpointId, fullCheckpoints, edit, onToggleEdit, onRequestDone } = props;
  const { meta, treeState, gems, sheets, reserved } = useBuildSession();
  const set = headlineSet(gems);
  const visibility: BuildVisibility | null = isBuildVisibility(row.visibility) ? row.visibility : null;
  const ascendancyText = ascendancyLabel(treeState.className, treeState.ascendancyId ?? null);
  const manage = useCheckpointManage(edit, row.id, fullCheckpoints);
  return (
    <header className="flex flex-col gap-3 rounded-lg border border-border bg-card/40 p-4">
      <div className="flex items-start justify-between gap-3">
        {edit ? (
          <MetaFields ascendancyText={ascendancyText} />
        ) : (
          <div className="min-w-0">
            <h1 className="line-clamp-2 break-words font-heading text-xl font-bold text-foreground">{meta.name}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {ascendancyText} · Level {meta.level} · {meta.league}
            </p>
          </div>
        )}
        <HeaderActions
          mode={mode}
          row={row}
          shareToken={shareToken}
          tags={tags}
          checkpointIds={checkpoints.map((c) => c.id)}
          edit={edit}
          onToggleEdit={onToggleEdit}
          onRequestDone={onRequestDone}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>
          by <span data-testid="build-author" className="text-foreground">{authorName}</span>
        </span>
        {mode === 'owner' && !ownerHasUsername ? <UsernameHint /> : null}
        {mode === 'owner' && visibility ? (
          <span data-testid="build-visibility" className="rounded-full border border-border px-2 py-0.5">
            {VISIBILITY_LABEL[visibility]} · {VISIBILITY_HINT[visibility]}
          </span>
        ) : null}
        {row.visibility === 'public' ? <span>{row.view_count.toLocaleString()} views</span> : null}
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <CheckpointSwitcher
          shareToken={shareToken}
          checkpoints={checkpoints}
          activeCheckpointId={activeCheckpointId}
          fallbackLevel={row.level}
          manage={manage}
        />
        <MainSkillChip />
      </div>

      <HeaderStats sheets={sheets} set={set} reserved={reserved} />

      {tags !== null && tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="rounded-full border border-border bg-card/60 px-2.5 py-1 text-xs text-muted-foreground">
              #{tag}
            </span>
          ))}
        </div>
      ) : null}
    </header>
  );
}
