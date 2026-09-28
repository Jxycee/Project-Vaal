'use client';

// src/components/buildpage/session/BuildSession.tsx
//
// The build-page analogue of TreeBuildSession (src/components/tree/
// TreeBuildSession.tsx): owns everything derived from one build+checkpoint —
// the live editor state, the draft-to-localStorage safety net (and its
// restore prompt), and the save call — behind a context instead of rendering
// the editor UI itself. BuildPage.tsx renders this provider keyed by
// checkpoint (a later task), so React unmounts and remounts the whole
// subtree on every checkpoint switch. That is what makes the lazy
// one-shot-per-mount seeding below correct: there is no checkpoint-derived
// state here that can outlive the checkpoint it belongs to, and no stale-
// props problem for it to guard against (see TreeBuildSession's header
// comment for the fuller version of this argument — the same reasoning
// applies verbatim, just at the checkpoint granularity instead of buildId).
//
// This file is state-and-derivation only. It renders no UI of its own
// (no PassiveTree, no sheets) — those are wired up by consumers of
// `useBuildSession()` in later tasks.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import type { GggTreeJson } from '@poe2-toolkit/tree-core/ggg';
import type { WeaponSet } from '@poe2-toolkit/tree-core';
import type { BuildEditorState, PassiveState, SharedBuildRow } from '@/lib/build/types';
import { fromPassiveState, toPassiveState, parsePassiveState } from '@/lib/build/passiveState';
import { saveDraft, loadDraft, clearDraft, type BuildDraftState } from '@/lib/build/draft';
import { draftDiffersFrom } from '@/lib/build/draftCompare';
import { parseGearState, type GearState } from '@/lib/build/gearState';
import { summarizeJewels, type JewelsSummary } from '@/lib/build/jewelState';
import { offHandOccupiedBy, validateCheckpoint } from '@/lib/build/validate';
import { useCraftData } from '@/components/build/useCraftData';
import { useDefenceSheets } from '@/components/build/useDefenceSheets';
import { useReservedSpirit } from '@/components/build/useReservedSpirit';
import {
  addLoadout,
  addSupport,
  deriveMainSkill,
  parseGemState,
  removeLoadout,
  removeSupport,
  setLevel as setGemLevel,
  setPrimary,
  setQuality as setGemQuality,
  setSets,
  setSkill,
  type GemState,
} from '@/lib/build/gemState';
import { fetchMaxGemLevel } from '@/lib/wiki/fetchGemScaling';
import type { GearItem, GearSlot } from '@/lib/build/gearSlots';
import type { Sheets } from '../HeaderStats';
import type { BuildMeta, BuildSessionValue } from './sessionTypes';

/**
 * What was last SAVED (or, on first mount, what the checkpoint already held).
 * Shaped so it can be handed straight to `draftDiffersFrom` as its `build`
 * argument (that function's `Pick<SavedBuild, ...>` parameter) — `gear_state`
 * /`gem_state` there are typed `unknown` (raw jsonb) precisely because
 * `SavedBuild` never trusts them either, so passing the already-parsed
 * `GearState`/`GemState` objects here is not a type mismatch, just a
 * pre-validated `unknown`.
 *
 * LOAD-BEARING ASSUMPTION: `dirty` and `draftPromptOpen` (below) hand this
 * `gear_state`/`gem_state` — already-parsed `GearState`/`GemState` objects,
 * not raw jsonb — to `draftDiffersFrom`, which re-parses whatever it's given
 * via `parseGearState`/`parseGemState`. That is correct ONLY because both
 * parsers are idempotent on their own output (`parseX(parseX(v)) ===
 * parseX(v)`, structurally). If either parser ever stops being idempotent —
 * e.g. a future migration that treats a previously-defaulted field
 * differently from an explicitly-present one — `dirty`/`draftPromptOpen`
 * would start computing wrong values with nothing else to catch it, since
 * this is literally the code deciding whether unsaved work gets flagged.
 * Pinned by the "idempotence" `describe` blocks in
 * `src/lib/build/__tests__/gearState.test.ts` and `gemState.test.ts` — those
 * tests must keep passing for this shortcut to remain safe.
 */
interface Baseline {
  class: string;
  ascendancy: string | null;
  passive_state: PassiveState;
  gear_state: GearState;
  gem_state: GemState;
  meta: BuildMeta;
}

function baselineFromRow(row: SharedBuildRow): Baseline {
  return {
    class: row.class,
    ascendancy: row.ascendancy,
    passive_state: parsePassiveState(row.passive_state),
    gear_state: parseGearState(row.gear_state),
    gem_state: parseGemState(row.gem_state),
    meta: { name: row.name, level: row.level, league: row.league, notes: row.notes ?? '' },
  };
}

const BuildSessionContext = createContext<BuildSessionValue | null>(null);

export function useBuildSession(): BuildSessionValue {
  const ctx = useContext(BuildSessionContext);
  if (!ctx) throw new Error('useBuildSession must be called within a BuildSessionProvider');
  return ctx;
}

export default function BuildSessionProvider({
  canEdit,
  row,
  checkpointId,
  tree,
  treeError,
  children,
}: {
  /** The build's owner. Every write helper below is a no-op for a reader. */
  canEdit: boolean;
  /** The build AS THE ACTIVE CHECKPOINT sees it — the caller substitutes that checkpoint's tree/gear/gems/level before this component ever sees `row`. */
  row: SharedBuildRow;
  checkpointId: string | undefined;
  tree: GggTreeJson | null;
  treeError: string | null;
  children: ReactNode;
}) {
  const router = useRouter();

  // ---- Seed (lazy useState initialisers, once per mount) --------------
  //
  // Safe as a one-shot seed specifically BECAUSE this provider remounts on
  // every checkpoint switch (see the header comment) — there is no later
  // point where `row` changes out from under an already-mounted instance.
  //
  // `classId: -1` is a placeholder. It is safe because nothing reads it
  // except PassiveTree (which seeds by `className`, not `classId`) and
  // draft.ts's `isValidTree` guard (which only checks `typeof classId ===
  // 'number'`). The real classId arrives the moment PassiveTree reports its
  // seeded state upward via `setTreeState`.
  const [treeState, setTreeStateRaw] = useState<BuildEditorState>(() => ({
    classId: -1,
    className: row.class,
    ascendancyId: row.ascendancy ?? undefined,
    ...fromPassiveState(parsePassiveState(row.passive_state)),
  }));
  // Bumped whenever the tree must remount and re-seed from `treeState`
  // rather than from props alone (restoreDraft, discard) — a keyed
  // PassiveTree only reads its initial-state prop as one-shot lazy state, so
  // changing that prop on an already-mounted instance would do nothing.
  const [treeSeedKey, setTreeSeedKey] = useState(0);

  const [gear, setGear] = useState<GearState>(() => parseGearState(row.gear_state));
  const [gems, setGems] = useState<GemState>(() => parseGemState(row.gem_state));
  const [meta, setMetaState] = useState<BuildMeta>(() => ({
    name: row.name,
    level: row.level,
    league: row.league,
    notes: row.notes ?? '',
  }));

  // What a successful save last sent (or, before any save, what the
  // checkpoint already held). Compared against live state for `dirty`, and
  // what `discard()` resets back to.
  const [baseline, setBaseline] = useState<Baseline>(() => baselineFromRow(row));

  // ---- Draft read + prompt --------------------------------------------
  //
  // Read BEFORE any effect runs, in a lazy useState initialiser — see
  // draft.ts's header and TreeBuildSession's `storedDraft`/`draftPromptOpen`
  // comments for why this ordering matters: the draft-write effect below
  // writes the freshly-seeded state straight over whatever draft
  // localStorage held, so this is the one point in the component's life
  // where a previous session's draft still exists untouched.
  //
  // Owner-only: a reader has no edit UI to generate a draft with, and must
  // never write one either (see `setTreeState`/the draft-write effect below).
  const [storedDraft] = useState<BuildDraftState | null>(() => (canEdit ? loadDraft(row.id, checkpointId) : null));
  const [draftPromptOpen, setDraftPromptOpen] = useState(
    () =>
      storedDraft !== null &&
      draftDiffersFrom(storedDraft, {
        class: row.class,
        ascendancy: row.ascendancy,
        passive_state: parsePassiveState(row.passive_state),
        gear_state: row.gear_state,
        gem_state: row.gem_state,
      }),
  );

  // Ignore reports while read-only: a read-only PassiveTree still reports
  // its seeded state on mount (its onStateChange effect), and a reader must
  // never let that drift local state (warnings/jewels/dirty all derive from
  // `treeState`) or reach the draft-write effect below.
  const setTreeState = useCallback(
    (next: BuildEditorState) => {
      if (!canEdit) return;
      setTreeStateRaw(next);
    },
    [canEdit],
  );

  // Same defense-in-depth guard as `setTreeState` above, on every remaining
  // mutator: today the only actual write points (the draft-write effect and
  // `save()`) are independently `canEdit`-gated, so a reader calling one of
  // these would only drift in-memory state with nothing to persist it — but
  // a later task could wire a sheet's `onChange` unconditionally instead of
  // only in edit mode (an easy copy-paste mistake, since `TreeBuildSession`
  // never had a reader case to think about), and this guard is what keeps
  // that mistake a no-op instead of silent drift (review 2026-09-27).
  const setMeta = useCallback(
    (patch: Partial<BuildMeta>) => {
      if (!canEdit) return;
      setMetaState((prev) => ({ ...prev, ...patch }));
    },
    [canEdit],
  );

  // ---- Gear / jewels ----------------------------------------------------
  const setGearSlot = useCallback(
    (slot: GearSlot, item: GearItem | null) => {
      if (!canEdit) return;
      setGear((prev) => ({ ...prev, [slot]: item }));
    },
    [canEdit],
  );

  const pickJewel = useCallback(
    (socketId: string, item: GearItem) => {
      if (!canEdit) return;
      setGear((prev) => ({ ...prev, jewels: { ...prev.jewels, [socketId]: item } }));
    },
    [canEdit],
  );

  // Explicit discard only (a socket row's Clear or an orphan row's Remove) —
  // never a side effect of the tree deallocating a socket. See jewelState.ts's
  // orphan rule: a jewel survives its socket being deallocated until the user
  // explicitly removes it.
  const clearJewel = useCallback(
    (socketId: string) => {
      if (!canEdit) return;
      setGear((prev) => {
        const jewels = { ...prev.jewels };
        delete jewels[socketId];
        return { ...prev, jewels };
      });
    },
    [canEdit],
  );

  // ---- Gems ---------------------------------------------------------------
  // Every decision (support cap, set normalisation, primary clearing) lives
  // in gemState.ts's pure, unit-tested reducers; these handlers only route
  // events, exactly as TreeBuildSession's did.
  const gemAdd = useCallback(() => {
    if (!canEdit) return;
    setGems((prev) => addLoadout(prev));
  }, [canEdit]);
  const gemRemove = useCallback(
    (id: string) => {
      if (!canEdit) return;
      setGems((prev) => removeLoadout(prev, id));
    },
    [canEdit],
  );
  const gemSetSkill = useCallback(
    (id: string, item: GearItem | null) => {
      if (!canEdit) return;
      setGems((prev) => setSkill(prev, id, item));
      if (!item) return;
      // GemsSheet clamps the level only on a manual edit, so a swap to a gem
      // with a lower cap (e.g. a level-40 active replaced by a Spirit gem
      // capped at 8) would otherwise keep, and save, the old level. Clamp once
      // the new gem's cap is known — ported verbatim from
      // TreeBuildSession.handleSetSkill, including its "only if this skill is
      // still the one in the slot" re-check against a possibly-stale fetch.
      void fetchMaxGemLevel(item.slug).then((max) =>
        setGems((prev) => {
          const loadout = prev.loadouts.find((l) => l.id === id);
          return loadout && loadout.skill?.slug === item.slug && loadout.level > max
            ? setGemLevel(prev, id, max)
            : prev;
        }),
      );
    },
    [canEdit],
  );
  const gemAddSupport = useCallback(
    (id: string, item: GearItem) => {
      if (!canEdit) return;
      setGems((prev) => addSupport(prev, id, item));
    },
    [canEdit],
  );
  const gemRemoveSupport = useCallback(
    (id: string, index: number) => {
      if (!canEdit) return;
      setGems((prev) => removeSupport(prev, id, index));
    },
    [canEdit],
  );
  const gemSetSets = useCallback(
    (id: string, sets: readonly WeaponSet[]) => {
      if (!canEdit) return;
      setGems((prev) => setSets(prev, id, sets));
    },
    [canEdit],
  );
  const gemSetPrimary = useCallback(
    (id: string) => {
      if (!canEdit) return;
      setGems((prev) => setPrimary(prev, id));
    },
    [canEdit],
  );
  const gemSetLevel = useCallback(
    (id: string, level: number) => {
      if (!canEdit) return;
      setGems((prev) => setGemLevel(prev, id, level));
    },
    [canEdit],
  );
  const gemSetQuality = useCallback(
    (id: string, quality: number) => {
      if (!canEdit) return;
      setGems((prev) => setGemQuality(prev, id, quality));
    },
    [canEdit],
  );
  const gemActions = useMemo(
    () => ({
      add: gemAdd,
      remove: gemRemove,
      setSkill: gemSetSkill,
      addSupport: gemAddSupport,
      removeSupport: gemRemoveSupport,
      setSets: gemSetSets,
      setPrimary: gemSetPrimary,
      setLevel: gemSetLevel,
      setQuality: gemSetQuality,
    }),
    [gemAdd, gemRemove, gemSetSkill, gemAddSupport, gemRemoveSupport, gemSetSets, gemSetPrimary, gemSetLevel, gemSetQuality],
  );

  // ---- Draft write (owner only) ----------------------------------------
  //
  // Writes to localStorage only, never a setState — mirrors
  // TreeBuildSession's effect exactly (including the react-hooks/set-state-
  // in-effect reasoning in its comment: this depends on gear/gems too, not
  // just the tree, or a gear/gem-only edit would never mark the session
  // dirty and that work would vanish silently on refresh with no restore
  // prompt at all).
  //
  // Meta is deliberately NOT drafted (see BuildMeta's doc comment in
  // sessionTypes.ts) — the effect's dependency list omits it on purpose.
  //
  // `latestSession` mirrors what the draft now holds, so save() can tell
  // whether anything changed after it sent its snapshot.
  const latestSession = useRef<BuildDraftState | null>(null);
  useEffect(() => {
    if (!canEdit) return;
    const session: BuildDraftState = { tree: treeState, gear, gem: gems };
    latestSession.current = session;
    saveDraft(row.id, session, checkpointId);
  }, [canEdit, treeState, gear, gems, row.id, checkpointId]);

  // ---- Structural validation + derived view models ---------------------
  // Exactly as TreeBuildSession derives them: nothing here is stored.
  const livePassive = useMemo(
    () => toPassiveState(treeState.main, treeState.ascendancyNodes, treeState.attributeChoices),
    [treeState],
  );
  const craftData = useCraftData(gear);
  const warnings = useMemo(
    () => validateCheckpoint({ passive: livePassive, gear, craftData }),
    [livePassive, gear, craftData],
  );
  const offHandOccupied = useMemo<Record<WeaponSet, GearItem | null>>(
    () => ({ 1: offHandOccupiedBy(gear, livePassive, 1), 2: offHandOccupiedBy(gear, livePassive, 2) }),
    [gear, livePassive],
  );
  const jewels = useMemo<JewelsSummary | null>(
    () => (tree ? summarizeJewels(tree, treeState.main.allocated, gear.jewels) : null),
    [tree, treeState.main.allocated, gear.jewels],
  );
  const defence = useDefenceSheets({
    tree,
    className: treeState.className,
    level: meta.level,
    passive: livePassive,
    gear,
  });
  const sheets = useMemo<Sheets>(() => (treeError ? { error: treeError } : defence), [treeError, defence]);
  const reserved = useReservedSpirit(gems);

  // dirty = draftDiffersFrom's tree/gear/gems comparison against baseline,
  // OR a meta field changed. Meta is compared directly (field by field)
  // rather than through draftDiffersFrom, because it is not part of
  // BuildDraftState at all (see the doc comment on BuildMeta).
  const dirty = useMemo(() => {
    const changedBelowMeta = draftDiffersFrom(
      { tree: treeState, gear, gem: gems },
      {
        class: baseline.class,
        ascendancy: baseline.ascendancy,
        passive_state: baseline.passive_state,
        gear_state: baseline.gear_state,
        gem_state: baseline.gem_state,
      },
    );
    if (changedBelowMeta) return true;
    return (
      meta.name !== baseline.meta.name ||
      meta.level !== baseline.meta.level ||
      meta.league !== baseline.meta.league ||
      meta.notes !== baseline.meta.notes
    );
  }, [treeState, gear, gems, meta, baseline]);

  // ---- Save --------------------------------------------------------------
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const save = useCallback(async (): Promise<boolean> => {
    if (!canEdit) return false;
    // What this save carries. Edits made while it is in flight are not in
    // it — see the `latestSession` in-flight check below, ported from
    // TreeBuildSession.handleSave.
    const sent: BuildDraftState = { tree: treeState, gear, gem: gems };
    const sentMeta = meta;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/builds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: row.id,
          checkpoint_id: checkpointId,
          name: sentMeta.name,
          class: sent.tree.className,
          ascendancy: sent.tree.ascendancyId ?? null,
          level: sentMeta.level,
          league: sentMeta.league,
          // Always sent (possibly ''), same reasoning as gear_state/gem_state
          // below — this editor always has these fields in memory, so
          // omitting any of them would never be meaningful, and POST
          // /api/builds's "only write when the key is present" discipline
          // exists to protect a save path that legitimately doesn't touch a
          // field, which this one isn't.
          notes: sentMeta.notes,
          passive_state: toPassiveState(sent.tree.main, sent.tree.ascendancyNodes, sent.tree.attributeChoices),
          gear_state: sent.gear,
          gem_state: sent.gem,
          // Always sent, string or null — deriveMainSkill returns null (not
          // undefined) specifically so JSON.stringify never drops the key,
          // or clearing the main skill would be impossible.
          main_skill: deriveMainSkill(sent.gem),
        }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        setSaveError(payload.error ?? 'Could not save this build.');
        return false;
      }
      setSavedAt(new Date().toLocaleTimeString());
      // Baseline becomes the snapshot that was SENT, not whatever is
      // current by the time the response arrives.
      setBaseline({
        class: sent.tree.className,
        ascendancy: sent.tree.ascendancyId ?? null,
        passive_state: toPassiveState(sent.tree.main, sent.tree.ascendancyNodes, sent.tree.attributeChoices),
        gear_state: sent.gear,
        gem_state: sent.gem,
        meta: sentMeta,
      });
      // Only clear the draft once the server has the work, and only if the
      // work did not move on while the save was in flight — otherwise the
      // draft holds edits the server never received, and clearing it loses
      // them on the next reload (TreeBuildSession.handleSave, review
      // 2026-09-26).
      const now = latestSession.current;
      if (!now || (now.tree === sent.tree && now.gear === sent.gear && now.gem === sent.gem)) {
        clearDraft(row.id, checkpointId);
      }
      // Re-render the server page so the checkpoint list (and its levels)
      // reflect this save. A Route Handler cannot call next/cache's
      // refresh() itself — Server-Action only — so the client does it here,
      // same as TreeBuildSession.
      router.refresh();
      return true;
    } catch {
      setSaveError('Could not reach the server. Your work is still here.');
      return false;
    } finally {
      setSaving(false);
    }
  }, [canEdit, treeState, gear, gems, meta, row.id, checkpointId, router]);

  // ---- Discard / draft prompt actions -----------------------------------
  const discard = useCallback(() => {
    if (!canEdit) return;
    setTreeStateRaw((prev) => ({
      // classId is owned by the tree lib, not by this baseline — PassiveTree
      // remounts (treeSeedKey below) and reports the real one again the
      // moment it re-seeds, so reusing whatever was last reported is a safe,
      // purely transient value in between. Same placeholder reasoning as the
      // initial seed above.
      classId: prev.classId,
      className: baseline.class,
      ascendancyId: baseline.ascendancy ?? undefined,
      ...fromPassiveState(baseline.passive_state),
    }));
    setGear(baseline.gear_state);
    setGems(baseline.gem_state);
    setMetaState(baseline.meta);
    clearDraft(row.id, checkpointId);
    setTreeSeedKey((k) => k + 1);
    setDraftPromptOpen(false);
  }, [canEdit, baseline, row.id, checkpointId]);

  const restoreDraft = useCallback(() => {
    if (!canEdit || !storedDraft) return;
    setTreeStateRaw(storedDraft.tree);
    setGear(storedDraft.gear);
    setGems(storedDraft.gem);
    setTreeSeedKey((k) => k + 1);
    setDraftPromptOpen(false);
  }, [canEdit, storedDraft]);

  const dismissDraft = useCallback(() => {
    if (!canEdit) return;
    clearDraft(row.id, checkpointId);
    setDraftPromptOpen(false);
  }, [canEdit, row.id, checkpointId]);

  const value = useMemo<BuildSessionValue>(
    () => ({
      canEdit,
      tree,
      treeError,
      treeState,
      treeSeedKey,
      livePassive,
      gear,
      gems,
      meta,
      warnings,
      offHandOccupied,
      jewels,
      sheets,
      reserved,
      dirty,
      saving,
      saveError,
      savedAt,
      draftPromptOpen,
      setTreeState,
      setMeta,
      setGearSlot,
      pickJewel,
      clearJewel,
      gemActions,
      save,
      discard,
      restoreDraft,
      dismissDraft,
    }),
    [
      canEdit,
      tree,
      treeError,
      treeState,
      treeSeedKey,
      livePassive,
      gear,
      gems,
      meta,
      warnings,
      offHandOccupied,
      jewels,
      sheets,
      reserved,
      dirty,
      saving,
      saveError,
      savedAt,
      draftPromptOpen,
      setTreeState,
      setMeta,
      setGearSlot,
      pickJewel,
      clearJewel,
      gemActions,
      save,
      discard,
      restoreDraft,
      dismissDraft,
    ],
  );

  return <BuildSessionContext.Provider value={value}>{children}</BuildSessionContext.Provider>;
}
