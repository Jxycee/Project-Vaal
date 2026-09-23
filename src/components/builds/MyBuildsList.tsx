'use client';

// The signed-in user's own builds — presentational only.
//
// All data (the rows, any load error, and each build's tags) comes down as
// props from the Server Component at builds/page.tsx: there is no client-side
// fetch here, and no signed-out branch — an unauthenticated visitor never
// reaches this component (as of Task 4, /builds itself redirects to /login
// before this ever mounts; see builds/page.tsx).
//
// Rename, delete, visibility and tags all go through the Server Functions in
// builds/actions.ts instead of a direct browser Supabase call. That trades
// the previous instant client-side update for a server round-trip on every
// mutation — accepted deliberately, given the bug history behind this
// migration. `revalidatePath('/builds')` inside each action refreshes the
// `builds`/`tagsByBuildId` props; there is no local list state to reconcile.

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { SavedBuild } from '@/lib/build/types';
import type { ActionResult } from '@/app/(dashboard)/builds/actions';
import { BUILD_VISIBILITIES, VISIBILITY_LABEL } from '@/lib/build/visibility';

interface MyBuildsListProps {
  builds: SavedBuild[] | null;
  loadError: string | null;
  tagsByBuildId: Record<string, string[]>;
  renameAction: (id: string, name: string) => Promise<ActionResult>;
  deleteAction: (id: string) => Promise<ActionResult>;
  setVisibilityAction: (id: string, visibility: string) => Promise<ActionResult>;
  addTagAction: (buildId: string, tag: string) => Promise<ActionResult>;
  removeTagAction: (buildId: string, tag: string) => Promise<ActionResult>;
}

export default function MyBuildsList({
  builds,
  loadError,
  tagsByBuildId,
  renameAction,
  deleteAction,
  setVisibilityAction,
  addTagAction,
  removeTagAction,
}: MyBuildsListProps) {
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [addingTagId, setAddingTagId] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
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

  function handleVisibilityChange(id: string, visibility: string) {
    setError(null);
    startTransition(async () => {
      const result = await setVisibilityAction(id, visibility);
      if (!result.ok) setError(result.error);
    });
  }

  function commitAddTag(buildId: string) {
    const tag = tagDraft.trim();
    setAddingTagId(null);
    setTagDraft('');
    if (!tag) return;
    setError(null);
    startTransition(async () => {
      const result = await addTagAction(buildId, tag);
      if (!result.ok) setError(result.error);
    });
  }

  function handleRemoveTag(buildId: string, tag: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeTagAction(buildId, tag);
      if (!result.ok) setError(result.error);
    });
  }

  async function handleCopyLink(shareToken: string) {
    const url = `${window.location.origin}/builds/${shareToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(shareToken);
      setTimeout(() => setCopiedId((cur) => (cur === shareToken ? null : cur)), 2000);
    } catch {
      setError("Couldn't copy the link — copy it from the address bar instead.");
    }
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
        {builds.map((b) => {
          const tags = tagsByBuildId[b.id] ?? [];
          const linkActive = b.visibility !== 'private' && b.share_token !== null;

          return (
            <li key={b.id} className="flex flex-col gap-2 px-3 py-2.5">
              <div className="flex items-center gap-3">
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
              </div>

              {/* Visibility + share link. */}
              <div className="flex flex-wrap items-center gap-2">
                <Select value={b.visibility} onValueChange={(v) => handleVisibilityChange(b.id, v)}>
                  <SelectTrigger className="h-11 w-[130px] shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUILD_VISIBILITIES.map((v) => (
                      <SelectItem key={v} value={v}>
                        {VISIBILITY_LABEL[v]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {linkActive && b.share_token ? (
                  <>
                    {/* The link itself, not just a copy button — a share link
                        someone wants to read, long-press-select on mobile, or
                        paste manually is a real path, not only a clipboard
                        write. */}
                    <Link
                      href={`/builds/${b.share_token}`}
                      className="flex h-11 min-w-0 flex-1 items-center truncate rounded-lg border border-border px-3 text-xs text-muted-foreground underline"
                    >
                      {`/builds/${b.share_token}`}
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleCopyLink(b.share_token!)}
                      className="flex h-11 shrink-0 items-center rounded-lg border border-border px-3 text-xs text-muted-foreground"
                    >
                      {copiedId === b.share_token ? 'Copied!' : 'Copy'}
                    </button>
                  </>
                ) : null}
              </div>
              {linkActive ? (
                <p className="text-[11px] text-muted-foreground/80">
                  Switching to Private disables the link immediately.
                </p>
              ) : null}

              {/* Tags. */}
              <div className="flex flex-wrap items-center gap-1.5">
                {tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleRemoveTag(b.id, tag)}
                    aria-label={`Remove tag ${tag}`}
                    className="flex h-11 items-center gap-1 rounded-full border border-border bg-card px-3 text-xs text-muted-foreground"
                  >
                    {tag}
                    <X size={12} />
                  </button>
                ))}
                {addingTagId === b.id ? (
                  <Input
                    autoFocus
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onBlur={() => setAddingTagId(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitAddTag(b.id);
                      if (e.key === 'Escape') setAddingTagId(null);
                    }}
                    placeholder="tag name"
                    className="h-11 w-32"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setAddingTagId(b.id);
                      setTagDraft('');
                    }}
                    className="flex h-11 items-center rounded-full border border-dashed border-border px-3 text-xs text-muted-foreground"
                  >
                    + Add tag
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
