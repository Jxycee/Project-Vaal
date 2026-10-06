'use client';

// /builds/[shareToken] — the build's page, for its owner and for readers.
// Spec: docs/superpowers/specs/2026-09-27-build-profile-redesign-design.md.
//
// Keyed by checkpoint in the server page, so every hook below belongs to one
// checkpoint for its whole life. The tab lives only in the URL (?tab=, set by
// BuildTabs with pushState), so switching tabs re-renders this component and
// never reaches the server. Edit mode lives in the URL too (?edit=1, owner
// only), toggled with history.replaceState (not pushState — entering/leaving
// edit is not something Back should step through) via patchQuery, same
// helper BuildTabs uses.
//
// All build-scoped state (tree, gear, gems, meta, drafts, save) lives one
// level up, in BuildSessionProvider — this component and everything below it
// only ever reads it through useBuildSession(), so an unsaved edit shows up
// everywhere at once without any prop threading of its own.
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { headlineSet, parseTab, patchQuery } from '@/lib/build/buildPage';
import type { SharedBuildRow } from '@/lib/build/types';
import type { BuildCheckpoint } from '@/lib/build/checkpointState';
import { useTreeExport } from './useTreeExport';
import BuildSessionProvider, { useBuildSession } from './session/BuildSession';
import BuildHeader, { HeaderActions } from './BuildHeader';
import BuildTabs from './BuildTabs';
import CheckpointSwitcher, { useCheckpointManage } from './CheckpointSwitcher';
import DraftNotice from './DraftNotice';
import EditBar from './EditBar';
import { enterEdit as enterEditMode } from './tabNav';
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
  /** Owner only: false shows the (i) hint next to "by You". */
  ownerHasUsername?: boolean;
  tags: string[] | null;
  shareToken: string;
  checkpoints: { id: string; name: string; level: number }[];
  activeCheckpointId: string | undefined;
  /** Full checkpoint rows (tree/gear/gems included), owner only — [] for a reader. What the checkpoint switcher's manage view (CheckpointManager, via useCheckpointManage) needs; the lightweight `checkpoints` above is only ever enough for the switch list. */
  fullCheckpoints: BuildCheckpoint[];
}

export default function BuildPage(props: BuildPageProps) {
  const { mode, row, activeCheckpointId } = props;
  const { tree, error: treeError } = useTreeExport();
  // Computed here (not just inside BuildPageBody) because BuildSessionProvider
  // needs it too — drafts are an edit-mode concern, so the provider must know
  // whether the page is in edit mode, not just whether the viewer owns the
  // build (see BuildSession.tsx's `editing` prop doc comment).
  const searchParams = useSearchParams();
  const edit = mode === 'owner' && searchParams.get('edit') === '1';
  return (
    <BuildSessionProvider
      canEdit={mode === 'owner'}
      editing={edit}
      row={row}
      checkpointId={activeCheckpointId}
      tree={tree}
      treeError={treeError}
    >
      <BuildPageBody {...props} />
    </BuildSessionProvider>
  );
}

function setQuery(patch: Record<string, string | null>) {
  const query = patchQuery(window.location.search, patch);
  window.history.replaceState(null, '', `${window.location.pathname}${query}`);
}

function BuildPageBody(props: BuildPageProps) {
  const { mode, row, authorName, ownerHasUsername = true, tags, shareToken, checkpoints, activeCheckpointId, fullCheckpoints } = props;
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get('tab'));
  const edit = mode === 'owner' && searchParams.get('edit') === '1';
  const { gems, sheets, reserved, meta, dirty, save, discard } = useBuildSession();
  const set = headlineSet(gems);
  const manage = useCheckpointManage(edit, row.id, fullCheckpoints);

  // The Done->Discard/Save/Keep-editing choice, shown under the header
  // instead of window.confirm (never allowed here). Rendering is gated on
  // `edit && showChoice`, so it is invisible whenever edit mode is off
  // regardless of this flag's value; enterEdit() below also resets it
  // explicitly (an event handler, not an effect — see react-hooks/set-
  // state-in-effect) so re-entering edit mode never opens on a stale choice
  // left over from a previous session (e.g. a browser Back that skipped
  // Done's own exitEdit reset).
  const [showChoice, setShowChoice] = useState(false);

  function enterEdit() {
    setShowChoice(false);
    enterEditMode();
  }
  function exitEdit() {
    setQuery({ edit: null });
    setShowChoice(false);
  }
  function requestDone() {
    if (!dirty) {
      exitEdit();
      return;
    }
    setShowChoice(true);
  }
  async function handleChoiceSave() {
    const ok = await save();
    if (ok) exitEdit();
  }
  function handleChoiceDiscard() {
    discard();
    exitEdit();
  }

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
          ownerHasUsername={ownerHasUsername}
          tags={tags}
          shareToken={shareToken}
          checkpoints={checkpoints}
          activeCheckpointId={activeCheckpointId}
          fullCheckpoints={fullCheckpoints}
          edit={edit}
          onToggleEdit={enterEdit}
          onRequestDone={requestDone}
        />
      </div>

      <DraftNotice edit={edit} />

      {edit && showChoice ? (
        <div data-testid="unsaved-choice" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card/95 px-3 py-2">
          <p className="text-sm text-foreground">You have unsaved changes.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void handleChoiceSave()} className="h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
              Save
            </button>
            <button type="button" onClick={handleChoiceDiscard} className="h-11 rounded-md border border-border px-4 text-sm font-medium text-muted-foreground">
              Discard
            </button>
            <button type="button" onClick={() => setShowChoice(false)} className="h-11 rounded-md px-4 text-sm text-muted-foreground">
              Keep editing
            </button>
          </div>
        </div>
      ) : null}

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
                manage={manage}
              />
              <HeaderActions
                mode={mode}
                row={row}
                shareToken={shareToken}
                compact
                edit={edit}
                onToggleEdit={enterEdit}
                onRequestDone={requestDone}
              />
            </div>
          </div>
        ) : null}
        <BuildTabs active={tab} />
        {/* Only ever one Save button in the DOM: hidden here while the
            Done->unsaved choice above (which has its own Save) is open. */}
        {edit && !showChoice ? <EditBar /> : null}
      </div>

      <div className={tab === 'tree' ? '' : 'md:grid md:grid-cols-[minmax(0,1fr)_16rem] md:gap-6'}>
        <div className="min-w-0">
          {tab === 'overview' ? (
            <OverviewTab edit={edit} shareToken={shareToken} checkpoints={checkpoints} activeCheckpointId={activeCheckpointId} />
          ) : null}
          {tab === 'gear' ? <GearTab edit={edit} /> : null}
          {/* Keyed by mode: leaving edit mode drops the tab's sheet/detail UI state (it holds nothing else). */}
          {tab === 'skills' ? <SkillsTab key={edit ? 'edit' : 'read'} edit={edit} /> : null}
          {tab === 'tree' ? <TreeTab edit={edit} /> : null}
          {tab === 'stats' ? <StatsTab edit={edit} /> : null}
        </div>
        {tab === 'tree' ? null : <StatsRail sheets={sheets} set={set} reserved={reserved} />}
      </div>
    </div>
  );
}
