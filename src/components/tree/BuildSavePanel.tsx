'use client';

// Save controls for the tree editor, rendered as an absolute overlay inside
// the page's fixed canvas div – the same recipe as TreeControls/NodeInfoPanel.
// Collapsed to a chip by default so it never eats pan/pinch surface on a phone.

import { useState, type FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function BuildSavePanel({
  buildId,
  initialName = '',
  initialLevel = 1,
  initialLeague = 'Standard',
  saving,
  error,
  savedAt,
  onSave,
}: {
  buildId?: string;
  initialName?: string;
  initialLevel?: number;
  initialLeague?: string;
  saving: boolean;
  error: string | null;
  savedAt: string | null;
  onSave: (meta: { name: string; level: number; league: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [level, setLevel] = useState(String(initialLevel));
  const [league, setLeague] = useState(initialLeague);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = Number.parseInt(level, 10);
    onSave({
      name: name.trim(),
      level: Number.isFinite(parsed) ? Math.min(100, Math.max(1, parsed)) : 1,
      league: league.trim() || 'Standard',
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
              onChange={(e) => setLevel(e.target.value)}
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
              disabled={saving}
              className="h-11"
            />
          </div>
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
