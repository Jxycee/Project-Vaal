// src/app/api/wiki/items/route.ts
// =============================================================================
// GET /api/wiki/items — server-side gear/jewel picker search.
//
// Filters the item index down to one slot's categories and applies the
// wiki's own search ranking, so a phone never downloads the 722KB raw index
// to fill a single gear slot. See docs/superpowers/specs/2026-09-20-gear-
// design.md, "The one substantive change from the original spec" — a
// filtered response for one slot is roughly 5KB, on an interaction users
// perform 17 times to fill a character.
//
// `/api/` is NOT in PROTECTED_PREFIXES (src/proxy.ts), but the index file
// this route reads under `/data/wiki/` IS. Without its own auth check this
// route would be an unauthenticated side door around that gate — same
// reasoning, same fix, as POST /api/builds.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getCachedUser } from '@/lib/supabase/server';
import { loadIndex, WikiIndexLoadError } from '@/lib/wiki/loadIndex';
// Imported from lib/wiki/filterEntries.ts, NOT from WikiSearch.tsx: that
// component is 'use client', and Next's RSC bundler turns every export of a
// client module into a client reference — calling it from server code
// throws at request time even though type-check/build stay silent about it.
// See that file's header comment; WikiSearch.tsx re-exports the same
// function for its own (client-side) callers.
import { filterEntries } from '@/lib/wiki/filterEntries';
import { isGearSlot, categoriesForSlot, JEWEL_PSEUDO_SLOT, JEWEL_CATEGORIES } from '@/lib/build/gearSlots';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * `slot` covers both the 17 gear slots and the `jewels` pseudo-slot (the
 * jewel picker reuses this same route — see 2026-09-20-jewels-design.md).
 * Returns `null` for anything else so the caller can 400 rather than let an
 * arbitrary category string reach the filter.
 */
function categoriesForParam(slot: string): readonly string[] | null {
  if (slot === JEWEL_PSEUDO_SLOT) return JEWEL_CATEGORIES;
  if (isGearSlot(slot)) return categoriesForSlot(slot);
  return null;
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
  const categories = categoriesForParam(slotParam);
  if (!categories) {
    return NextResponse.json({ error: `Unknown slot: ${slotParam}` }, { status: 400 });
  }

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
    index = await loadIndex('item');
  } catch (err) {
    // WikiIndexLoadError (malformed on-disk artifact) and a raw fs error
    // both mean the same thing to the caller: the data isn't usable right
    // now. Named separately in loadIndex.ts so a caller that cares CAN
    // distinguish; this route doesn't need to.
    const message = err instanceof WikiIndexLoadError ? err.message : 'Failed to load item data';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const inSlot = index.filter((entry) => categories.includes(entry.category));
  // Reuse the wiki's own search, not a second implementation — divergent
  // ranking between the wiki and the gear picker is a bug users would feel
  // without being able to name it.
  const matched = filterEntries(inSlot, q);

  return NextResponse.json({ entries: matched.slice(0, limit), total: matched.length });
}
