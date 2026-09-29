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
import { patchQuery } from '@/lib/build/buildPage';
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

/**
 * What the session needs of a build row. A saved build passes its whole
 * `SharedBuildRow`; the scratch planner has no row at all, so `id` is absent
 * (rather than faked) and the session is told so with `scratch`.
 */
export type SessionRow = Pick<
  SharedBuildRow,
  'name' | 'class' | 'ascendancy' | 'level' | 'league' | 'notes' | 'passive_state' | 'gear_state' | 'gem_state'
> & { id?: string };

function baselineFromRow(row: SessionRow): Baseline {
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
  editing,
  scratch = false,
  row,
  checkpointId,
  tree,
  treeError,
  children,
}: {
  /** The build's owner. Every write helper below is a no-op for a reader. */
  canEdit: boolean;
  /** Whether the page is currently in edit mode (`?edit=1`, owner only). Drafts are an edit-mode concern: they are read/written only while `canEdit && editing` — never in view mode, even for the owner. */
  editing: boolean;
  /** The scratch planner: `row` is a synthesized empty build with no `id`, drafts use the scratch key, and the first `save()` creates the build and replaces the URL with its page (see `save`). */
  scratch?: boolean;
  /** The build AS THE ACTIVE CHECKPOINT sees it — the caller substitutes that checkpoint's tree/gear/gems/level before this component ever sees `row`. */
  row: SessionRow;
  checkpointId: string | undefined;
  tree: GggTreeJson | null;
  treeError: string | null;
  children: ReactNode;
}) {
  const router = useRouter();
  // The build this session's drafts belong to. Undefined for scratch, which
  // is what draftKey() turns into the scratch key.
  const draftBuildId = scratch ? undefined : row.id;

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
  // RULE: drafts are an edit-mode concern. View mode never reads or writes
  // one, even for the owner — only `canEdit && editing` does. Entering edit
  // mode (either by opening the page on `?edit=1`, or by an owner toggling
  // Edit on later via `replaceState`, no remount) reads the draft at most
  // once per mount; after that first read, every tree/gear/gem change writes
  // the draft back out (see the write effect below). A reader, or an owner
  // sitting in view mode, must never touch localStorage at all — that is
  // exactly the bug this rule fixes: reading (and then echo-writing) a
  // draft on a view-mode visit used to silently destroy unsaved work with
  // no restore prompt ever shown, since view mode renders no such prompt.
  //
  // `storedDraft`/`draftPromptOpen` used to be seeded in a lazy useState
  // initialiser, reading localStorage at render time. That broke as soon as
  // this provider started rendering inside BuildPage, which is
  // server-rendered (unlike the old TreeBuildSession, which only ever
  // mounted client-side after a fetch): localStorage doesn't exist on the
  // server, so the server render always produced `null`/`false`, while the
  // client's hydration render produced whatever the real draft was — server
  // and client HTML disagreed and React threw a hydration mismatch whenever
  // a draft existed. Render-time reads of anything outside React's own
  // state (localStorage, `window`, etc.) can never be SSR-safe for this
  // reason: both states now start as `null`/`false` on every render path
  // (server and hydration agree), and the real read happens in an effect
  // below instead.
  //
  // That effect still has to win a race against the draft-write effect
  // further down: the write effect saves the freshly-seeded (echo) state
  // straight over whatever draft localStorage held, so the previous
  // session's draft must be read before that first write. Effects in one
  // component run in declaration order within a commit (child PassiveTree
  // effects may run earlier, but only call `setTreeState`, never touch
  // storage), so declaring this effect above the write effect and gating
  // the write effect on `draftReadDone` (below) is enough — no lazy
  // initialiser required.
  //
  // Owner-only: a reader has no edit UI to generate a draft with, and must
  // never write one either (see `setTreeState`/the draft-write effect below).
  const [storedDraft, setStoredDraft] = useState<BuildDraftState | null>(null);
  const [draftPromptOpen, setDraftPromptOpen] = useState(false);
  // Guards the one-shot read below: readers never read or write a draft, so
  // they start "done" and the effect is a no-op for them. Owners start "not
  // done" and stay that way through any amount of view-mode time in this
  // mount — the read happens the first time `editing` is true, whether that
  // is on initial mount (`?edit=1`) or later (Edit toggled on). Also
  // survives StrictMode's simulated mount/unmount/remount — the ref (unlike
  // state) is preserved across it, so the simulated remount does not re-read.
  const draftReadDone = useRef(!canEdit);
  useEffect(() => {
    if (!canEdit || !editing || draftReadDone.current) return;
    draftReadDone.current = true;
    const d = loadDraft(draftBuildId, checkpointId);
    if (!d) return;
    // Syncing local state from an external system (localStorage) on mount —
    // exactly the case react-hooks/set-state-in-effect exists to allow; see
    // this effect's header comment for why it can't instead be a lazy
    // useState initialiser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStoredDraft(d);
    if (
      draftDiffersFrom(d, {
        class: row.class,
        ascendancy: row.ascendancy,
        passive_state: parsePassiveState(row.passive_state),
        gear_state: row.gear_state,
        gem_state: row.gem_state,
      })
    ) {
      setDraftPromptOpen(true);
    }
    // Deps intentionally just `[editing]`: this must re-run when edit mode
    // turns on later in the same mount (no remount happens for that — see
    // the header comment), but `draftReadDone` still caps it at one real
    // read per mount. `row`/`checkpointId`/`canEdit` are excluded on
    // purpose — the provider is keyed per checkpoint (see the file header
    // comment), so a new checkpoint always gets a fresh mount rather than
    // this effect re-running with new props, and `canEdit` cannot change
    // within one mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

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

  // The name was saved outside save() (settings menu -> renameBuild). The
  // session seeds `meta` once per mount, so a router.refresh() alone would
  // leave the header on the old name; this moves the live value and the saved
  // baseline together, so it is not an unsaved change either.
  const applySavedName = useCallback(
    (name: string) => {
      if (!canEdit) return;
      setMetaState((prev) => ({ ...prev, name }));
      setBaseline((prev) => ({ ...prev, meta: { ...prev.meta, name } }));
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

  // ---- Draft write (owner + edit mode only) -----------------------------
  //
  // Writes to localStorage only, never a setState — mirrors
  // TreeBuildSession's effect exactly (including the react-hooks/set-state-
  // in-effect reasoning in its comment: this depends on gear/gems too, not
  // just the tree, or a gear/gem-only edit would never mark the session
  // dirty and that work would vanish silently on refresh with no restore
  // prompt at all).
  //
  // Gated on `editing` too, not just `canEdit` — see the RULE at the top of
  // the draft read effect above. A view-mode visit (owner or not) must never
  // write a draft: it has no edit UI to generate one, and doing so anyway
  // was the data-loss bug this rule fixes (an owner's read-only visit would
  // echo-write the freshly-seeded, saved state straight over an unsaved
  // draft from an earlier edit-mode session).
  //
  // Meta is deliberately NOT drafted (see BuildMeta's doc comment in
  // sessionTypes.ts) — the effect's dependency list omits it on purpose.
  //
  // `latestSession` mirrors what the draft now holds, so save() can tell
  // whether anything changed after it sent its snapshot.
  const latestSession = useRef<BuildDraftState | null>(null);
  useEffect(() => {
    if (!canEdit || !editing) return;
    // Must not run before the draft read effect above has read whatever
    // localStorage held for the previous session — this effect immediately
    // overwrites it with the freshly-seeded (echo) state.
    if (!draftReadDone.current) return;
    const session: BuildDraftState = { tree: treeState, gear, gem: gems };
    latestSession.current = session;
    saveDraft(draftBuildId, session, checkpointId);
  }, [canEdit, editing, treeState, gear, gems, draftBuildId, checkpointId]);

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

  // metaDirty = a name/level/league/notes field changed, compared directly
  // (field by field) rather than through draftDiffersFrom, because meta is
  // not part of BuildDraftState at all (see the doc comment on BuildMeta).
  // Exposed separately from `dirty` below for the checkpoint switcher's dirty
  // hint (slice 3): meta is not drafted, so a meta-only change needs its own
  // "save first" message, distinct from "changed content stays as a draft".
  const metaDirty = useMemo(
    () =>
      meta.name !== baseline.meta.name ||
      meta.level !== baseline.meta.level ||
      meta.league !== baseline.meta.league ||
      meta.notes !== baseline.meta.notes,
    [meta, baseline],
  );

  // dirty = draftDiffersFrom's tree/gear/gems comparison against baseline, OR metaDirty.
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
    return changedBelowMeta || metaDirty;
  }, [treeState, gear, gems, baseline, metaDirty]);

  // ---- Save --------------------------------------------------------------
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  // Held in refs, not read from `saving`: a double tap fires both calls
  // before React re-renders the disabled button, and in scratch each would
  // POST a build of its own. `scratchCreated` also outlives the request: the
  // build exists from the moment the POST succeeds, so no later call may
  // create another while the router.replace below is still in flight.
  const saveInFlight = useRef(false);
  const scratchCreated = useRef(false);

  const save = useCallback(async (): Promise<boolean> => {
    if (!canEdit) return false;
    if (saveInFlight.current || scratchCreated.current) return false;
    saveInFlight.current = true;
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
          // Both undefined in scratch, so JSON.stringify drops the keys and
          // the route takes its create path (checkpoint_id is invalid there).
          id: scratch ? undefined : row.id,
          checkpoint_id: scratch ? undefined : checkpointId,
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
      const payload = (await res.json()) as { error?: string; build?: { share_token: string | null } };
      if (!res.ok) {
        setSaveError(payload.error ?? 'Could not save this build.');
        return false;
      }
      const createdToken = scratch ? payload.build?.share_token : null;
      if (scratch && !createdToken) {
        // The row was written but cannot be navigated to. Say so instead of
        // leaving the user on a page that looks saved.
        setSaveError('Saved, but the new build could not be opened. Find it in your builds.');
        scratchCreated.current = true;
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
        clearDraft(draftBuildId, checkpointId);
      }
      if (createdToken) {
        // Scratch: the work now lives in a real row, so move to its page
        // (same tab, edit mode). The session stays locked (`scratchCreated`,
        // and `saving` is left set) until the navigation unmounts it.
        scratchCreated.current = true;
        const tab = new URLSearchParams(window.location.search).get('tab');
        router.replace(`/builds/${encodeURIComponent(createdToken)}${patchQuery('', { edit: '1', tab })}`);
        return true;
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
      saveInFlight.current = false;
      if (!scratchCreated.current) setSaving(false);
    }
  }, [canEdit, scratch, treeState, gear, gems, meta, row.id, draftBuildId, checkpointId, router]);

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
    clearDraft(draftBuildId, checkpointId);
    setTreeSeedKey((k) => k + 1);
    setDraftPromptOpen(false);
  }, [canEdit, baseline, draftBuildId, checkpointId]);

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
    clearDraft(draftBuildId, checkpointId);
    setDraftPromptOpen(false);
  }, [canEdit, draftBuildId, checkpointId]);

  const value = useMemo<BuildSessionValue>(
    () => ({
      canEdit,
      scratch,
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
      metaDirty,
      saving,
      saveError,
      savedAt,
      draftPromptOpen,
      setTreeState,
      setMeta,
      applySavedName,
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
      scratch,
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
      metaDirty,
      saving,
      saveError,
      savedAt,
      draftPromptOpen,
      setTreeState,
      setMeta,
      applySavedName,
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
