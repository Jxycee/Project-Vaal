'use client';

// /tree — build-SCOPED session.
//
// Rendered by TreeEditor with `key={buildId ?? 'scratch'}` (see that file).
// Owns everything that is derived from a specific build: the live editor
// state PassiveTree reports upward, the draft-to-localStorage safety net,
// and the save call. Because the key changes whenever buildId changes, React
// unmounts and remounts this entire subtree on every build switch — there is
// no build-derived state left that can outlive the build it belongs to. That
// is what makes the old two-slice (`build` / `scratchBuild`) stale-state
// defence unnecessary: it existed only because the previous version of this
// component survived soft navigation and had to detect staleness itself.
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
import { fromPassiveState, toPassiveState } from '@/lib/build/passiveState';
import { saveDraft, clearDraft } from '@/lib/build/draft';
import type { BuildEditorState, PassiveTreeInitialState, SavedBuild } from '@/lib/build/types';

type PassiveTreeProps = ComponentProps<typeof PassiveTreeComponent>;

export default function TreeBuildSession({
  raw,
  build,
  loadError,
  PassiveTree,
}: {
  raw: GggTreeJson;
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

  // ---- Live editor state + draft persistence ------------------------------
  const [editorState, setEditorState] = useState<BuildEditorState | null>(null);

  // Writes to localStorage only, never calls a setState — so this does not
  // trip react-hooks/set-state-in-effect the way updating component state
  // here would.
  useEffect(() => {
    if (editorState) saveDraft(editorState);
  }, [editorState]);

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
          }),
        });
        const payload = (await res.json()) as { build?: SavedBuild; error?: string };
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
          clearDraft(editorState.classId, editorState.ascendancyId);
        }
      } catch {
        setSaveError('Could not reach the server. Your work is still here.');
      } finally {
        setSaving(false);
      }
    },
    [editorState, build, createdBuild],
  );

  const activeBuildId = build?.id ?? createdBuild?.id;

  return (
    <>
      <PassiveTree raw={raw} initialState={initialState} onStateChange={setEditorState} />
      <BuildSavePanel
        buildId={activeBuildId}
        initialName={build?.name ?? ''}
        initialLevel={build?.level ?? 1}
        initialLeague={build?.league ?? 'Standard'}
        saving={saving}
        error={saveError ?? loadError}
        savedAt={savedAt}
        onSave={handleSave}
      />
    </>
  );
}
