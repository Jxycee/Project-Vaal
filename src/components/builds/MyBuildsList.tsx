'use client';

// The signed-in user's own builds. RLS scopes the select to the owner, so
// there is deliberately no user_id filter here — adding one would imply the
// query is what enforces ownership, and it is not.
//
// Rename and delete go direct through the browser client rather than an API
// route: neither touches a server-generated value, so RLS is the whole story.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import type { SavedBuild } from '@/lib/build/types';

export default function MyBuildsList() {
  const [builds, setBuilds] = useState<SavedBuild[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from('builds')
      .select('*')
      .order('updated_at', { ascending: false });
    if (err) setError(err.message);
    else setBuilds((data ?? []) as unknown as SavedBuild[]);
  }, []);

  // Inlined rather than calling `load()` from the effect body: eslint's
  // react-hooks/set-state-in-effect rule traces a direct call to a
  // useCallback-defined async helper and flags the setState inside it, even
  // though it only runs after the await. Chaining `.then()` on the query
  // directly (as the tree page's build-load effect and WikiBrowse's index
  // fetch already do) keeps the setState calls inside a plain promise
  // callback, which the rule does not flag.
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from('builds')
      .select('*')
      .order('updated_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError(err.message);
        else setBuilds((data ?? []) as unknown as SavedBuild[]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function commitRename(id: string) {
    const name = draftName.trim();
    setRenamingId(null);
    if (!name) return;
    const supabase = createClient();
    const { error: err } = await supabase.from('builds').update({ name }).eq('id', id);
    if (err) setError(err.message);
    else await load();
  }

  async function confirmDelete(id: string) {
    setPendingDeleteId(null);
    const supabase = createClient();
    const { error: err } = await supabase.from('builds').delete().eq('id', id);
    if (err) setError(err.message);
    else await load();
  }

  if (error) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error}
      </p>
    );
  }

  if (builds === null) {
    return <p className="text-sm text-muted-foreground">Loading your builds…</p>;
  }

  if (builds.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-muted-foreground">You have not saved a build yet.</p>
        <Link href="/tree" className="mt-2 inline-block text-sm underline">
          Plan one on the passive tree
        </Link>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card/40">
      {builds.map((b) => (
        <li key={b.id} className="flex items-center gap-3 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            {renamingId === b.id ? (
              <Input
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={() => void commitRename(b.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void commitRename(b.id);
                  if (e.key === 'Escape') setRenamingId(null);
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
                onClick={() => void confirmDelete(b.id)}
                className="h-11 rounded-lg px-3 text-sm text-destructive"
              >
                Delete
              </button>
              <button
                type="button"
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
                onClick={() => {
                  setRenamingId(b.id);
                  setDraftName(b.name);
                }}
                className="h-11 rounded-lg px-3 text-sm text-muted-foreground"
              >
                Rename
              </button>
              <button
                type="button"
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
  );
}
