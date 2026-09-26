'use client';

// Full-screen, single-column, search-first item picker.
//
// Mounted for one slot at a time by GearSheet, and — per the jewels task —
// will be mounted a second way with `slot="jewels"` once that feature lands;
// nothing here is gear-specific beyond the slot prop itself, which
// GET /api/wiki/items already accepts for both cases (see that route's
// `categoriesForParam`). Deliberately NOT a two-pane category-tree-plus-
// results layout — see docs/superpowers/specs/2026-09-20-competitor-build-
// planner-recon.md, "the single most copyable failure mode."
//
// Rendered through a portal into document.body — same reasoning as
// GearSheet.tsx's header comment: /tree's canvas wrapper is `position:
// fixed`, which always creates its own stacking context, so a plain `fixed
// inset-0 z-50` here would be capped below the shell's `sticky z-20` mobile
// header no matter how high the z-index reads. Portaling here directly
// (rather than relying on GearSheet's own portal) keeps this component
// correct if the jewels task — or anything else — ever mounts it somewhere
// that doesn't already portal for it.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import Link from 'next/link';
import { fetchWikiCardSnippet } from '@/lib/wiki/fetchDetail';
import { GEAR_SLOT_LABELS, JEWEL_PSEUDO_SLOT, RUNE_PSEUDO_SLOT, isGearSlot, type GearItem, type GearSlot } from '@/lib/build/gearSlots';
import { GEM_SKILL_PSEUDO_SLOT, GEM_SUPPORT_PSEUDO_SLOT, isGemPseudoSlot, type GemPseudoSlot } from '@/lib/build/gemSlots';
import type { WikiEntryKind, WikiSearchEntry } from '@/lib/wiki/types';

export type ItemPickerSlot = GearSlot | typeof JEWEL_PSEUDO_SLOT | typeof RUNE_PSEUDO_SLOT | GemPseudoSlot;

/** Debounce for the search-as-you-type network call — short enough to feel live, long enough not to fire one request per keystroke. */
const SEARCH_DEBOUNCE_MS = 300;

/** Which wiki index (and therefore which detail-file directory) a slot's picker reads from. Gem pseudo-slots read the SKILL index; everything else reads the ITEM index. */
function pickerKind(slot: ItemPickerSlot): WikiEntryKind {
  return isGemPseudoSlot(slot) ? 'skill' : 'item';
}

function slotLabel(slot: ItemPickerSlot): string {
  if (slot === GEM_SKILL_PSEUDO_SLOT) return 'Skill gem';
  if (slot === GEM_SUPPORT_PSEUDO_SLOT) return 'Support gem';
  if (slot === RUNE_PSEUDO_SLOT) return 'Rune or soul core';
  return isGearSlot(slot) ? GEAR_SLOT_LABELS[slot] : 'Jewel';
}

type LoadState =
  | { status: 'loading' }
  | { status: 'unauthorized' }
  | { status: 'error'; message: string }
  | { status: 'ready'; entries: WikiSearchEntry[]; total: number };

export default function ItemPickerSheet({
  slot,
  open,
  onPick,
  onClose,
}: {
  slot: ItemPickerSlot;
  open: boolean;
  /** Called once an item is chosen — icon already resolved (or `null` on a failed lookup, never blocking the pick). Sheet closes itself right after. */
  onPick: (item: GearItem) => void;
  onClose: () => void;
}) {
  // Starts empty on every mount. The caller (GearSheet) keys this component
  // by slot each time it opens a picker, so switching slots remounts this
  // component and resets `query` for free — no effect needed to clear a
  // stale query left over from the previous slot.
  const [query, setQuery] = useState('');
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  // Sequence guard against out-of-order responses (a slow early request
  // resolving after a faster later one), simpler than an AbortController for
  // a same-origin GET that always returns something usable.
  const requestSeq = useRef(0);
  // Set while an icon lookup for a just-tapped row is in flight, so a second
  // tap on a different row while the first is still resolving can't produce
  // two picks — the row itself shows a "Picking…" state instead of a spinner
  // overlay, keeping the whole list interactive.
  const [pickingSlug, setPickingSlug] = useState<string | null>(null);
  // Bumped by every pick, every close and unmount; see handleRowPick.
  const pickToken = useRef(0);
  useEffect(() => {
    if (!open) pickToken.current += 1;
  }, [open]);
  useEffect(
    () => () => {
      pickToken.current += 1;
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    const seq = ++requestSeq.current;
    const handle = setTimeout(() => {
      const params = new URLSearchParams({ slot, limit: '50' });
      if (query.trim()) params.set('q', query.trim());
      fetch(`/api/wiki/items?${params.toString()}`)
        .then(async (res) => {
          if (seq !== requestSeq.current) return;
          if (res.status === 401) {
            setState({ status: 'unauthorized' });
            return;
          }
          const payload = (await res.json()) as { entries?: WikiSearchEntry[]; total?: number; error?: string };
          // Checked again: a newer search can finish while this body is still parsing.
          if (seq !== requestSeq.current) return;
          if (!res.ok) {
            setState({ status: 'error', message: payload.error ?? 'Failed to search items.' });
            return;
          }
          setState({ status: 'ready', entries: payload.entries ?? [], total: payload.total ?? 0 });
        })
        .catch(() => {
          if (seq !== requestSeq.current) return;
          setState({ status: 'error', message: 'Could not reach the server.' });
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [open, slot, query]);

  // 17 names repeat inside the pickable skill set (Spark, Herald of Ash,
  // Blink, Unleash, …) — item- and ascendancy-granted variants of the same
  // skill. Two identical-looking rows is a worse bug than a long subtitle,
  // and dropping one is worse still (some variants have no canonical
  // sibling), so the slug disambiguates only where it must. Computed for
  // every kind (not just skill) — it's a cheap no-op for gear/jewel lists,
  // which don't have the duplicate-name problem.
  const duplicateNames = useMemo(() => {
    if (state.status !== 'ready') return new Set<string>();
    return new Set(state.entries.map((e) => e.name).filter((n, i, all) => all.indexOf(n) !== i));
  }, [state]);

  // Also gates the SSR pass, where `document` does not exist — moot in
  // practice since `open` starts `false` and only flips true from a client
  // event, but cheap to guard explicitly rather than rely on that.
  if (!open || typeof document === 'undefined') return null;

  const isSkillKind = pickerKind(slot) === 'skill';

  async function handleRowPick(entry: WikiSearchEntry) {
    // The pick lands only if nothing happened while its icon loaded: the
    // picker was not closed or unmounted, and no newer pick was made. Without
    // this a cancelled pick still replaced the slot's item (craft and all) and
    // its stale onClose shut whichever picker was open by then.
    const token = ++pickToken.current;
    setPickingSlug(entry.slug);
    let iconUrl: string | null = null;
    try {
      const snippet = await fetchWikiCardSnippet(pickerKind(slot), entry.slug);
      iconUrl = snippet.iconUrl;
    } catch {
      // A failed icon fetch must never block the pick — store null and
      // render the fallback instead (see gear-design.md's error table).
      iconUrl = null;
    }
    if (token !== pickToken.current) return;
    setPickingSlug(null);
    onPick({
      slug: entry.slug,
      name: entry.name,
      category: entry.category,
      isUnique: entry.isUniqueItem,
      iconUrl,
    });
    onClose();
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card/95 px-3 py-3 backdrop-blur">
        <span className="font-heading text-sm text-foreground">{slotLabel(slot)}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close item picker"
          className="flex h-11 w-11 items-center justify-center text-muted-foreground"
        >
          <X size={18} />
        </button>
      </div>

      <div className="border-b border-border px-3 py-3">
        <input
          type="text"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search items…"
          className="h-11 w-full rounded-lg border border-input bg-background/60 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-3 focus:ring-ring/50"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {state.status === 'loading' ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">Searching…</p>
        ) : state.status === 'unauthorized' ? (
          <div className="px-3 py-6 text-center text-sm">
            <p className="text-destructive">Session expired — please sign in again.</p>
            <Link href="/login" className="mt-2 inline-block text-primary underline">
              Sign in
            </Link>
          </div>
        ) : state.status === 'error' ? (
          <p className="px-3 py-6 text-center text-sm text-destructive" role="alert">
            {state.message}
          </p>
        ) : state.entries.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">No items found.</p>
        ) : (
          <>
            <ul>
              {state.entries.map((entry) => (
                <li key={entry.slug} className="border-b border-border/60">
                  <button
                    type="button"
                    onClick={() => handleRowPick(entry)}
                    disabled={pickingSlug !== null}
                    className="flex h-14 w-full items-center justify-between gap-2 px-3 text-left disabled:opacity-60"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm text-foreground">
                        {entry.name}
                        {entry.isUniqueItem ? (
                          <span className="ml-1.5 text-xs font-medium" style={{ color: 'var(--wiki-unique)' }}>
                            {' '}
                            Unique
                          </span>
                        ) : null}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {isSkillKind
                          ? [entry.tags.slice(0, 3).join(' · '), duplicateNames.has(entry.name) ? entry.slug : null]
                              .filter(Boolean)
                              .join(' — ')
                          : entry.category}
                      </span>
                    </span>
                    {pickingSlug === entry.slug ? (
                      <span className="shrink-0 text-xs text-muted-foreground">Picking…</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
            <p className="px-3 py-3 text-center text-xs text-muted-foreground">
              Showing {state.entries.length} of {state.total}
            </p>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
