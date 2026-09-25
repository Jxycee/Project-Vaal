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
import { useRouter } from 'next/navigation';
import type { GggTreeJson } from '@poe2-toolkit/tree-core/ggg';
import type PassiveTreeComponent from '@/components/tree/PassiveTree';
import BuildSavePanel from '@/components/tree/BuildSavePanel';
import GearSheet from '@/components/build/GearSheet';
import JewelsChip from '@/components/build/JewelsChip';
import JewelsSheet from '@/components/build/JewelsSheet';
import GemsChip from '@/components/build/GemsChip';
import GemsSheet from '@/components/build/GemsSheet';
import CheckpointsSheet from '@/components/build/CheckpointsSheet';
import type { BuildCheckpoint } from '@/lib/build/checkpointState';
import { fromPassiveState, toPassiveState } from '@/lib/build/passiveState';
import { saveDraft, loadDraft, clearDraft } from '@/lib/build/draft';
import { draftDiffersFrom } from '@/lib/build/draftCompare';
import { emptyGearState, parseGearState } from '@/lib/build/gearState';
import { summarizeJewels } from '@/lib/build/jewelState';
import { offHandOccupiedBy, validateCheckpoint } from '@/lib/build/validate';
import { useCraftData } from '@/components/build/useCraftData';
import {
  addLoadout,
  addSupport,
  deriveMainSkill,
  emptyGemState,
  parseGemState,
  removeLoadout,
  removeSupport,
  setLevel as setGemLevel,
  setPrimary,
  setQuality as setGemQuality,
  setSets,
  setSkill,
} from '@/lib/build/gemState';
import { fetchMaxGemLevel } from '@/lib/wiki/fetchGemScaling';
import type { GearItem, GearSlot } from '@/lib/build/gearSlots';
import type { WeaponSet } from '@poe2-toolkit/tree-core';
import type { BuildEditorState, PassiveTreeInitialState, SavedBuild } from '@/lib/build/types';

type PassiveTreeProps = ComponentProps<typeof PassiveTreeComponent>;

export default function TreeBuildSession({
  raw,
  buildId,
  build,
  checkpointId,
  checkpoints,
  loadError,
  PassiveTree,
}: {
  raw: GggTreeJson;
  buildId?: string;
  /**
   * The build as the ACTIVE checkpoint sees it — TreeEditor substitutes that
   * checkpoint's tree, gear, gems and level — so everything below seeds from
   * the checkpoint being edited without knowing checkpoints exist.
   */
  build: SavedBuild | null;
  /** The checkpoint being edited. Undefined in scratch mode and if checkpoints failed to load. */
  checkpointId?: string;
  checkpoints: BuildCheckpoint[];
  loadError: string | null;
  PassiveTree: ComponentType<PassiveTreeProps>;
}) {
  const router = useRouter();
  // The page does not normalize the tree export. It passes the class name
  // straight through; PassiveTree resolves it.
  //
  // Reads `build`, not some staleness-checked derivative of it, because this
  // component is keyed by buildId (in TreeEditor): `build` can never belong
  // to a different build than the one this instance was mounted for. The old
  // `activeBuild` guard existed to defend against a component that survived
  // soft navigation; deleting the guard is safe specifically BECAUSE of the
  // key, not despite it.
  // ---- Level ---------------------------------------------------------
  // Lifted out of BuildSavePanel (which used to own it as purely-local form
  // state) because the tree's passive-point budget now derives from it (see
  // TreeControls / derivePassiveBudget) — PassiveTree needs to read the same
  // value BuildSavePanel is editing, live, not just at submit time. Same
  // lazy-seeded-once reasoning as gearState/gemState above: this component
  // remounts per build, so `build` can't change out from under it.
  const [level, setLevel] = useState(() => build?.level ?? 1);

  const initialState = useMemo<PassiveTreeInitialState | undefined>(() => {
    if (!build) return undefined;
    const { main, ascendancyNodes, attributeChoices } = fromPassiveState(build.passive_state);
    return {
      className: build.class,
      ascendancyId: build.ascendancy ?? undefined,
      main,
      ascendancyNodes,
      attributeChoices,
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
  const [storedDraft] = useState(() => loadDraft(buildId, checkpointId));
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
      attributeChoices: restoredDraft.attributeChoices,
    };
  }, [restoredDraft, initialState]);

  // handleRestoreDraft/handleDiscardDraft are defined further down, once
  // gearState/gemState's setters exist too — restoring a draft re-seeds all
  // three (tree, gear, gems), not just the tree.

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

  // ---- Structural validation (Slice 3) --------------------------------------
  // Derived on every change, never stored: see src/lib/build/validate. Until
  // PassiveTree reports its seeded state, the stored tree stands in, so a
  // keystone that excuses an off-hand does not flash a false warning.
  const livePassive = useMemo(
    () =>
      editorState
        ? toPassiveState(editorState.main, editorState.ascendancyNodes, editorState.attributeChoices)
        : (build?.passive_state ?? { set1: [], set2: [], ascendancyNodes: [] }),
    [editorState, build],
  );
  // Slice 4: craft checks read mod/base/rune data, loaded lazily per slug.
  const craftData = useCraftData(gearState);
  const buildWarnings = useMemo(
    () => validateCheckpoint({ passive: livePassive, gear: gearState, craftData }),
    [livePassive, gearState, craftData],
  );
  const offHandOccupied = useMemo(
    () => ({ 1: offHandOccupiedBy(gearState, livePassive, 1), 2: offHandOccupiedBy(gearState, livePassive, 2) }),
    [gearState, livePassive],
  );

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

  // ---- Gems -------------------------------------------------------------
  // Lazily seeded from `build.gem_state` (validated — see gemState.ts's
  // header), same one-shot-per-mount reasoning as gear/jewels above: this
  // component remounts on every build switch (keyed by buildId in
  // TreeEditor).
  const [gemState, setGemState] = useState(() => (build ? parseGemState(build.gem_state) : emptyGemState()));
  const [gemsSheetOpen, setGemsSheetOpen] = useState(false);
  const [checkpointsSheetOpen, setCheckpointsSheetOpen] = useState(false);

  // Every decision (the support cap, set normalisation, primary clearing) is
  // inside gemState.ts's pure reducers, unit-tested there — these handlers
  // only route events.
  const handleAddLoadout = useCallback(() => setGemState((prev) => addLoadout(prev)), []);
  const handleRemoveLoadout = useCallback((id: string) => setGemState((prev) => removeLoadout(prev, id)), []);
  const handleSetSkill = useCallback((id: string, item: GearItem | null) => {
    setGemState((prev) => setSkill(prev, id, item));
    if (!item) return;
    // GemsSheet clamps the level only on a manual edit, so a swap to a gem
    // with a lower cap (a level-40 active replaced by a Spirit gem capped at
    // 8) would keep, and save, the old level. Clamp once the new gem's cap is
    // known. Done here, on the swap itself, not as an effect on the card:
    // fetchMaxGemLevel answers 1 when the data is unavailable (see its doc
    // comment), and an effect would apply that to every existing loadout the
    // moment the sheet opened on a bad connection.
    void fetchMaxGemLevel(item.slug).then((max) =>
      setGemState((prev) => {
        const loadout = prev.loadouts.find((l) => l.id === id);
        // Only if this skill is still the one in the slot.
        return loadout && loadout.skill?.slug === item.slug && loadout.level > max
          ? setGemLevel(prev, id, max)
          : prev;
      }),
    );
  }, []);
  const handleAddSupport = useCallback(
    (id: string, item: GearItem) => setGemState((prev) => addSupport(prev, id, item)),
    [],
  );
  const handleRemoveSupport = useCallback(
    (id: string, supportIndex: number) => setGemState((prev) => removeSupport(prev, id, supportIndex)),
    [],
  );
  const handleSetSets = useCallback(
    (id: string, sets: readonly WeaponSet[]) => setGemState((prev) => setSets(prev, id, sets)),
    [],
  );
  const handleSetPrimary = useCallback((id: string) => setGemState((prev) => setPrimary(prev, id)), []);
  const handleSetGemLevel = useCallback(
    (id: string, level: number) => setGemState((prev) => setGemLevel(prev, id, level)),
    [],
  );
  const handleSetGemQuality = useCallback(
    (id: string, quality: number) => setGemState((prev) => setGemQuality(prev, id, quality)),
    [],
  );

  // ---- Draft restore, continued ----------------------------------------
  // Deferred to here (rather than living beside the other draft-restore
  // state above) because restoring re-seeds all three pieces of the
  // session, and gearState/gemState's setters don't exist until now.
  const handleRestoreDraft = useCallback(() => {
    if (!storedDraft) return;
    setRestoredDraft(storedDraft.tree);
    // Gear/gems aren't read by PassiveTree, so they don't need the
    // seedKey-bump/remount trick `restoredDraft` uses — a plain setState
    // here (triggered by this click handler, not an effect) is enough to
    // re-seed them.
    setGearState(storedDraft.gear);
    setGemState(storedDraft.gem);
    setSeedKey((k) => k + 1);
    setDraftPromptOpen(false);
  }, [storedDraft]);

  const handleDiscardDraft = useCallback(() => {
    clearDraft(buildId, checkpointId);
    setDraftPromptOpen(false);
  }, [buildId, checkpointId]);

  // Writes to localStorage only, never calls a setState — so this does not
  // trip react-hooks/set-state-in-effect the way updating component state
  // here would. Depends on gearState/gemState too (not just editorState), or
  // a gear/gem-only edit would never mark the session dirty and that work
  // would vanish silently on refresh with no restore prompt at all.
  useEffect(() => {
    if (editorState) saveDraft(buildId, { tree: editorState, gear: gearState, gem: gemState }, checkpointId);
  }, [editorState, gearState, gemState, buildId, checkpointId]);

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
  // The first checkpoint the database made for a scratch-mode build (the
  // create_initial_build_checkpoint trigger), so later saves can name it.
  // Nothing breaks without it — POST /api/builds resolves a save with no
  // checkpoint_id to the build's only checkpoint — but naming it is exact.
  const [createdCheckpointId, setCreatedCheckpointId] = useState<string | undefined>(undefined);

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
    async (meta: { name: string; level: number; league: string; notes: string }) => {
      if (!editorState) return;
      setSaving(true);
      setSaveError(null);
      try {
        const res = await fetch('/api/builds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: build?.id ?? createdBuild?.id,
            // Which checkpoint this tree, gear and gems belong to. Undefined
            // on a first scratch save (the database creates the checkpoint),
            // and JSON.stringify drops it, so the route sees no key at all.
            checkpoint_id: checkpointId ?? createdCheckpointId,
            name: meta.name,
            class: editorState.className,
            ascendancy: editorState.ascendancyId ?? null,
            level: meta.level,
            league: meta.league,
            // Always sent (possibly ''), same reasoning as gear_state below:
            // BuildSavePanel always has notes in memory (seeded from
            // build?.notes on mount), so omitting it here would never be
            // meaningful — POST /api/builds's "only write when the key is
            // present" discipline exists to protect a save path that
            // legitimately doesn't touch notes, which this one isn't.
            notes: meta.notes,
            passive_state: toPassiveState(editorState.main, editorState.ascendancyNodes, editorState.attributeChoices),
            // Sent on every save (not conditionally) now that gear exists —
            // POST /api/builds only writes gear_state when the key is
            // present in the body, precisely so a save that omits it can't
            // wipe existing gear. Since this editor always has gear state in
            // memory (even if every slot is null), always sending it is the
            // correct behaviour, not the dangerous one.
            gear_state: gearState,
            gem_state: gemState,
            // Always sent, string or null. POST /api/builds writes
            // main_skill on update only when the key is present
            // ('main_skill' in body), and JSON.stringify drops an undefined
            // value — so sending `undefined` here would make clearing the
            // main skill impossible. deriveMainSkill returns null, not
            // undefined, for exactly that reason.
            main_skill: deriveMainSkill(gemState),
          }),
        });
        const payload = (await res.json()) as {
          build?: SavedBuild;
          checkpoint?: { id: string } | null;
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
          if (payload.checkpoint?.id) setCreatedCheckpointId(payload.checkpoint.id);
          setSavedAt(new Date().toLocaleTimeString());
          // Only clear the draft once the server has the work.
          clearDraft(buildId, checkpointId);
          // Re-render the server page so the checkpoint list reflects this
          // save (its level, for one). This instance is keyed and seeds
          // lazily, so fresh props cannot reset what is on screen. A Route
          // Handler cannot call next/cache's refresh() — it is Server-Action
          // only — which is why the client does it here.
          router.refresh();
        }
      } catch {
        setSaveError('Could not reach the server. Your work is still here.');
      } finally {
        setSaving(false);
      }
    },
    [editorState, build, createdBuild, createdCheckpointId, buildId, checkpointId, gearState, gemState, router],
  );

  const activeBuildId = build?.id ?? createdBuild?.id;

  return (
    <>
      <PassiveTree
        key={seedKey}
        raw={raw}
        initialState={passiveInitialState}
        onStateChange={setEditorState}
        level={level}
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

        The build-section chip row (Gear, Jewels and Gems) lives here too, as
        a child rather than a sixth independently-positioned overlay — see
        gear-design.md, jewels-design.md and the 2026-09-22 gems plan.
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
          <GemsChip loadouts={gemState.loadouts} onOpen={() => setGemsSheetOpen(true)} />
          {/* TEST-GRADE: a plain entry point to CheckpointsSheet, pending the UI session. */}
          <button
            type="button"
            onClick={() => setCheckpointsSheetOpen(true)}
            className="flex h-11 items-center gap-1.5 rounded-lg border border-border bg-card/90 px-3 text-sm font-medium text-foreground backdrop-blur"
          >
            Checkpoints{checkpoints.length > 0 ? ` ${checkpoints.length}` : ''}
          </button>
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
        initialNotes={build?.notes ?? ''}
        onLevelChange={setLevel}
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
        warnings={buildWarnings}
        occupiedBy={offHandOccupied}
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
      <GemsSheet
        open={gemsSheetOpen}
        gemState={gemState}
        onAddLoadout={handleAddLoadout}
        onRemoveLoadout={handleRemoveLoadout}
        onSetSkill={handleSetSkill}
        onAddSupport={handleAddSupport}
        onRemoveSupport={handleRemoveSupport}
        onSetSets={handleSetSets}
        onSetPrimary={handleSetPrimary}
        onSetLevel={handleSetGemLevel}
        onSetQuality={handleSetGemQuality}
        onClose={() => setGemsSheetOpen(false)}
      />
      <CheckpointsSheet
        open={checkpointsSheetOpen}
        // The saved build, if there is one yet. A scratch session that has
        // saved once has a row (createdBuild) but was not loaded with
        // ?build=, so it has no checkpoint list — the sheet links to the
        // build instead of pretending the list is empty.
        buildId={build?.id ?? createdBuild?.id}
        loadedWithBuild={Boolean(build)}
        checkpoints={checkpoints}
        activeId={checkpointId}
        currentLevel={level}
        currentState={
          editorState
            ? {
                passive_state: toPassiveState(editorState.main, editorState.ascendancyNodes, editorState.attributeChoices),
                gear_state: gearState,
                gem_state: gemState,
              }
            : null
        }
        onClose={() => setCheckpointsSheetOpen(false)}
      />
    </>
  );
}
