'use client';

// The build's profile header. Full block at the top of the page; once it has
// scrolled out of view, a one-line sticky bar (name, checkpoint, action)
// takes its place above the tab strip — see BuildPage.
import { useState } from 'react';
import Link from 'next/link';
import type { WeaponSet } from '@poe2-toolkit/tree-core';
import type { GemLoadout } from '@/lib/build/gemState';
import type { SharedBuildRow, BuildVisibility } from '@/lib/build/types';
import { VISIBILITY_HINT, VISIBILITY_LABEL, isBuildVisibility } from '@/lib/build/visibility';
import { ascendancyLabel } from '@/lib/tree/ascendancyNames';
import type { ReservedSpiritResult } from '@/components/build/useReservedSpirit';
import CheckpointSwitcher from './CheckpointSwitcher';
import HeaderStats, { type Sheets } from './HeaderStats';

export interface HeaderProps {
  mode: 'owner' | 'reader';
  row: SharedBuildRow;
  authorName: string;
  tags: string[] | null;
  shareToken: string;
  checkpoints: { id: string; name: string; level: number }[];
  activeCheckpointId: string | undefined;
  mainSkill: GemLoadout | null;
  sheets: Sheets;
  set: WeaponSet;
  reserved: ReservedSpiritResult | null;
}

function editHref(row: SharedBuildRow, checkpointId: string | undefined): string {
  return checkpointId ? `/tree?build=${row.id}&checkpoint=${checkpointId}` : `/tree?build=${row.id}`;
}

export function HeaderActions({
  mode,
  row,
  shareToken,
  activeCheckpointId,
  compact = false,
}: Pick<HeaderProps, 'mode' | 'row' | 'shareToken' | 'activeCheckpointId'> & {
  /** The compact sticky bar has no room for Copy link below `sm` — Edit stays, Copy link hides. */
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
    <div className="flex shrink-0 items-center gap-2">
      {linkLive ? (
        <button
          type="button"
          onClick={copy}
          className={`${compact ? 'hidden sm:flex' : 'flex'} h-11 min-w-11 items-center rounded-lg border border-border px-3 text-sm text-foreground`}
        >
          {copied ? 'Copied' : 'Copy link'}
        </button>
      ) : null}
      {mode === 'owner' ? (
        <Link href={editHref(row, activeCheckpointId)} className="flex h-11 min-w-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
          Edit
        </Link>
      ) : null}
    </div>
  );
}

export default function BuildHeader(props: HeaderProps) {
  const { mode, row, authorName, tags, shareToken, checkpoints, activeCheckpointId, mainSkill, sheets, set, reserved } = props;
  const visibility: BuildVisibility | null = isBuildVisibility(row.visibility) ? row.visibility : null;
  return (
    <header className="flex flex-col gap-3 rounded-lg border border-border bg-card/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="line-clamp-2 break-words font-heading text-xl font-bold text-foreground">{row.name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {ascendancyLabel(row.class, row.ascendancy)} · Level {row.level} · {row.league}
          </p>
        </div>
        <HeaderActions mode={mode} row={row} shareToken={shareToken} activeCheckpointId={activeCheckpointId} />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>
          by <span data-testid="build-author" className="text-foreground">{authorName}</span>
        </span>
        {mode === 'owner' && visibility ? (
          <span data-testid="build-visibility" className="rounded-full border border-border px-2 py-0.5">
            {VISIBILITY_LABEL[visibility]} · {VISIBILITY_HINT[visibility]}
          </span>
        ) : null}
        {mode === 'reader' && row.visibility === 'public' ? <span>{row.view_count.toLocaleString()} views</span> : null}
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <CheckpointSwitcher shareToken={shareToken} checkpoints={checkpoints} activeCheckpointId={activeCheckpointId} fallbackLevel={row.level} />
        {mainSkill?.skill ? (
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
        ) : null}
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
