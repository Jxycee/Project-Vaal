'use client';

// The signed-in user's own builds. RLS scopes the select to the owner, so
// there is deliberately no user_id filter here — adding one would imply the
// query is what enforces ownership, and it is not.
//
// Rename and delete go direct through the browser client rather than an API
// route: neither touches a server-generated value, so RLS is the whole story.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import type { SavedBuild } from '@/lib/build/types';

export default function MyBuildsList() {
  // undefined = auth state not yet known (initial check in flight);
  // null = checked and signed out; a User = checked and signed in.
  // /builds is public (see proxy.ts) so, unlike /tree, there is no
  // redirect to fall back on — this component is what decides whether
  // the personal list is safe to render at all.
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [builds, setBuilds] = useState<SavedBuild[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  // Set true the instant Escape cancels a rename, read at the top of
  // commitRename. Unmounting the focused <Input> (setRenamingId(null)) fires
  // a native blur that React still delivers to onBlur on that fiber, so
  // commitRename runs anyway — this flag is what lets it tell "Escape, then
  // the resulting blur" apart from "the user actually blurred to commit".
  const cancelRenameRef = useRef(false);

  const load = useCallback(async () => {
    setError(null);
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
  //
  // getUser() is checked first, and the builds query only fires once a
  // session is confirmed. RLS would happily answer an anonymous query too
  // (via the "public builds" policy), which is exactly the bug this guards
  // against — a signed-out visitor must never see that data rendered under
  // "Your builds", so we don't even fetch it for them.
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: userData }) => {
      if (cancelled) return;
      setUser(userData.user);
      if (!userData.user) return;
      supabase
        .from('builds')
        .select('*')
        .order('updated_at', { ascending: false })
        .then(({ data, error: err }) => {
          if (cancelled) return;
          if (err) setError(err.message);
          else setBuilds((data ?? []) as unknown as SavedBuild[]);
        });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function commitRename(id: string) {
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
    const supabase = createClient();
    const { error: err } = await supabase.from('builds').update({ name }).eq('id', id);
    if (err) setError(err.message);
    else await load();
  }

  async function confirmDelete(id: string) {
    setPendingDeleteId(null);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.from('builds').delete().eq('id', id);
    if (err) setError(err.message);
    else await load();
  }

  if (user === undefined) {
    return <p className="text-sm text-muted-foreground">Loading your builds…</p>;
  }

  if (user === null) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-muted-foreground">Sign in to see your saved builds.</p>
        <Link href="/login" className="mt-2 inline-block text-sm underline">
          Sign in
        </Link>
      </div>
    );
  }

  // Only bail out to an error-only view when there is genuinely nothing else
  // to show — the initial load itself failed. Once builds is populated, a
  // later failure (a rename or delete hitting a network blip) must not blank
  // out every other build; it renders as a banner above the list instead.
  if (error && builds === null) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error}
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
        <Link href="/tree" className="mt-2 inline-block text-sm underline">
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
                  onBlur={() => void commitRename(b.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void commitRename(b.id);
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
