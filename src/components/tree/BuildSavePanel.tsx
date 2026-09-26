'use client';

// Save controls for the tree editor, rendered as an absolute overlay inside
// the page's fixed canvas div – the same recipe as TreeControls/NodeInfoPanel.
// Collapsed to a chip by default so it never eats pan/pinch surface on a phone.

import { useState, type FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MAX_BUILD_LABEL_LENGTH, MAX_BUILD_NAME_LENGTH, MAX_NOTES_LENGTH } from '@/lib/build/constants';

export default function BuildSavePanel({
  buildId,
  initialName = '',
  initialLevel = 1,
  initialLeague = 'Standard',
  initialNotes = '',
  saving,
  error,
  savedAt,
  onSave,
  onLevelChange,
  restoredLevel,
}: {
  buildId?: string;
  initialName?: string;
  initialLevel?: number;
  initialLeague?: string;
  initialNotes?: string;
  saving: boolean;
  error: string | null;
  savedAt: string | null;
  onSave: (meta: { name: string; level: number; league: string; notes: string }) => void;
  /**
   * Fired with every well-formed edit to the level field (not debounced,
   * not gated on submit) so the tree's level-derived passive budget (see
   * TreeControls / derivePassiveBudget) stays live while the user types,
   * the same way the rest of this editor is already live. An in-progress
   * edit that doesn't yet parse (empty field, a bare "-") simply doesn't
   * fire — the budget keeps showing the last well-formed value rather than
   * flapping to a default.
   */
  onLevelChange: (level: number) => void;
  /** A level a draft restore brought back; replaces what the field shows. */
  restoredLevel?: number;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [level, setLevel] = useState(String(initialLevel));
  // Adjusted during render on a prop change (React's documented alternative
  // to an effect): a restored draft's level replaces the field's value.
  const [seenRestored, setSeenRestored] = useState(restoredLevel);
  if (restoredLevel !== seenRestored) {
    setSeenRestored(restoredLevel);
    if (restoredLevel !== undefined) setLevel(String(restoredLevel));
  }
  const [league, setLeague] = useState(initialLeague);
  const [notes, setNotes] = useState(initialNotes);

  function handleLevelChange(value: string) {
    setLevel(value);
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) onLevelChange(Math.min(100, Math.max(1, parsed)));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = Number.parseInt(level, 10);
    onSave({
      name: name.trim(),
      level: Number.isFinite(parsed) ? Math.min(100, Math.max(1, parsed)) : 1,
      league: league.trim() || 'Standard',
      notes,
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute right-3 top-3 z-10 flex h-11 items-center gap-2 rounded-lg border border-border bg-card/90 px-3 text-sm font-medium backdrop-blur"
      >
        {buildId ? 'Saved build' : 'Save build'}
      </button>
    );
  }

  return (
    <div className="absolute right-3 top-3 z-10 w-[min(20rem,calc(100vw-1.5rem))] rounded-lg border border-border bg-card/95 p-3 backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">{buildId ? 'Update build' : 'Save build'}</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-muted-foreground"
          aria-label="Close save panel"
        >
          Close
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="build-name">Name</Label>
          <Input
            id="build-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Lightning Spear Deadeye"
            maxLength={MAX_BUILD_NAME_LENGTH}
            disabled={saving}
            className="h-11"
          />
        </div>

        <div className="flex gap-3">
          <div className="flex w-24 flex-col gap-1.5">
            <Label htmlFor="build-level">Level</Label>
            <Input
              id="build-level"
              inputMode="numeric"
              value={level}
              onChange={(e) => handleLevelChange(e.target.value)}
              disabled={saving}
              className="h-11"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="build-league">League</Label>
            <Input
              id="build-league"
              value={league}
              onChange={(e) => setLeague(e.target.value)}
              maxLength={MAX_BUILD_LABEL_LENGTH}
              disabled={saving}
              className="h-11"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="build-notes">Notes</Label>
            <span className="text-xs text-muted-foreground">
              {notes.length}/{MAX_NOTES_LENGTH}
            </span>
          </div>
          {/*
            A plain textarea, not the ui/input Input component (that's a
            single-line <input>). resize-y (not resize/resize-none) lets the
            user grow it for longer reasoning without the canvas swallowing
            drags the way a resize-x or default `resize` (both axes) would —
            this panel's own width is fixed by its container. maxLength is a
            client-side convenience only; the server (POST /api/builds) is
            the real cap, same reasoning as everywhere else user input hits
            this route.
          */}
          <textarea
            id="build-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={MAX_NOTES_LENGTH}
            disabled={saving}
            placeholder="Why this build works, leveling notes, anything a reader would want…"
            rows={4}
            className="w-full resize-y rounded-md border border-input bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-3 focus:ring-ring/50 disabled:opacity-50"
          />
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {savedAt && !error ? (
          <p className="text-sm text-muted-foreground">Saved {savedAt}</p>
        ) : null}

        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving ? 'Saving…' : buildId ? 'Update' : 'Save'}
        </button>
      </form>
    </div>
  );
}
