'use client';

// /tree — passive skill tree viewer.
// Adopts @poe2-toolkit: fetches the vendored GGG tree JSON and hands the raw
// export to PassiveTree, which normalises it (tree-core) and renders it
// (tree-react). Account-gated by proxy.ts (PROTECTED_PREFIXES).
//
// Also wires build persistence: loads a build from ?build=<uuid> (RLS-scoped —
// "not found" and "not yours" are deliberately indistinguishable), holds the
// live editor state PassiveTree reports upward, drafts it to localStorage as
// a refresh safety net, and saves it via POST /api/builds.
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import type { GggTreeJson } from '@poe2-toolkit/tree-core/ggg';
import { createClient } from '@/lib/supabase/client';
import { fromPassiveState, toPassiveState } from '@/lib/build/passiveState';
import { saveDraft, clearDraft } from '@/lib/build/draft';
import type { BuildEditorState, PassiveTreeInitialState, SavedBuild } from '@/lib/build/types';
import BuildSavePanel from '@/components/tree/BuildSavePanel';

// Vendored tree export version (see public/data/tree/<version>/SOURCE.md).
const TREE_VERSION = '0.5.2';

// PassiveTree wraps @poe2-toolkit/tree-react (a pixi.js/WebGL renderer for a
// 1500+ node graph) — genuinely heavy and browser-only, so it's deferred to
// a separate chunk (ssr: false) fetched in parallel with the data fetch
// below rather than parsed as part of this page's initial bundle. The
// loading fallback matches the !raw branch below exactly so component-JS
// loading and data loading look identical to the user.
const PassiveTree = dynamic(() => import('@/components/tree/PassiveTree'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Loading passive tree…
    </div>
  ),
});

function TreePageInner() {
  const [raw, setRaw] = useState<GggTreeJson | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/data/tree/${TREE_VERSION}/data.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: GggTreeJson) => {
        if (!cancelled) setRaw(json);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Build load (?build=<uuid>) -----------------------------------------
  const searchParams = useSearchParams();
  const buildId = searchParams.get('build') ?? undefined;

  const [build, setBuild] = useState<SavedBuild | null>(null);
  // Which build id the load effect has actually settled for — compared
  // against the CURRENT buildId (not just "have we ever loaded") so a soft
  // navigation from one build to another is stale-proof by construction:
  // readiness goes false the instant buildId changes, not just on mount.
  const [loadedFor, setLoadedFor] = useState<string | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const ready = !buildId || loadedFor === buildId;
  // The row that actually belongs to the current context. In scratch mode
  // (no ?build=) `build` is whatever the first save created, and updating it
  // is correct. With ?build= present, a row whose id does not match the URL
  // is stale — from a previous build that is still in state because this
  // route component survives soft navigation — and must never be written to.
  const activeBuild = buildId ? (build?.id === buildId ? build : null) : build;

  useEffect(() => {
    if (!buildId) return;
    let cancelled = false;
    const supabase = createClient();
    // Clear any stale error from a previous load before this one resolves —
    // deferred a tick (rather than a synchronous setState at the top of the
    // effect) to satisfy the set-state-in-effect lint rule.
    queueMicrotask(() => {
      if (!cancelled) setLoadError(null);
    });
    supabase
      .from('builds')
      .select('*')
      .eq('id', buildId)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (cancelled) return;
        // RLS means "not ours" and "does not exist" are the same result here.
        if (err) setLoadError(err.message);
        else if (!data) setLoadError('That build could not be found.');
        else setBuild(data as unknown as SavedBuild);
        // Set on every settled outcome — error, no-row, and success alike —
        // so a failed load still releases the gate instead of spinning forever.
        setLoadedFor(buildId);
      });
    return () => {
      cancelled = true;
    };
  }, [buildId]);

  // The page does not normalize the tree export. It passes the class name
  // straight through; PassiveTree resolves it.
  //
  // Reads activeBuild, not build, so it can never seed from a mismatched
  // row: during a soft navigation from build A to build B, `build` can still
  // hold A's row for a render or two after `buildId` has already become B
  // (B's fetch hasn't resolved yet), but activeBuild is already null in that
  // window. Seeding from stale `build` would hand PassiveTree A's allocation
  // under B's key — silently, since PassiveTree consumes initialState as
  // one-shot lazy state and never re-reads it.
  const initialState = useMemo<PassiveTreeInitialState | undefined>(() => {
    if (!activeBuild) return undefined;
    const { main, ascendancyNodes } = fromPassiveState(activeBuild.passive_state);
    return {
      className: activeBuild.class,
      ascendancyId: activeBuild.ascendancy ?? undefined,
      main,
      ascendancyNodes,
    };
  }, [activeBuild]);

  // ---- Live editor state + draft persistence ------------------------------
  const [editorState, setEditorState] = useState<BuildEditorState | null>(null);

  useEffect(() => {
    if (editorState) saveDraft(editorState);
  }, [editorState]);

  // ---- Save ----------------------------------------------------------------
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

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
            id: activeBuild?.id,
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
          setBuild(payload.build);
          setSavedAt(new Date().toLocaleTimeString());
          setLoadError(null);
          // Only clear the draft once the server has the work.
          clearDraft(editorState.classId, editorState.ascendancyId);
        }
      } catch {
        setSaveError('Could not reach the server. Your work is still here.');
      } finally {
        setSaving(false);
      }
    },
    [editorState, activeBuild],
  );

  return (
    // Full-bleed: breaks out of the shell's centred column, filling the area
    // between the mobile top bar / bottom nav (and right of the desktop sidebar).
    // touch-none lets tree-react own touch gestures (pinch/pan) without the
    // browser hijacking them for scroll/zoom.
    <div className="fixed inset-x-0 bottom-16 top-20 touch-none select-none md:bottom-0 md:left-60 md:top-0">
      {error ? (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-destructive">
          Couldn&apos;t load the passive tree ({error}).
        </div>
      ) : !raw ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Loading passive tree…
        </div>
      ) : !ready ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Loading build…
        </div>
      ) : (
        <>
          <PassiveTree
            key={`tree-${buildId ?? 'scratch'}`}
            raw={raw}
            initialState={initialState}
            onStateChange={setEditorState}
          />
          <BuildSavePanel
            key={`panel-${buildId ?? 'scratch'}`}
            buildId={activeBuild?.id}
            initialName={activeBuild?.name ?? ''}
            initialLevel={activeBuild?.level ?? 1}
            initialLeague={activeBuild?.league ?? 'Standard'}
            saving={saving}
            error={saveError ?? loadError}
            savedAt={savedAt}
            onSave={handleSave}
          />
        </>
      )}
    </div>
  );
}

export default function TreePage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-x-0 bottom-16 top-20 flex items-center justify-center text-sm text-muted-foreground md:bottom-0 md:left-60 md:top-0">
          Loading passive tree…
        </div>
      }
    >
      <TreePageInner />
    </Suspense>
  );
}
