'use client';

// /tree — build-SCOPED session.
//
// Rendered by TreeEditor with `key={buildId ?? 'scratch'}` (see that file).
// Owns everything that is derived from a specific build: the live editor
// state PassiveTree reports upward, the draft-to-localStorage safety net (and
// its restore prompt), and the save call. Because the key changes whenever
// buildId changes, React unmounts and remounts this entire subtree on every
// build switch — there is no build-derived state left that can outlive the
// build it belongs to. That is what makes the old two-slice (`build` /
// `scratchBuild`) stale-state defence unnecessary: it existed only because
// the previous version of this component survived soft navigation and had
// to detect staleness itself.
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type ComponentType,
} from 'react';
import type { GggTreeJson } from '@poe2-toolkit/tree-core/ggg';
import type PassiveTreeComponent from '@/components/tree/PassiveTree';
import BuildSavePanel from '@/components/tree/BuildSavePanel';
import GearSheet from '@/components/build/GearSheet';
import JewelsChip from '@/components/build/JewelsChip';
import JewelsSheet from '@/components/build/JewelsSheet';
import { fromPassiveState, toPassiveState } from '@/lib/build/passiveState';
import { saveDraft, loadDraft, clearDraft } from '@/lib/build/draft';
import { draftDiffersFrom } from '@/lib/build/draftCompare';
import { emptyGearState, parseGearState } from '@/lib/build/gearState';
import { summarizeJewels } from '@/lib/build/jewelState';
import type { GearItem, GearSlot } from '@/lib/build/gearSlots';
import type { BuildEditorState, PassiveTreeInitialState, SavedBuild } from '@/lib/build/types';

type PassiveTreeProps = ComponentProps<typeof PassiveTreeComponent>;

export default function TreeBuildSession({
  raw,
  buildId,
  build,
  loadError,
  PassiveTree,
}: {
  raw: GggTreeJson;
  buildId?: string;
  build: SavedBuild | null;
  loadError: string | null;
  PassiveTree: ComponentType<PassiveTreeProps>;
}) {
  // The page does not normalize the tree export. It passes the class name
  // straight through; PassiveTree resolves it.
  //
  // Reads `build`, not some staleness-checked derivative of it, because this
  // component is keyed by buildId (in TreeEditor): `build` can never belong
  // to a different build than the one this instance was mounted for. The old
  // `activeBuild` guard existed to defend against a component that survived
  // soft navigation; deleting the guard is safe specifically BECAUSE of the
  // key, not despite it.
  const initialState = useMemo<PassiveTreeInitialState | undefined>(() => {
    if (!build) return undefined;
    const { main, ascendancyNodes } = fromPassiveState(build.passive_state);
    return {
      className: build.class,
      ascendancyId: build.ascendancy ?? undefined,
      main,
      ascendancyNodes,
    };
  }, [build]);

  // ---- Draft restore --------------------------------------------------
  //
  // Read BEFORE any effect runs, in a lazy useState initialiser. PassiveTree
  // reports its seeded state upward on mount (see its onStateChange effect),
  // and the draft-save effect below writes that report straight over
  // whatever draft localStorage held — so anything that reads the draft
  // AFTER mount can only ever find the value it just clobbered. This is the
  // one point in the component's life where the previous session's draft
  // still exists untouched. Keyed remount per build (see TreeEditor) is what
  // makes reading it here, keyed only by buildId, correct.
  const [storedDraft] = useState(() => loadDraft(buildId));
  // Whether the just-read draft is worth prompting about at all — computed
  // once, against the `build` this instance was mounted for, so a build that
  // was reloaded exactly as saved (the common case: the mount report is a
  // pure echo of `initialState`) does not show a bogus prompt.
  const [draftPromptOpen, setDraftPromptOpen] = useState(
    () => storedDraft !== null && draftDiffersFrom(storedDraft, build),
  );
  // Bumped on Restore to force PassiveTree to remount and re-seed from the
  // draft rather than from `initialState`. PassiveTree only reads its
  // `initialState` prop as one-shot lazy state, so re-seeding an already
  // -mounted instance by changing props alone would do nothing.
  const [seedKey, setSeedKey] = useState(0);
  const [restoredDraft, setRestoredDraft] = useState<BuildEditorState | null>(null);

  const passiveInitialState = useMemo<PassiveTreeInitialState | undefined>(() => {
    if (!restoredDraft) return initialState;
    return {
      className: restoredDraft.className,
      ascendancyId: restoredDraft.ascendancyId,
      main: restoredDraft.main,
      ascendancyNodes: restoredDraft.ascendancyNodes,
    };
  }, [restoredDraft, initialState]);

  const handleRestoreDraft = useCallback(() => {
    if (!storedDraft) return;
    setRestoredDraft(storedDraft);
    setSeedKey((k) => k + 1);
    setDraftPromptOpen(false);
  }, [storedDraft]);

  const handleDiscardDraft = useCallback(() => {
    clearDraft(buildId);
    setDraftPromptOpen(false);
  }, [buildId]);

  // ---- Live editor state + draft persistence ------------------------------
  const [editorState, setEditorState] = useState<BuildEditorState | null>(null);

  // ---- Gear ---------------------------------------------------------------
  // Lazily seeded from `build.gear_state` (validated — see gearState.ts's
  // header), same one-shot-per-mount reasoning as `initialState` above: this
  // component remounts on every build switch (keyed by buildId in
  // TreeEditor), so there is no later point where `build` can change out
  // from under an already-mounted instance.
  const [gearState, setGearState] = useState(() => (build ? parseGearState(build.gear_state) : emptyGearState()));
  const [gearSheetOpen, setGearSheetOpen] = useState(false);

  const handleGearChange = useCallback((slot: GearSlot, item: GearItem | null) => {
    setGearState((prev) => ({ ...prev, [slot]: item }));
  }, []);

  // ---- Jewels ---------------------------------------------------------
  // Sockets are derived, not stored: `raw.jewelSlots` intersected with
  // whatever PassiveTree currently reports as allocated (`editorState`),
  // resolved/normalised by summarizeJewels — see jewelSockets.ts and
  // jewelState.ts. `gearState.jewels` (part of the same lazily-seeded state
  // above) is the only thing actually persisted; this is a pure read of it
  // against the live allocation, recomputed on every relevant change rather
  // than kept as its own state — nothing here is a side effect, so there is
  // no react-hooks/set-state-in-effect concern.
  const [jewelsSheetOpen, setJewelsSheetOpen] = useState(false);

  const jewelsSummary = useMemo(
    () => summarizeJewels(raw, editorState?.main.allocated ?? [], gearState.jewels),
    [raw, editorState, gearState.jewels],
  );

  const handleJewelPick = useCallback((socketId: string, item: GearItem) => {
    setGearState((prev) => ({ ...prev, jewels: { ...prev.jewels, [socketId]: item } }));
  }, []);

  // Explicit discard only — a socket row's Clear or an orphan row's Remove.
  // Never called as a side effect of the tree deallocating a socket (the
  // orphan rule): that path only ever changes `editorState.main.allocated`,
  // which this function has no connection to.
  const handleJewelClear = useCallback((socketId: string) => {
    setGearState((prev) => {
      const jewels = { ...prev.jewels };
      delete jewels[socketId];
      return { ...prev, jewels };
    });
  }, []);

  // Writes to localStorage only, never calls a setState — so this does not
  // trip react-hooks/set-state-in-effect the way updating component state
  // here would.
  useEffect(() => {
    if (editorState) saveDraft(buildId, editorState);
  }, [editorState, buildId]);

  // ---- Save ------------------------------------------------------------
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  // Holds the row a SCRATCH-mode save creates, so a second tap updates it
  // rather than inserting a duplicate. This is local state where the old
  // `scratchBuild` slice was not, because this component remounts (new key)
  // the instant buildId changes — there is no soft navigation for this
  // state to go stale across. It never needs reconciling against a `build`
  // prop the way `scratchBuild` did, because in scratch mode `build` is
  // always null for the lifetime of this instance.
  const [createdBuild, setCreatedBuild] = useState<SavedBuild | null>(null);

  // A ?build= load error, unless it has gone stale or been dismissed.
  //
  // It goes stale the moment a scratch save succeeds: the user's work now
  // lives in a real row, so still saying "That build could not be found." is
  // actively misleading. The pre-migration version cleared this by calling
  // setLoadError(null) on save success; loadError is a server prop now, so
  // this is derived instead — mirroring a prop into state and clearing it in
  // an effect is what react-hooks/set-state-in-effect rejects here.
  const [loadErrorDismissed, setLoadErrorDismissed] = useState(false);
  const visibleLoadError = createdBuild || loadErrorDismissed ? null : loadError;

  const handleSave = useCallback(
    async (meta: { name: string; level: number; league: string }) => {
      if (!editorState) return;
      setSaving(true);
      setSaveError(null);
      try {
        const res = await fetch('/api/builds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: build?.id ?? createdBuild?.id,
            name: meta.name,
            class: editorState.className,
            ascendancy: editorState.ascendancyId ?? null,
            level: meta.level,
            league: meta.league,
            passive_state: toPassiveState(editorState.main, editorState.ascendancyNodes),
            // Sent on every save (not conditionally) now that gear exists —
            // POST /api/builds only writes gear_state when the key is
            // present in the body, precisely so a save that omits it can't
            // wipe existing gear. Since this editor always has gear state in
            // memory (even if every slot is null), always sending it is the
            // correct behaviour, not the dangerous one.
            gear_state: gearState,
          }),
        });
        const payload = (await res.json()) as {
          build?: SavedBuild;
          error?: string;
        };
        if (!res.ok) {
          setSaveError(payload.error ?? 'Could not save this build.');
          return;
        }
        if (payload.build) {
          // `build` (the prop) never changes for the life of this keyed
          // instance, so only scratch mode needs to remember the new row.
          if (!build) setCreatedBuild(payload.build);
          setSavedAt(new Date().toLocaleTimeString());
          // Only clear the draft once the server has the work.
          clearDraft(buildId);
        }
      } catch {
        setSaveError('Could not reach the server. Your work is still here.');
      } finally {
        setSaving(false);
      }
    },
    [editorState, build, createdBuild, buildId, gearState],
  );

  const activeBuildId = build?.id ?? createdBuild?.id;

  return (
    <>
      <PassiveTree
        key={seedKey}
        raw={raw}
        initialState={passiveInitialState}
        onStateChange={setEditorState}
      />
      {/*
        Notices stack below the top row rather than sitting at either top
        corner or the full-width bottom strip, so they never overlap
        TreeControls (left-3 top-3), BuildSavePanel (right-3 top-3) or
        NodeInfoPanel (inset-x-3 bottom-3). At 375px the two top chips are
        ~2.75rem tall including their top-3 offset; top-16 (4rem) clears that.

        A single flex column, because the load error and the draft prompt can
        both be showing at once — absolutely positioning them independently is
        how they would end up on top of each other.

        pointer-events-none on the container, auto on each child: the empty
        column below a short notice must not swallow drags meant for the
        canvas, which on a phone is most of the interface.

        The build-section chip row (Gear and Jewels; a later task adds Gems)
        lives here too, as a child rather than a sixth independently-
        positioned overlay — see gear-design.md and jewels-design.md.
        `self-start` keeps the row's footprint to its own content width so
        the empty rest of this full-width strip stays pointer-events-none for
        canvas drags. `flex-wrap` on the row itself lets the Jewels chip (its
        width varies with how many sockets are allocated) drop to a second
        line instead of overflowing the 375px viewport horizontally, which
        e2e/mobile-layout.spec.ts's "no horizontal page scroll" check would
        fail on.
      */}
      <div className="pointer-events-none absolute inset-x-3 top-16 z-10 flex flex-col gap-2">
        <div className="pointer-events-auto flex flex-wrap self-start gap-2">
          <button
            type="button"
            onClick={() => setGearSheetOpen(true)}
            className="flex h-11 items-center gap-1.5 rounded-lg border border-border bg-card/90 px-3 text-sm font-medium text-foreground backdrop-blur"
          >
            Gear
          </button>
          <JewelsChip summary={jewelsSummary} onOpen={() => setJewelsSheetOpen(true)} />
        </div>
        {visibleLoadError ? (
          <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-card/95 px-3 py-2 backdrop-blur">
            <p className="text-sm text-destructive" role="alert">
              {visibleLoadError}
            </p>
            <button
              type="button"
              onClick={() => setLoadErrorDismissed(true)}
              className="h-11 rounded-md px-3 text-sm text-muted-foreground"
            >
              Dismiss
            </button>
          </div>
        ) : null}
        {draftPromptOpen ? (
          <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card/95 px-3 py-2 backdrop-blur">
            <p className="text-sm text-foreground">Unsaved changes from last time.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRestoreDraft}
                className="h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                Restore
              </button>
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="h-11 rounded-md border border-border px-4 text-sm font-medium text-muted-foreground"
              >
                Discard
              </button>
            </div>
          </div>
        ) : null}
      </div>
      <BuildSavePanel
        buildId={activeBuildId}
        initialName={build?.name ?? ''}
        initialLevel={build?.level ?? 1}
        initialLeague={build?.league ?? 'Standard'}
        saving={saving}
        // Only the save's own error. A ?build= load error is surfaced as a
        // canvas notice above instead: BuildSavePanel renders `error` only
        // while it is expanded, and it is collapsed to a chip by default — so
        // routing the load error through here meant a bad ?build= link showed
        // a perfectly normal-looking empty editor with no indication anything
        // had gone wrong. The spec requires an inline notice for that case.
        error={saveError}
        savedAt={savedAt}
        onSave={handleSave}
      />
      <GearSheet
        open={gearSheetOpen}
        gear={gearState}
        onChange={handleGearChange}
        onClose={() => setGearSheetOpen(false)}
      />
      <JewelsSheet
        open={jewelsSheetOpen}
        sockets={jewelsSummary.sockets}
        orphans={jewelsSummary.orphans}
        onPick={handleJewelPick}
        onClear={handleJewelClear}
        onClose={() => setJewelsSheetOpen(false)}
      />
    </>
  );
}
