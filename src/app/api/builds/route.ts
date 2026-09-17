// src/app/api/builds/route.ts
// =============================================================================
// POST /api/builds – authenticated build upsert.
//
// The first user-triggered write route in this repo. Uses the cookie-scoped
// createClient() so RLS applies: ownership is enforced by the "Owners can do
// everything with their builds" policy, never by comparing user_id here. An
// update for someone else's build simply matches zero rows.
//
// Saves go through a route (rather than direct from the client, as renames and
// deletes do) for exactly one reason: share_token must be minted server-side.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { createClient } from '@/lib/supabase/server';
import { GAME_VERSION } from '@/lib/build/constants';
import type { PassiveState } from '@/lib/build/types';
import type { Json } from '@/types/database';

interface SaveBuildBody {
  id?: string;
  name?: unknown;
  class?: unknown;
  ascendancy?: unknown;
  level?: unknown;
  league?: unknown;
  main_skill?: unknown;
  passive_state?: PassiveState;
  gear_state?: Record<string, unknown>;
  gem_state?: Record<string, unknown>;
}

function isPassiveState(value: unknown): value is PassiveState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.set1) && Array.isArray(v.set2) && Array.isArray(v.ascendancyNodes)
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: SaveBuildBody;
  try {
    body = (await request.json()) as SaveBuildBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const className = typeof body.class === 'string' ? body.class.trim() : '';
  if (!className) {
    return NextResponse.json({ error: 'Class is required' }, { status: 400 });
  }

  const level = typeof body.level === 'number' ? Math.trunc(body.level) : 1;
  if (level < 1 || level > 100) {
    return NextResponse.json({ error: 'Level must be between 1 and 100' }, { status: 400 });
  }

  if (body.passive_state !== undefined && !isPassiveState(body.passive_state)) {
    return NextResponse.json({ error: 'Malformed passive_state' }, { status: 400 });
  }

  // Always written in full – the column default omits ascendancyNodes.
  const passive_state: PassiveState = body.passive_state ?? {
    set1: [],
    set2: [],
    ascendancyNodes: [],
  };

  const shared = {
    name,
    class: className,
    ascendancy: typeof body.ascendancy === 'string' ? body.ascendancy : null,
    level,
    league: typeof body.league === 'string' && body.league.trim() ? body.league.trim() : 'Standard',
    main_skill: typeof body.main_skill === 'string' ? body.main_skill : null,
    passive_state: passive_state as unknown as Json,
    gear_state: (body.gear_state ?? {}) as unknown as Json,
    gem_state: (body.gem_state ?? {}) as unknown as Json,
    game_version: GAME_VERSION,
  };

  if (body.id) {
    const { data, error } = await supabase
      .from('builds')
      .update(shared)
      .eq('id', body.id)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      // RLS matched nothing: either it does not exist or it is not ours.
      // Deliberately indistinguishable – do not leak other users' build ids.
      return NextResponse.json({ error: 'Build not found' }, { status: 404 });
    }
    return NextResponse.json({ build: data });
  }

  const { data, error } = await supabase
    .from('builds')
    .insert({ ...shared, user_id: user.id, share_token: nanoid() })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ build: data });
}
