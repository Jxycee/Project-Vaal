// src/app/api/wiki/items/route.ts
// =============================================================================
// GET /api/wiki/items — server-side gear/jewel/gem picker search.
//
// Filters an index down to one slot's categories and applies the wiki's own
// search ranking, so a phone never downloads the raw index to fill a single
// slot. See docs/superpowers/specs/2026-09-20-gear-design.md, "The one
// substantive change from the original spec" — a filtered response for one
// slot is roughly 5KB, on an interaction users perform many times to fill a
// character.
//
// Also serves the two gem pseudo-slots (`gem_skill`, `gem_support` — see
// docs/superpowers/plans/2026-09-22-task3-gems.md). Gems live in the SKILL
// index, not the item index — a disjoint `category` vocabulary — so the slot
// lookup below resolves to a `{ kind, categories }` pair rather than just
// categories, and `loadIndex(kind)` picks the right on-disk file. The route
// keeps its `/items` name: it's a URL, not a type name, and renaming it for
// three call sites would buy nothing.
//
// `/api/` is NOT in PROTECTED_PREFIXES (src/proxy.ts), but the index files
// this route reads under `/data/wiki/` ARE. Without its own auth check this
// route would be an unauthenticated side door around that gate — same
// reasoning, same fix, as POST /api/builds. That check runs first, below,
// before any slot/kind resolution.
// =============================================================================

import type Fuse from 'fuse.js';
import { NextRequest, NextResponse } from 'next/server';
import { getCachedUser } from '@/lib/supabase/server';
import { loadIndex, WikiIndexLoadError } from '@/lib/wiki/loadIndex';
// Imported from lib/wiki/filterEntries.ts, NOT from WikiSearch.tsx: that
// component is 'use client', and Next's RSC bundler turns every export of a
// client module into a client reference — calling it from server code
// throws at request time even though type-check/build stay silent about it.
// See that file's header comment; WikiSearch.tsx re-exports the same
// function for its own (client-side) callers.
import { createEntrySearch, filterEntries } from '@/lib/wiki/filterEntries';
import { isGearSlot, categoriesForSlot, JEWEL_PSEUDO_SLOT, JEWEL_CATEGORIES, RUNE_PSEUDO_SLOT, RUNE_CATEGORIES } from '@/lib/build/gearSlots';
import { categoriesForGemSlot, isGemPseudoSlot } from '@/lib/build/gemSlots';
import type { WikiEntryKind, WikiSearchEntry } from '@/lib/wiki/types';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * `slot` covers the 17 gear slots, the `jewels` and `runes` pseudo-slots, and
 * the two gem pseudo-slots. Gems live in the SKILL index, whose category vocabulary is
 * disjoint from the item index's — hence a kind alongside the categories.
 * Returns `null` for anything else so the caller can 400 rather than let an
 * arbitrary category string reach the filter.
 */
function filterForParam(slot: string): { kind: WikiEntryKind; categories: readonly string[] } | null {
  if (isGemPseudoSlot(slot)) return { kind: 'skill', categories: categoriesForGemSlot(slot) };
  if (slot === JEWEL_PSEUDO_SLOT) return { kind: 'item', categories: JEWEL_CATEGORIES };
  if (slot === RUNE_PSEUDO_SLOT) return { kind: 'item', categories: RUNE_CATEGORIES };
  if (isGearSlot(slot)) return { kind: 'item', categories: categoriesForSlot(slot) };
  return null;
}

/**
 * One slot's entries and their Fuse index, built once per slot rather than
 * on every keystroke. Keyed by the loaded index array itself (WeakMap), so if
 * loadIndex ever produces a fresh array the stale per-slot entries go with the
 * old one instead of outliving it.
 */
type SlotSearch = { inSlot: WikiSearchEntry[]; fuse: Fuse<WikiSearchEntry> };
const slotSearchCache = new WeakMap<WikiSearchEntry[], Map<string, SlotSearch>>();

function slotSearchFor(index: WikiSearchEntry[], slot: string, categories: readonly string[]): SlotSearch {
  let bySlot = slotSearchCache.get(index);
  if (!bySlot) {
    bySlot = new Map();
    slotSearchCache.set(index, bySlot);
  }
  let cached = bySlot.get(slot);
  if (!cached) {
    const inSlot = index.filter((entry) => categories.includes(entry.category));
    cached = { inSlot, fuse: createEntrySearch(inSlot) };
    bySlot.set(slot, cached);
  }
  return cached;
}

export async function GET(request: NextRequest) {
  const {
    data: { user },
  } = await getCachedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;

  const slotParam = searchParams.get('slot');
  if (!slotParam) {
    return NextResponse.json({ error: 'slot is required' }, { status: 400 });
  }
  const filter = filterForParam(slotParam);
  if (!filter) {
    return NextResponse.json({ error: `Unknown slot: ${slotParam}` }, { status: 400 });
  }
  const { kind, categories } = filter;

  let limit = DEFAULT_LIMIT;
  const limitParam = searchParams.get('limit');
  if (limitParam !== null) {
    const parsed = Number(limitParam);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return NextResponse.json({ error: 'Invalid limit' }, { status: 400 });
    }
    limit = Math.min(parsed, MAX_LIMIT);
  }

  const q = searchParams.get('q') ?? '';

  let index;
  try {
    index = await loadIndex(kind);
  } catch (err) {
    // WikiIndexLoadError (malformed on-disk artifact) and a raw fs error
    // both mean the same thing to the caller: the data isn't usable right
    // now. Named separately in loadIndex.ts so a caller that cares CAN
    // distinguish; this route doesn't need to.
    const message = err instanceof WikiIndexLoadError ? err.message : `Failed to load ${kind} data`;
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { inSlot, fuse } = slotSearchFor(index, slotParam, categories);
  // Reuse the wiki's own search, not a second implementation — divergent
  // ranking between the wiki and the gear picker is a bug users would feel
  // without being able to name it.
  const matched = filterEntries(inSlot, q, fuse);

  return NextResponse.json({ entries: matched.slice(0, limit), total: matched.length });
}
