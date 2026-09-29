'use client';

// /tree, "Quick plan" (spec 7.3): the build page shell in edit mode with no
// saved row behind it. Nothing is written until the first Save, which creates
// the build and replaces the URL with its page (BuildSession's scratch mode).
//
// Same tabs, header card, edit bar and draft prompt as BuildPage, minus what
// needs a saved build: no checkpoints, no settings menu, no Copy link, no
// Edit/Done (scratch is always editing). The tab lives in the URL like on the
// build page (BuildTabs pushes ?tab=), so a first save can carry it across.
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { headlineSet, parseTab } from '@/lib/build/buildPage';
import { BUILD_CLASSES } from '@/lib/tree/ascendancyNames';
import { useTreeExport } from './useTreeExport';
import BuildSessionProvider, { useBuildSession, type SessionRow } from './session/BuildSession';
import { ScratchHeader } from './BuildHeader';
import BuildTabs from './BuildTabs';
import DraftNotice from './DraftNotice';
import EditBar from './EditBar';
import StatsRail from './StatsRail';
import OverviewTab from './tabs/OverviewTab';
import GearTab from './tabs/GearTab';
import SkillsTab from './tabs/SkillsTab';
import TreeTab from './tabs/TreeTab';
import StatsTab from './tabs/StatsTab';

// The empty build a scratch session starts from. The class is the one the
// tree editor has always opened on (the first with ascendancies, Witch);
// PassiveTree seeds by class name, so this and its default agree.
const SCRATCH_ROW: SessionRow = {
  name: '',
  class: BUILD_CLASSES[0],
  ascendancy: null,
  level: 1,
  league: 'Standard',
  notes: null,
  passive_state: { set1: [], set2: [], ascendancyNodes: [] },
  gear_state: {},
  gem_state: {},
};

export default function ScratchBuildPage({ notice }: { notice: string | null }) {
  const { tree, error: treeError } = useTreeExport();
  return (
    <BuildSessionProvider canEdit editing scratch row={SCRATCH_ROW} checkpointId={undefined} tree={tree} treeError={treeError}>
      <ScratchBody notice={notice} />
    </BuildSessionProvider>
  );
}

function ScratchBody({ notice }: { notice: string | null }) {
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get('tab'));
  const { gems, sheets, reserved, meta } = useBuildSession();
  const set = headlineSet(gems);
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  // The compact sticky line appears once the full header has scrolled away.
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
      {notice && !noticeDismissed ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-card/95 px-3 py-2">
          <p className="text-sm text-destructive" role="alert">
            {notice}
          </p>
          <button type="button" onClick={() => setNoticeDismissed(true)} className="h-11 rounded-md px-3 text-sm text-muted-foreground">
            Dismiss
          </button>
        </div>
      ) : null}

      <div ref={headerRef}>
        <ScratchHeader />
      </div>

      <DraftNotice edit />

      <div className="sticky top-20 z-20 bg-background/95 backdrop-blur md:top-0">
        {compact ? (
          <div className="flex min-w-0 items-center py-1">
            <span data-testid="compact-build-name" className="min-w-0 flex-1 truncate font-heading text-sm font-semibold text-foreground">
              {meta.name.trim() || 'Untitled build'}
            </span>
          </div>
        ) : null}
        <BuildTabs active={tab} />
        <EditBar />
      </div>

      <div className={tab === 'tree' ? '' : 'md:grid md:grid-cols-[minmax(0,1fr)_16rem] md:gap-6'}>
        <div className="min-w-0">
          {tab === 'overview' ? <OverviewTab edit shareToken="" checkpoints={[]} activeCheckpointId={undefined} /> : null}
          {tab === 'gear' ? <GearTab edit /> : null}
          {tab === 'skills' ? <SkillsTab edit /> : null}
          {tab === 'tree' ? <TreeTab edit /> : null}
          {tab === 'stats' ? <StatsTab /> : null}
        </div>
        {tab === 'tree' ? null : <StatsRail sheets={sheets} set={set} reserved={reserved} />}
      </div>
    </div>
  );
}
