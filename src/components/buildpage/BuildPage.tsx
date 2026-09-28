'use client';

// /builds/[shareToken] — the build's page, for its owner and for readers.
// Spec: docs/superpowers/specs/2026-09-27-build-profile-redesign-design.md.
//
// Keyed by checkpoint in the server page, so every hook below belongs to one
// checkpoint for its whole life. The tab lives only in the URL (?tab=, set by
// BuildTabs with pushState), so switching tabs re-renders this component and
// never reaches the server.
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { parseGearState } from '@/lib/build/gearState';
import { parseGemState } from '@/lib/build/gemState';
import { parsePassiveState } from '@/lib/build/passiveState';
import { headlineSet, mainSkillLoadout, parseTab } from '@/lib/build/buildPage';
import type { SharedBuildRow } from '@/lib/build/types';
import { useDefenceSheets } from '@/components/build/useDefenceSheets';
import { useReservedSpirit } from '@/components/build/useReservedSpirit';
import { useTreeExport } from './useTreeExport';
import BuildHeader, { HeaderActions } from './BuildHeader';
import BuildTabs from './BuildTabs';
import CheckpointSwitcher from './CheckpointSwitcher';
import StatsRail from './StatsRail';
import OverviewTab from './tabs/OverviewTab';
import GearTab from './tabs/GearTab';
import SkillsTab from './tabs/SkillsTab';
import TreeTab from './tabs/TreeTab';
import StatsTab from './tabs/StatsTab';
import type { Sheets } from './HeaderStats';

export interface BuildPageProps {
  mode: 'owner' | 'reader';
  row: SharedBuildRow;
  authorName: string;
  tags: string[] | null;
  shareToken: string;
  checkpoints: { id: string; name: string; level: number }[];
  activeCheckpointId: string | undefined;
}

export default function BuildPage(props: BuildPageProps) {
  const { mode, row, shareToken, checkpoints, activeCheckpointId } = props;
  const tab = parseTab(useSearchParams().get('tab'));

  const gear = parseGearState(row.gear_state);
  const gemState = parseGemState(row.gem_state);
  const passiveState = parsePassiveState(row.passive_state);
  const mainSkill = mainSkillLoadout(gemState);
  const set = headlineSet(gemState);

  const { tree, error: treeError } = useTreeExport();
  const defence = useDefenceSheets({ tree, className: row.class, level: row.level, passive: passiveState, gear });
  // useDefenceSheets waits forever for a tree that will never come; surface the fetch error instead.
  const sheets: Sheets = treeError ? { error: treeError } : defence;
  const reserved = useReservedSpirit(gemState);

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
        <BuildHeader {...props} mainSkill={mainSkill} sheets={sheets} set={set} reserved={reserved} />
      </div>

      <div className="sticky top-20 z-20 bg-background/95 backdrop-blur md:top-0">
        {compact ? (
          <div className="flex min-w-0 items-center justify-between gap-2 py-1">
            <span data-testid="compact-build-name" className="min-w-0 flex-1 truncate font-heading text-sm font-semibold text-foreground">
              {row.name}
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
          {tab === 'overview' ? <OverviewTab mainSkill={mainSkill} gear={gear} set={set} notes={row.notes} /> : null}
          {tab === 'gear' ? <GearTab gear={gear} /> : null}
          {tab === 'skills' ? <SkillsTab gemState={gemState} reserved={reserved} sheets={sheets} set={set} /> : null}
          {tab === 'tree' ? (
            <TreeTab tree={tree} error={treeError} className={row.class} ascendancyId={row.ascendancy} passiveState={passiveState} level={row.level} />
          ) : null}
          {tab === 'stats' ? <StatsTab sheets={sheets} reserved={reserved} set={set} /> : null}
        </div>
        {tab === 'tree' ? null : <StatsRail sheets={sheets} set={set} reserved={reserved} />}
      </div>
    </div>
  );
}
