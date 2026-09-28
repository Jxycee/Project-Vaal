'use client';

// /builds/[shareToken] — the build's page, for its owner and for readers.
// Spec: docs/superpowers/specs/2026-09-27-build-profile-redesign-design.md.
//
// Keyed by checkpoint in the server page, so every hook below belongs to one
// checkpoint for its whole life. The tab lives only in the URL (?tab=, set by
// BuildTabs with pushState), so switching tabs re-renders this component and
// never reaches the server. Edit mode lives in the URL too (?edit=1, owner
// only), toggled with history.replaceState — see BuildHeader.
//
// All build-scoped state (tree, gear, gems, meta, drafts, save) lives one
// level up, in BuildSessionProvider — this component and everything below it
// only ever reads it through useBuildSession(), so an unsaved edit shows up
// everywhere at once without any prop threading of its own.
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { headlineSet, parseTab } from '@/lib/build/buildPage';
import type { SharedBuildRow } from '@/lib/build/types';
import type { BuildCheckpoint } from '@/lib/build/checkpointState';
import { useTreeExport } from './useTreeExport';
import BuildSessionProvider, { useBuildSession } from './session/BuildSession';
import BuildHeader, { HeaderActions } from './BuildHeader';
import BuildTabs from './BuildTabs';
import CheckpointSwitcher from './CheckpointSwitcher';
import StatsRail from './StatsRail';
import OverviewTab from './tabs/OverviewTab';
import GearTab from './tabs/GearTab';
import SkillsTab from './tabs/SkillsTab';
import TreeTab from './tabs/TreeTab';
import StatsTab from './tabs/StatsTab';

export interface BuildPageProps {
  mode: 'owner' | 'reader';
  row: SharedBuildRow;
  authorName: string;
  tags: string[] | null;
  shareToken: string;
  checkpoints: { id: string; name: string; level: number }[];
  activeCheckpointId: string | undefined;
  /** Full checkpoint rows (tree/gear/gems included), owner only — [] for a reader. What CheckpointsSheet needs; the lightweight `checkpoints` above is only ever enough for the switcher. */
  fullCheckpoints: BuildCheckpoint[];
}

export default function BuildPage(props: BuildPageProps) {
  const { mode, row, activeCheckpointId } = props;
  const { tree, error: treeError } = useTreeExport();
  return (
    <BuildSessionProvider canEdit={mode === 'owner'} row={row} checkpointId={activeCheckpointId} tree={tree} treeError={treeError}>
      <BuildPageBody {...props} />
    </BuildSessionProvider>
  );
}

function BuildPageBody(props: BuildPageProps) {
  const { mode, row, authorName, tags, shareToken, checkpoints, activeCheckpointId } = props;
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get('tab'));
  const edit = mode === 'owner' && searchParams.get('edit') === '1';
  const { gems, sheets, reserved, meta } = useBuildSession();
  const set = headlineSet(gems);

  // The compact sticky bar appears once the full header has scrolled away.
  const headerRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setCompact(!entry.isIntersecting), { rootMargin: '-80px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div data-testid="build-page" className="flex min-w-0 flex-col gap-3">
      <div ref={headerRef}>
        <BuildHeader
          mode={mode}
          row={row}
          authorName={authorName}
          tags={tags}
          shareToken={shareToken}
          checkpoints={checkpoints}
          activeCheckpointId={activeCheckpointId}
        />
      </div>

      <div className="sticky top-20 z-20 bg-background/95 backdrop-blur md:top-0">
        {compact ? (
          <div className="flex min-w-0 items-center justify-between gap-2 py-1">
            <span data-testid="compact-build-name" className="min-w-0 flex-1 truncate font-heading text-sm font-semibold text-foreground">
              {meta.name}
            </span>
            <div className="flex shrink-0 items-center gap-2">
              <CheckpointSwitcher
                shareToken={shareToken}
                checkpoints={checkpoints}
                activeCheckpointId={activeCheckpointId}
                fallbackLevel={row.level}
                align="right"
                compact
                testId="checkpoint-switcher-compact"
              />
              <HeaderActions mode={mode} row={row} shareToken={shareToken} activeCheckpointId={activeCheckpointId} compact />
            </div>
          </div>
        ) : null}
        <BuildTabs active={tab} />
      </div>

      <div className={tab === 'tree' ? '' : 'md:grid md:grid-cols-[minmax(0,1fr)_16rem] md:gap-6'}>
        <div className="min-w-0">
          {tab === 'overview' ? <OverviewTab /> : null}
          {tab === 'gear' ? <GearTab /> : null}
          {tab === 'skills' ? <SkillsTab /> : null}
          {tab === 'tree' ? <TreeTab edit={edit} /> : null}
          {tab === 'stats' ? <StatsTab /> : null}
        </div>
        {tab === 'tree' ? null : <StatsRail sheets={sheets} set={set} reserved={reserved} />}
      </div>
    </div>
  );
}
