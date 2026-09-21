'use client';

// The signed-in user's own builds — presentational only.
//
// All data (the rows, and any load error) comes down as props from the
// Server Component at builds/page.tsx: there is no client-side fetch here,
// and no signed-out branch — an unauthenticated visitor never reaches this
// component, because the page renders the "Sign in to see your saved
// builds" copy itself before ever mounting this list.
//
// Rename and delete now go through the Server Functions in builds/actions.ts
// instead of a direct browser Supabase call. That trades the previous
// instant client-side update for a server round-trip on every mutation —
// accepted deliberately, given the bug history behind this migration.
// `revalidatePath('/builds')` inside each action refreshes the `builds`
// prop; there is no local list state to reconcile and no refetch to call.

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import type { SavedBuild } from '@/lib/build/types';
import type { ActionResult } from '@/app/(dashboard)/builds/actions';

interface MyBuildsListProps {
  builds: SavedBuild[] | null;
  loadError: string | null;
  renameAction: (id: string, name: string) => Promise<ActionResult>;
  deleteAction: (id: string) => Promise<ActionResult>;
}

export default function MyBuildsList({
  builds,
  loadError,
  renameAction,
  deleteAction,
}: MyBuildsListProps) {
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Set true the instant Escape cancels a rename, read at the top of
  // commitRename. Unmounting the focused <Input> (setRenamingId(null)) fires
  // a native blur that React still delivers to onBlur on that fiber, so
  // commitRename runs anyway — this flag is what lets it tell "Escape, then
  // the resulting blur" apart from "the user actually blurred to commit".
  const cancelRenameRef = useRef(false);

  function commitRename(id: string) {
    // Escape already discarded the rename and flagged this — the blur that
    // unmounting the input triggers must not resurrect it as a save.
    if (cancelRenameRef.current) {
      cancelRenameRef.current = false;
      return;
    }
    const name = draftName.trim();
    setRenamingId(null);
    if (!name) return;
    setError(null);
    startTransition(async () => {
      const result = await renameAction(id, name);
      if (!result.ok) setError(result.error);
    });
  }

  function confirmDelete(id: string) {
    setPendingDeleteId(null);
    setError(null);
    startTransition(async () => {
      const result = await deleteAction(id);
      if (!result.ok) setError(result.error);
    });
  }

  // Only bail out to an error-only view when there is genuinely nothing else
  // to show — the initial load itself failed. Once builds is populated, a
  // later failure (a rename or delete hitting a network blip) must not blank
  // out every other build; it renders as a banner above the list instead.
  if (loadError && builds === null) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {loadError}
      </p>
    );
  }

  if (builds === null) {
    return <p className="text-sm text-muted-foreground">Loading your builds…</p>;
  }

  const errorBanner = error ? (
    <p className="text-sm text-destructive" role="alert">
      {error}
    </p>
  ) : null;

  if (builds.length === 0) {
    return (
      <div className="py-10 text-center">
        {errorBanner}
        <p className="text-sm text-muted-foreground">You have not saved a build yet.</p>
        {/* h-11: this is the empty state's only call to action, so it needs a
            real tap target on a phone, not a 20px inline text link. */}
        <Link
          href="/tree"
          className="mt-2 inline-flex h-11 items-center justify-center text-sm underline"
        >
          Plan one on the passive tree
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {errorBanner}
      <ul className="divide-y divide-border rounded-lg border border-border bg-card/40">
        {builds.map((b) => (
          <li key={b.id} className="flex items-center gap-3 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              {renamingId === b.id ? (
                <Input
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={() => commitRename(b.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(b.id);
                    if (e.key === 'Escape') {
                      cancelRenameRef.current = true;
                      setRenamingId(null);
                    }
                  }}
                  className="h-11"
                />
              ) : (
                <Link href={`/tree?build=${b.id}`} className="block truncate font-medium">
                  {b.name}
                </Link>
              )}
              <p className="truncate text-xs text-muted-foreground">
                {b.ascendancy ?? b.class} · Level {b.level} · {b.league}
              </p>
            </div>

            {pendingDeleteId === b.id ? (
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => confirmDelete(b.id)}
                  className="h-11 rounded-lg px-3 text-sm text-destructive"
                >
                  Delete
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setPendingDeleteId(null)}
                  className="h-11 rounded-lg px-3 text-sm text-muted-foreground"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    cancelRenameRef.current = false;
                    setRenamingId(b.id);
                    setDraftName(b.name);
                  }}
                  className="h-11 rounded-lg px-3 text-sm text-muted-foreground"
                >
                  Rename
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setPendingDeleteId(b.id)}
                  className="h-11 rounded-lg px-3 text-sm text-muted-foreground"
                >
                  Delete
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
