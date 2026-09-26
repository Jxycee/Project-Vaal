// src/app/api/wiki/mods/route.ts
// =============================================================================
// GET /api/wiki/mods?item=<slug>&kind=prefix|suffix — the prefixes or suffixes
// that can spawn on one base, grouped, for the item editor's mod picker
// (Slice 4, plans/2026-09-25-slice4-item-affixes.md). Eligibility lives in
// src/lib/wiki/modCatalogue.ts.
//
// Same auth reasoning as GET /api/wiki/items: `/api/` is NOT in
// PROTECTED_PREFIXES, while the data behind this route sits under the
// auth-gated /data/wiki/ prefix, so the session is checked first, before any
// parameter is read.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getCachedUser } from '@/lib/supabase/server';
import { eligibleMods, type AffixKind } from '@/lib/wiki/modCatalogue';

function isAffixKind(value: string | null): value is AffixKind {
  return value === 'prefix' || value === 'suffix';
}

export async function GET(request: NextRequest) {
  const {
    data: { user },
  } = await getCachedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const item = searchParams.get('item');
  const kind = searchParams.get('kind');
  if (!item) return NextResponse.json({ error: 'item is required' }, { status: 400 });
  if (!isAffixKind(kind)) return NextResponse.json({ error: 'kind must be prefix or suffix' }, { status: 400 });

  let groups;
  try {
    groups = await eligibleMods(item, kind);
  } catch {
    return NextResponse.json({ error: 'Failed to load mod data' }, { status: 500 });
  }
  // A malformed slug and an unknown one answer alike — the slug check lives in eligibleMods.
  if (groups === null) return NextResponse.json({ error: 'Unknown item' }, { status: 404 });

  return NextResponse.json({ groups });
}
